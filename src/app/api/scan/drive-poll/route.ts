// ============================================================
// GET /api/scan/drive-poll
// ============================================================
// Called on schedule (cron) to check all active writer folders
// for new or updated Google Docs.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { listDocsInFolder } from '@/lib/google-drive';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret if configured (Vercel Pro sends this automatically)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    const writers = await prisma.writer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, driveFolderId: true },
    });

    let totalNew = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    for (const writer of writers) {
      try {
        console.log(`[Drive Poll] Scanning folder ${writer.driveFolderId} for writer "${writer.name}"...`);
        const docs = await listDocsInFolder(writer.driveFolderId);
        console.log(`[Drive Poll] Found ${docs.length} docs in folder for "${writer.name}"`);

        // Get existing articles for this writer
        const existingArticles = await prisma.article.findMany({
          where: { writerId: writer.id },
          select: { googleDocId: true, contentHash: true, lastModified: true },
        });

        const existingMap = new Map(
          existingArticles.map((a) => [a.googleDocId, a])
        );

        for (const doc of docs) {
          const existing = existingMap.get(doc.id);
          const modifiedHash = crypto
            .createHash('md5')
            .update(doc.modifiedTime)
            .digest('hex');

          if (!existing) {
            // New document — insert as DETECTED
            await prisma.article.create({
              data: {
                writerId: writer.id,
                googleDocId: doc.id,
                title: doc.name,
                driveUrl: doc.webViewLink,
                status: 'DETECTED',
                detectedAt: new Date(),
                contentHash: modifiedHash,
                lastModified: new Date(doc.modifiedTime),
              },
            });
            totalNew++;
          } else if (existing.contentHash !== modifiedHash) {
            // Document was edited — queue for re-scan
            await prisma.article.update({
              where: { googleDocId: doc.id },
              data: {
                title: doc.name,
                status: 'QUEUED',
                contentHash: modifiedHash,
                lastModified: new Date(doc.modifiedTime),
              },
            });
            totalUpdated++;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message