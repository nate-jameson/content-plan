// ============================================================
// POST /api/scan/submit
// ============================================================
// Finds all DETECTED/QUEUED articles, downloads content from
// Google Drive, and submits to Copyleaks for scanning.
// Rate limited to max 5 submissions per call.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDocContent } from '@/lib/google-drive';
import { submitScan } from '@/lib/copyleaks';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_SUBMISSIONS_PER_CALL = 5;

export async function POST() {
  try {
    // Find articles ready for submission
    const articles = await prisma.article.findMany({
      where: {
        status: { in: ['DETECTED', 'QUEUED'] },
      },
      orderBy: { detectedAt: 'asc' },
      take: MAX_SUBMISSIONS_PER_CALL,
      include: { writer: { select: { name: true } } },
    });

    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        submitted: 0,
        message: 'No articles pending submission',
      });
    }

    const results: Array<{ articleId: string; title: string; status: string }> = [];
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/copyleaks-webhook`;

    for (const article of articles) {
      try {
        // Download document content from Google Drive
        const content = await getDocContent(article.googleDocId);

        if (!content || content.trim().length < 50) {
          console.warn(`[Submit] Article "${article.title}" has insufficient content, skipping`);
          results.push({ articleId: article.id, title: article.title, status: 'skipped_empty' });
          continue;
        }

        // Generate a unique scan ID for Copyleaks
        const scanId = `cr-${article.id}-${Date.now()}`;

        // Update content hash based on actual content
        const contentHash = crypto
          .createHash('md5')
          .update(content)
          .digest('hex');

        // Submit to Copyleaks
        await submitScan({
          scanId,
          text: content,
          articleId: article.id,
          webhookUrl,
          sandbox: process.env.NODE_ENV !== 'production',
        });

        // Update article status
        await prisma.article.update({
          where: { id: article.id },
          data: {
            status: 'SCANNING',
            submittedAt: new Date(),
            contentHash,
            wordCount: content.split(/\s+/).filter(Boolean).length,
          },
        });

        // If there was a previous scan result (re-scan), delete it
        await prisma.scanResult.deleteMany({
          where: { articleId: article.id },
        });

        results.push({ articleId: article.id, title: article.title, status: 'submitted' });
        console.log(`[Submit] ✅ Submitted "${article.title}" by ${article.writer.name} (scan: ${scanId})`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Submit] Failed for "${article.title}":`, err);

        await prisma.article.update({
          where: { id: article.id },
          data: { status: 'ERROR' },
        });

        results.push({ articleId: article.id, title: article.title, status: `error: ${message}` });
      }
    }

    const submitted = results.filter((r) => r.status === 'submitted').length;

    return NextResponse.json({
      success: true,
      submitted,
      total: articles.length,
      results,
    });
  } catch (error) {
    console.error('[Submit] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: 'Submission failed' },
      { status: 500 }
    );
  }
}
