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
// 4. Post summary comment on the Google Doc
// 5. Update article status

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addScanResultComment } from '@/lib/google-drive';

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
  const allSources = [...internetSources, ...databaseSources];

  // ---- Store Scan Result ----
  // Note: AI detection scores are NOT included in the completed webhook.
  // They would need to be fetched via the export endpoint if needed.
  const scanResult = await prisma.scanResult.create({
    data: {
      articleId: article.id,
      copyleaksScanId: scanId,

      // Plagiarism
      plagiarismScore: plagiarism.aggregatedScore ?? 0,
      matchedWords: plagiarism.identicalWords ?? 0,
      totalWords: payload?.scannedDocument?.totalWords ?? 0,

      // AI Detection - not available in completed webhook, default to 0
      aiScore: 0,
      humanScore: 1,

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
        create: allSources.map((source: any) => ({
          sourceUrl: source.url ?? '',
          sourceTitle: source.title || null,
          matchedWords: source.matchedWords ?? 0,
          percentage: 0, // Individual source % not directly in webhook
          isInternetSource: internetSources.includes(source),
        })),
      },
    },
  });

  // ---- Update Article Status ----
  await prisma.article.update({
    where: { id: article.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      wordCount: payload?.scannedDocument?.totalWords ?? article.wordCount,
    },
  });

  // ---- Update Writer Aggregate Stats ----
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
        avgAiScore: writerStats._avg.aiScore ?? 0,
        avgGrammarScore: writerStats._avg.grammarScore ?? 0,
      },
    });
  } catch (statsError) {
    console.error(`[Copyleaks] Failed to update writer stats:`, statsError);
    // Non-fatal
  }

  // ---- Post Comment on Google Doc ----
  try {
    const topSources = allSources
      .sort((a: any, b: any) => (b.matchedWords ?? 0) - (a.matchedWords ?? 0))
      .slice(0, 3)
      .map((s: any) => ({ url: s.url, percentage: 0 }));

    await addScanResultComment(article.googleDocId, {
      plagiarismScore: plagiarism.aggregatedScore ?? 0,
      aiScore: 0,
      grammarScore: null,
      readabilityGrade: null,
      topSources,
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/articles/${article.id}`,
    });
  } catch (commentError) {
    console.error(`[Copyleaks] Failed to post comment on doc ${article.googleDocId}:`, commentError);
    // Non-fatal — results are still stored in dashboard
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
