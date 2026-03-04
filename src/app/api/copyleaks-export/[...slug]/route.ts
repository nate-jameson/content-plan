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

  // Extract AI detection summary from Copyleaks (for reference/logging)
  const aiSummary = body?.summary ?? {};
  const copyleaksAiScore = aiSummary.ai ?? 0;
  const copyleaksHumanScore = aiSummary.human ?? 1;

  console.log(`[Copyleaks Export] Copyleaks scores - AI: ${(copyleaksAiScore * 100).toFixed(1)}% | Human: ${(copyleaksHumanScore * 100).toFixed(1)}%`);

  // Store full response (includes explain patterns) but defer score update until paragraphs are processed
  await prisma.scanResult.update({
    where: { id: scanResult.id },
    data: {
      rawResponse: body,
    },
  });

  // Create paragraph-level AI classifications with REAL text
  const results = body?.results ?? [];
  if (results.length > 0) {
    // Delete any existing paragraphs for this scan
    await prisma.aiParagraph.deleteMany({
      where: { scanResultId: scanResult.id },
    });

    // Fetch the original article content to extract real text segments
    const article = scanResult.article;
    const originalContent = article
      ? (await prisma.article.findUnique({ where: { id: article.id }, select: { content: true } }))?.content
      : null;

    // Create new paragraph entries with actual text
    const paragraphs = results.map((result: any, index: number) => {
      const classification = result.classification === 2 ? 'ai' : 'human';
      const probability = result.probability ?? (classification === 'ai' ? 1 : 0);
      
      // Extract actual text using character positions from Copyleaks
      let extractedText = '';
      if (originalContent && result.matches?.length > 0) {
        // Collect all character ranges for this result
        const segments: string[] = [];
        for (const match of result.matches) {
          const starts = match?.text?.chars?.starts ?? [];
          const lengths = match?.text?.chars?.lengths ?? [];
          for (let i = 0; i < starts.length; i++) {
            const start = starts[i];
            const length = lengths[i] ?? 0;
            if (start >= 0 && length > 0 && start + length <= originalContent.length) {
              segments.push(originalContent.substring(start, start + length));
            }
          }
        }
        extractedText = segments.join(' ');
      }

      return {
        scanResultId: scanResult.id,
        paragraphIndex: index,
        classification,
        aiProbability: probability,
        text: extractedText || `[Section ${index + 1} — text extraction pending]`,
      };
    });

    await prisma.aiParagraph.createMany({
      data: paragraphs,
    });

    console.log(`[Copyleaks Export] Created ${paragraphs.length} paragraph classifications (${originalContent ? 'with' : 'without'} real text)`);

    // Calculate AI score based on paragraph classifications (not Copyleaks summary)
    // Score = proportion of paragraphs classified as AI
    // Only shows 100% if EVERY paragraph is AI-attributed
    const aiParaCount = paragraphs.filter((p: any) => p.classification === 'ai').length;
    const mixedParaCount = paragraphs.filter((p: any) => p.classification === 'mixed').length;
    const totalParaCount = paragraphs.length;

    // Mixed paragraphs count as 0.5 AI
    const calculatedAiScore = totalParaCount > 0
      ? (aiParaCount + (mixedParaCount * 0.5)) / totalParaCount
      : copyleaksAiScore;  // Fallback to Copyleaks score if no paragraphs
    const calculatedHumanScore = 1 - calculatedAiScore;

    console.log(`[Copyleaks Export] Calculated AI: ${(calculatedAiScore * 100).toFixed(1)}% (${aiParaCount} AI + ${mixedParaCount} mixed of ${totalParaCount} sections)`);

    // Store the calculated scores
    await prisma.scanResult.update({
      where: { id: scanResult.id },
      data: {
        aiScore: calculatedAiScore,
        humanScore: calculatedHumanScore,
      },
    });
  } else {
    // No paragraph-level data, use Copyleaks summary
    await prisma.scanResult.update({
      where: { id: scanResult.id },
      data: {
        aiScore: copyleaksAiScore,
        humanScore: copyleaksHumanScore,
      },
    });
    console.log(`[Copyleaks Export] No paragraph data, using Copyleaks summary: ${(copyleaksAiScore * 100).toFixed(1)}% AI`);
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

  return NextResponse.json({ success: true, aiScore: copyleaksAiScore, humanScore: copyleaksHumanScore });
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
