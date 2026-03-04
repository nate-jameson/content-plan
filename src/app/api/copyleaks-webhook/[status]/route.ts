// ============================================================
// POST /api/copyleaks-webhook/{status}
// ============================================================
// Receives scan results from Copyleaks when processing completes.
// Copyleaks sends to: {webhookUrl}/completed or {webhookUrl}/error
//
// Flow:
// 1. Copyleaks POSTs results here
// 2. We parse plagiarism, AI detection, and writing quality scores
// 3. Store in database
// 4. Post summary comment on the Google Doc
// 5. Update article status

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addScanResultComment, getWordCount } from '@/lib/google-drive';
import { downloadPdfReport } from '@/lib/copyleaks';
import { CopyleaksWebhookPayload } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ status: string }> }
) {
  try {
    const { status } = await params;
    const body = await request.json();

    console.log(`[Copyleaks Webhook] Status: ${status}, Scan ID: ${body?.scannedDocument?.scanId}`);

    if (status === 'error') {
      return handleError(body);
    }

    if (status === 'completed') {
      return handleCompleted(body);
    }

    // Creditscheck or other status
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Copyleaks Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleCompleted(payload: CopyleaksWebhookPayload) {
  const scanId = payload.scannedDocument.scanId;
  const articleId = payload.scannedDocument.developerPayload;

  if (!articleId) {
    console.error(`[Copyleaks] No articleId in developerPayload for scan ${scanId}`);
    return NextResponse.json({ error: 'Missing articleId' }, { status: 400 });
  }

  // Find the article
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { writer: true },
  });

  if (!article) {
    console.error(`[Copyleaks] Article not found: ${articleId}`);
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  // ---- Extract Plagiarism Data ----
  const plagiarism = payload.results?.score ?? { aggregatedScore: 0, identicalWords: 0 };
  const internetSources = payload.results?.internet ?? [];
  const databaseSources = payload.results?.database ?? [];
  const allSources = [...internetSources, ...databaseSources];

  // ---- Extract AI Detection ----
  const aiSummary = payload.aiDetection?.summary ?? { ai: 0, human: 1 };
  const aiClassifications = payload.aiDetection?.classifications ?? [];

  // ---- Extract Writing Feedback ----
  const writing = payload.writingFeedback;

  // ---- Store Scan Result ----
  const scanResult = await prisma.scanResult.create({
    data: {
      articleId: article.id,
      copyleaksScanId: scanId,

      // Plagiarism
      plagiarismScore: plagiarism.aggregatedScore,
      matchedWords: plagiarism.identicalWords,
      totalWords: payload.scannedDocument.totalWords,

      // AI Detection
      aiScore: aiSummary.ai,
      humanScore: aiSummary.human,

      // Writing Quality
      grammarScore: writing?.corrections?.grammar?.score ?? null,
      mechanicsScore: writing?.corrections?.mechanics?.score ?? null,
      sentenceStructure: writing?.corrections?.sentenceStructure?.score ?? null,
      wordChoice: writing?.corrections?.wordChoice?.score ?? null,
      readabilityGrade: writing?.readability?.gradeLevel ?? null,
      readingTimeMinutes: writing?.readability?.readingTime ?? null,

      // Raw response for drill-down
      rawResponse: payload as any,

      // Source matches
      sources: {
        create: allSources.map((source) => ({
          sourceUrl: source.url,
          sourceTitle: source.title || null,
          matchedWords: source.matchedWords,
          percentage: source.metadata?.finalScore ?? 0,
          isInternetSource: internetSources.includes(source),
        })),
      },

      // Per-paragraph AI classifications
      paragraphs: {
        create: aiClassifications.map((para, index) => ({
          paragraphIndex: index,
          text: '', // Will be populated from detailed result download
          classification: para.classification,
          aiProbability: para.ai,
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
      wordCount: payload.scannedDocument.totalWords,
    },
  });

  // ---- Update Writer Aggregate Stats ----
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

  // ---- Post Comment on Google Doc ----
  try {
    const topSources = allSources
      .sort((a, b) => (b.metadata?.finalScore ?? 0) - (a.metadata?.finalScore ?? 0))
      .slice(0, 3)
      .map((s) => ({ url: s.url, percentage: s.metadata?.finalScore ?? 0 }));

    await addScanResultComment(article.googleDocId, {
      plagiarismScore: plagiarism.aggregatedScore,
      aiScore: aiSummary.ai,
      grammarScore: writing?.corrections?.grammar?.score ?? null,
      readabilityGrade: writing?.readability?.gradeLevel ?? null,
      topSources,
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/articles/${article.id}`,
    });
  } catch (commentError) {
    console.error(`[Copyleaks] Failed to post comment on doc ${article.googleDocId}:`, commentError);
    // Non-fatal — results are still stored in dashboard
  }

  // ---- Try to Download PDF Report ----
  try {
    const pdfBuffer = await downloadPdfReport(scanId);
    // TODO: Upload to S3 and store URL
    // For now, store a placeholder
    await prisma.scanResult.update({
      where: { id: scanResult.id },
      data: { pdfReportUrl: `/api/reports/${scanId}` },
    });
  } catch (pdfError) {
    console.error(`[Copyleaks] PDF download failed for scan ${scanId}:`, pdfError);
  }

  console.log(`[Copyleaks] ✅ Scan complete for "${article.title}" by ${article.writer.name}`);
  return NextResponse.json({ success: true, articleId: article.id });
}

async function handleError(body: any) {
  const scanId = body?.scannedDocument?.scanId;
  const articleId = body?.scannedDocument?.developerPayload;
  const errorMessage = body?.error?.message ?? 'Unknown error';

  console.error(`[Copyleaks] Scan error for ${scanId}: ${errorMessage}`);

  if (articleId) {
    await prisma.article.update({
      where: { id: articleId },
      data: { status: 'ERROR' },
    });
  }

  return NextResponse.json({ received: true });
}
