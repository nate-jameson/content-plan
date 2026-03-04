// ============================================================
// POST /api/copyleaks-webhook/{status}
// ============================================================
// Receives scan results from Copyleaks when processing completes.
// Copyleaks sends to: {webhookUrl}/completed or {webhookUrl}/error
//
// Flow:
// 1. Copyleaks POSTs results here
// 2. We parse plagiarism scores and source matches
// 3. Store in database
// 4. Trigger export for AI detection + PDF
// 5. Update article status
// (Google Doc comment is posted after AI detection arrives via export)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { triggerExport } from '@/lib/copyleaks';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ status: string }> }
) {
  try {
    const { status } = await params;
    const body = await request.json();

    const scanId = body?.scannedDocument?.scanId;
    console.log(`[Copyleaks Webhook] Status: ${status}, Scan ID: ${scanId}`);

    if (status === 'error') {
      return handleError(body);
    }

    if (status === 'completed') {
      return handleCompleted(body);
    }

    // creditsChecked, indexed, or other status - acknowledge
    console.log(`[Copyleaks Webhook] Received ${status} event for scan ${scanId}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Copyleaks Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleCompleted(payload: any) {
  const scanId = payload?.scannedDocument?.scanId;
  const totalWords = payload?.scannedDocument?.totalWords ?? 0;
  
  // CRITICAL: developerPayload is at the ROOT level, NOT inside scannedDocument
  const articleId = payload?.developerPayload;

  console.log(`[Copyleaks] Processing completed scan: ${scanId}, articleId: ${articleId}`);

  // Try to find the article by developerPayload (articleId) first, then by copyleaksScanId
  let article;
  if (articleId) {
    article = await prisma.article.findUnique({
      where: { id: articleId },
      include: { writer: true },
    });
  }
  
  if (!article && scanId) {
    // Fallback: look up by copyleaksScanId
    article = await prisma.article.findFirst({
      where: { copyleaksScanId: scanId },
      include: { writer: true },
    });
  }

  if (!article) {
    console.error(`[Copyleaks] Article not found. articleId=${articleId}, scanId=${scanId}`);
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  // ---- Extract Plagiarism Data ----
  const plagiarism = payload?.results?.score ?? { aggregatedScore: 0, identicalWords: 0 };
  const internetSources = payload?.results?.internet ?? [];
  const databaseSources = payload?.results?.database ?? [];

  // Collect all result IDs for the export (needed for detailed drill-down)
  const allResultIds = [
    ...internetSources.map((s: any) => s.id),
    ...databaseSources.map((s: any) => s.id),
  ];

  // ---- Build Source Records ----
  // Internet sources have URLs; database sources are internal Copyleaks matches
  const sourceRecords = [
    ...internetSources.map((source: any) => ({
      sourceUrl: source.url ?? '',
      sourceTitle: source.title || source.introduction || null,
      matchedWords: source.matchedWords ?? source.identicalWords ?? 0,
      // Calculate percentage from matched words
      percentage: totalWords > 0
        ? Math.round(((source.matchedWords ?? source.identicalWords ?? 0) / totalWords) * 1000) / 10
        : 0,
      isInternetSource: true,
    })),
    ...databaseSources.map((source: any) => ({
      sourceUrl: '', // Database sources don't have public URLs
      sourceTitle: source.introduction || source.title || 'Internal Database Match',
      matchedWords: source.matchedWords ?? source.identicalWords ?? 0,
      percentage: totalWords > 0
        ? Math.round(((source.matchedWords ?? source.identicalWords ?? 0) / totalWords) * 1000) / 10
        : 0,
      isInternetSource: false,
    })),
  ];

  // ---- Store Scan Result ----
  // AI detection scores will be updated later via the export callback
  const scanResult = await prisma.scanResult.create({
    data: {
      articleId: article.id,
      copyleaksScanId: scanId,

      // Plagiarism
      plagiarismScore: plagiarism.aggregatedScore ?? 0,
      matchedWords: plagiarism.identicalWords ?? 0,
      totalWords,

      // AI Detection — placeholder until export delivers real scores
      aiScore: -1,  // -1 means "pending" (export not yet received)
      humanScore: -1,

      // Writing Quality - not available (not on plan)
      grammarScore: null,
      mechanicsScore: null,
      sentenceStructure: null,
      wordChoice: null,
      readabilityGrade: null,
      readingTimeMinutes: null,

      // Raw response for debugging/drill-down
      rawResponse: payload as any,

      // Source matches
      sources: {
        create: sourceRecords,
      },
    },
  });

  // ---- Update Article Status ----
  await prisma.article.update({
    where: { id: article.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      wordCount: totalWords || article.wordCount,
    },
  });

  // ---- Update Writer Aggregate Stats (plagiarism only for now) ----
  try {
    const writerStats = await prisma.scanResult.aggregate({
      where: { article: { writerId: article.writerId } },
      _avg: {
        plagiarismScore: true,
        aiScore: true,
        grammarScore: true,
      },
    });

    await prisma.writer.update({
      where: { id: article.writerId },
      data: {
        totalArticles: { increment: 1 },
        avgPlagiarism: writerStats._avg.plagiarismScore ?? 0,
      },
    });
  } catch (statsError) {
    console.error(`[Copyleaks] Failed to update writer stats:`, statsError);
  }

  // ---- Trigger Export for AI Detection + PDF ----
  try {
    await triggerExport({
      copyleaksScanId: scanId,
      scanResultId: scanResult.id,
      resultIds: allResultIds,
    });
    console.log(`[Copyleaks] Export triggered for AI detection + PDF`);
  } catch (exportError) {
    console.error(`[Copyleaks] Export trigger failed (non-fatal):`, exportError);
    // Non-fatal — plagiarism results are stored, AI detection just won't be available
    // Mark AI as unavailable (0) instead of pending (-1)
    await prisma.scanResult.update({
      where: { id: scanResult.id },
      data: { aiScore: 0, humanScore: 0 },
    });
  }

  console.log(`[Copyleaks] ✅ Scan complete for "${article.title}" by ${article.writer.name}`);
  return NextResponse.json({ success: true, articleId: article.id });
}

async function handleError(body: any) {
  const scanId = body?.scannedDocument?.scanId;
  // developerPayload is at ROOT level for error webhooks too
  const articleId = body?.developerPayload;
  const errorMessage = body?.error?.message ?? 'Unknown error';

  console.error(`[Copyleaks] Scan error for ${scanId}: ${errorMessage}`);

  // Try to find article by articleId or scanId
  let article;
  if (articleId) {
    article = await prisma.article.findUnique({ where: { id: articleId } });
  }
  if (!article && scanId) {
    article = await prisma.article.findFirst({ where: { copyleaksScanId: scanId } });
  }

  if (article) {
    await prisma.article.update({
      where: { id: article.id },
      data: { status: 'ERROR' },
    });
  }

  return NextResponse.json({ received: true });
}
