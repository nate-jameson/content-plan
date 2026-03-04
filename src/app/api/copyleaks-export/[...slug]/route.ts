// ============================================================
// POST /api/copyleaks-export/{type}/{copyleaksScanId}
// ============================================================
// Receives export data from Copyleaks after we trigger an export.
// Routes:
//   /api/copyleaks-export/ai/{scanId}     → AI detection results
//   /api/copyleaks-export/pdf/{scanId}    → PDF report binary
//   /api/copyleaks-export/done/{scanId}   → Export completion
//   /api/copyleaks-export/result/{scanId}/{resultId} → Individual result data

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const type = slug[0];
  const copyleaksScanId = slug[1];

  console.log(`[Copyleaks Export] Received ${type} for scan ${copyleaksScanId}`);

  if (!copyleaksScanId) {
    return NextResponse.json({ error: 'Missing scan ID' }, { status: 400 });
  }

  try {
    switch (type) {
      case 'ai':
        return handleAiDetection(copyleaksScanId, request);
      case 'pdf':
        return handlePdfReport(copyleaksScanId, request);
      case 'done':
        return handleExportCompleted(copyleaksScanId, request);
      case 'result':
        // Individual result data — acknowledge but don't process for now
        console.log(`[Copyleaks Export] Received result ${slug[2]} for scan ${copyleaksScanId}`);
        return NextResponse.json({ received: true });
      default:
        console.log(`[Copyleaks Export] Unknown type: ${type}`);
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error(`[Copyleaks Export] Error processing ${type}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Process AI detection results from Copyleaks export.
 * Updates scan_results with AI/human scores and creates paragraph-level classifications.
 */
async function handleAiDetection(copyleaksScanId: string, request: NextRequest) {
  const body = await request.json();

  console.log(`[Copyleaks Export] AI detection data received for ${copyleaksScanId}`);

  // Find the scan result by copyleaks scan ID
  const scanResult = await prisma.scanResult.findFirst({
    where: { copyleaksScanId },
    include: { article: true },
  });

  if (!scanResult) {
    console.error(`[Copyleaks Export] Scan result not found for ${copyleaksScanId}`);
    return NextResponse.json({ error: 'Scan result not found' }, { status: 404 });
  }

  // Extract AI detection summary
  // Format: { summary: { human: 0.95, ai: 0.05 }, results: [...], modelVersion: "v7.1" }
  const aiSummary = body?.summary ?? {};
  const aiScore = aiSummary.ai ?? 0;
  const humanScore = aiSummary.human ?? 1;

  console.log(`[Copyleaks Export] AI: ${(aiScore * 100).toFixed(1)}% | Human: ${(humanScore * 100).toFixed(1)}%`);

  // Update scan result with AI scores
  await prisma.scanResult.update({
    where: { id: scanResult.id },
    data: {
      aiScore,
      humanScore,
    },
  });

  // Create paragraph-level AI classifications
  const results = body?.results ?? [];
  if (results.length > 0) {
    // Delete any existing paragraphs for this scan
    await prisma.aiParagraph.deleteMany({
      where: { scanResultId: scanResult.id },
    });

    // Create new paragraph entries
    const paragraphs = results.map((result: any, index: number) => {
      const classification = result.classification === 2 ? 'ai' : 'human';
      const probability = result.probability ?? (classification === 'ai' ? 1 : 0);
      
      // Extract text positions for context
      const wordStart = result.matches?.[0]?.text?.words?.starts?.[0] ?? 0;
      const wordLength = result.matches?.[0]?.text?.words?.lengths?.[0] ?? 0;

      return {
        scanResultId: scanResult.id,
        paragraphIndex: index,
        classification,
        aiProbability: probability,
        text: `[Section ${index + 1}]`, // Placeholder — original text not in export payload
      };
    });

    await prisma.aiParagraph.createMany({
      data: paragraphs,
    });

    console.log(`[Copyleaks Export] Created ${paragraphs.length} paragraph classifications`);
  }

  // Update writer aggregate stats with new AI score
  try {
    const article = scanResult.article;
    if (article) {
      const writerStats = await prisma.scanResult.aggregate({
        where: { article: { writerId: article.writerId } },
        _avg: {
          aiScore: true,
          plagiarismScore: true,
          grammarScore: true,
        },
      });

      await prisma.writer.update({
        where: { id: article.writerId },
        data: {
          avgAiScore: writerStats._avg.aiScore ?? 0,
        },
      });
    }
  } catch (statsError) {
    console.error(`[Copyleaks Export] Failed to update writer stats:`, statsError);
  }

  // Try to update Google Doc comment with AI results
  try {
    const { addScanResultComment } = await import('@/lib/google-drive');
    
    const updatedResult = await prisma.scanResult.findUnique({
      where: { id: scanResult.id },
      include: { 
        article: true,
        sources: { orderBy: { matchedWords: 'desc' }, take: 3 },
      },
    });

    if (updatedResult?.article) {
      const topSources = updatedResult.sources
        .filter((s) => s.sourceUrl)
        .map((s) => ({ url: s.sourceUrl, percentage: s.percentage }));

      await addScanResultComment(updatedResult.article.googleDocId, {
        plagiarismScore: updatedResult.plagiarismScore,
        aiScore: updatedResult.aiScore,
        grammarScore: null,
        readabilityGrade: null,
        topSources,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/articles/${updatedResult.article.id}`,
      });
      console.log(`[Copyleaks Export] Updated Google Doc comment with AI score`);
    }
  } catch (commentError) {
    console.error(`[Copyleaks Export] Failed to update doc comment:`, commentError);
  }

  return NextResponse.json({ success: true, aiScore, humanScore });
}

/**
 * Receive PDF report from Copyleaks export.
 * For now, just acknowledge — we'll proxy downloads on-demand.
 */
async function handlePdfReport(copyleaksScanId: string, request: NextRequest) {
  // Mark that PDF is available by setting the URL to our proxy endpoint
  const scanResult = await prisma.scanResult.findFirst({
    where: { copyleaksScanId },
  });

  if (scanResult) {
    await prisma.scanResult.update({
      where: { id: scanResult.id },
      data: {
        pdfReportUrl: `/api/articles/${scanResult.articleId}/pdf`,
      },
    });
    console.log(`[Copyleaks Export] PDF available for scan ${copyleaksScanId}`);
  }

  return NextResponse.json({ received: true });
}

/**
 * Handle export completion webhook.
 */
async function handleExportCompleted(copyleaksScanId: string, request: NextRequest) {
  console.log(`[Copyleaks Export] Export completed for scan ${copyleaksScanId}`);
  return NextResponse.json({ received: true });
}
