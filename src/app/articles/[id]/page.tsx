import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { StatusBadge } from '@/components/status-badge';
import { ScoreGauge } from '@/components/score-gauge';
import { ArticleActions } from './article-actions';
import { HighlightedArticle } from '@/components/HighlightedArticle';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Globe,
  Download,
  Database,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Bot,
  User,
  BarChart3,
  BookOpen,
  Clock,
  Info,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      writer: true,
      scanResult: {
        include: {
          sources: { orderBy: { matchedWords: 'desc' }, take: 20 },
          paragraphs: { orderBy: { paragraphIndex: 'asc' } },
        },
      },
    },
  });

  if (!article) {
    notFound();
  }

  // Fetch team averages for completed articles
  const teamAverages = await prisma.scanResult.aggregate({
    where: {
      article: {
        status: { in: ['COMPLETED', 'REVIEWED', 'APPROVED', 'FLAGGED'] },
      },
    },
    _avg: {
      aiScore: true,
      plagiarismScore: true,
    },
  });

  const avgAiScore = (teamAverages._avg.aiScore ?? 0) * 100;
  const avgPlagiarismScore = teamAverages._avg.plagiarismScore ?? 0;

  const scan = article.scanResult;
  const aiPending = scan && scan.aiScore < 0; // -1 means export pending
  const aiScore = aiPending ? 0 : (scan?.aiScore ?? 0);
  const humanScore = aiPending ? 0 : (scan?.humanScore ?? 0);
  const detectionLevel = article.aiDetectionLevel ?? 2;

  // Reading stats
  const wordCount = article.wordCount ?? 0;
  const readingTime = Math.max(1, Math.round(wordCount / 238));

  // Separate internet vs database sources
  const internetSources = scan?.sources.filter((s) => s.isInternetSource) ?? [];
  const databaseSources = scan?.sources.filter((s) => !s.isInternetSource) ?? [];

  // AI paragraph stats
  const aiParas = scan?.paragraphs ?? [];
  const aiCount = aiParas.filter((p) => p.classification === 'ai').length;
  const humanCount = aiParas.filter((p) => p.classification === 'human').length;
  const mixedCount = aiParas.filter((p) => p.classification === 'mixed').length;
  const totalParas = aiParas.length;

  // Extract explain patterns from raw response and resolve actual text phrases
  const rawResponse = scan?.rawResponse as any;
  const explainPatterns = rawResponse?.explain?.patterns;
  const articleContent = article.content ?? '';

  // Extract actual flagged phrases using WORD positions (immune to BOM/encoding issues)
  const cleanContent = articleContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const contentWords = cleanContent.split(/\s+/).filter((w: string) => w.length > 0);
  
  const explainPhrases: string[] = [];
  const explainWordStarts = explainPatterns?.text?.words?.starts as number[] | undefined;
  const explainWordLengths = explainPatterns?.text?.words?.lengths as number[] | undefined;
  if (explainWordStarts && explainWordLengths && contentWords.length > 0) {
    for (let i = 0; i < explainWordStarts.length; i++) {
      const startIdx = explainWordStarts[i];
      const wordLen = explainWordLengths[i] ?? 0;
      if (startIdx >= 0 && wordLen > 0 && startIdx + wordLen <= contentWords.length) {
        explainPhrases.push(contentWords.slice(startIdx, startIdx + wordLen).join(' '));
      } else {
        explainPhrases.push(`[Pattern ${i + 1}]`);
      }
    }
  }

  // ── Compute paragraph ranges for full-article highlighting ──
  const paragraphRanges: Array<{ startChar: number; endChar: number; classification: string; aiProbability: number }> = [];
  if (cleanContent && aiParas.length > 0) {
    for (const para of aiParas) {
      const paraText = (para.text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
      if (!paraText || paraText.startsWith('[Section')) continue;
      const idx = cleanContent.indexOf(paraText, paragraphRanges.length > 0 ? paragraphRanges[paragraphRanges.length - 1]?.endChar ?? 0 : 0);
      if (idx >= 0) {
        paragraphRanges.push({
          startChar: idx,
          endChar: idx + paraText.length,
          classification: para.classification,
          aiProbability: para.aiProbability,
        });
      }
    }
  }

  // ── Compute phrase highlight positions for full-article view ──
  const phraseHighlights: Array<{ globalStart: number; globalEnd: number; phrase: string; ratio: number; aiFreq: number; humanFreq: number }> = [];
  if (explainWordStarts && explainWordLengths && cleanContent && contentWords.length > 0) {
    // Build a map from word index to character position in cleanContent
    const wordCharPositions: number[] = [];
    let searchFrom = 0;
    for (const word of contentWords) {
      const pos = cleanContent.indexOf(word, searchFrom);
      wordCharPositions.push(pos >= 0 ? pos : searchFrom);
      searchFrom = (pos >= 0 ? pos : searchFrom) + word.length;
    }

    const proportions = (explainPatterns?.statistics?.proportion as number[]) ?? [];
    const aiCounts = (explainPatterns?.statistics?.aiCount as number[]) ?? [];
    const humanCounts = (explainPatterns?.statistics?.humanCount as number[]) ?? [];

    for (let i = 0; i < explainWordStarts.length; i++) {
      const startWordIdx = explainWordStarts[i];
      const wordLen = explainWordLengths[i] ?? 0;
      const endWordIdx = startWordIdx + wordLen - 1;
      if (startWordIdx >= 0 && endWordIdx < contentWords.length) {
        const globalStart = wordCharPositions[startWordIdx];
        const lastWord = contentWords[endWordIdx];
        const globalEnd = wordCharPositions[endWordIdx] + lastWord.length;
        phraseHighlights.push({
          globalStart,
          globalEnd,
          phrase: explainPhrases[i] ?? '',
          ratio: proportions[i] ?? 0,
          aiFreq: aiCounts[i] ?? 0,
          humanFreq: humanCounts[i] ?? 0,
        });
      }
    }
  }

  // Determine AI risk level
  const aiPercent = aiScore * 100;
  const riskLevel =
    aiPercent >= 70 ? 'high' : aiPercent >= 40 ? 'medium' : 'low';
  const riskConfig = {
    high: {
      color: 'red',
      label: 'High AI Risk',
      icon: AlertTriangle,
      bg: 'bg-red-400/10 border-red-400/25',
      text: 'text-red-300',
      desc: 'This content has significant indicators of AI generation. Recommend thorough manual review and potential rewrite.',
    },
    medium: {
      color: 'yellow',
      label: 'Moderate AI Risk',
      icon: AlertTriangle,
      bg: 'bg-yellow-400/10 border-yellow-400/25',
      text: 'text-yellow-300',
      desc: 'Some sections show AI-like patterns. Review flagged paragraphs and consider targeted edits.',
    },
    low: {
      color: 'green',
      label: 'Low AI Risk',
      icon: CheckCircle,
      bg: 'bg-green-400/10 border-green-400/25',
      text: 'text-green-300',
      desc: 'Content appears predominantly human-written. Minor patterns detected are within normal range.',
    },
  };
  const risk = riskConfig[riskLevel];

  // Compute "vs average" badges
  const aiDiff = scan && !aiPending ? aiPercent - avgAiScore : null;
  const plagDiff = scan ? (scan.plagiarismScore - avgPlagiarismScore) : null;

  // Detection level badge colors
  const levelColors: Record<number, string> = {
    1: 'bg-slate-600/30 text-slate-400',
    2: 'bg-blue-500/20 text-blue-400',
    3: 'bg-amber-500/20 text-amber-400',
  };

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Article Header */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-200">
                {article.title}
              </h1>
              <StatusBadge status={article.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-400">
              <Link
                href={`/writers/${article.writer.id}`}
                className="hover:text-teal-400"
              >
                By {article.writer.name}
              </Link>
              <span>
                {article.wordCount?.toLocaleString() ?? '—'} words
              </span>
              <span>
                Detected{' '}
                {format(new Date(article.detectedAt), 'MMM d, yyyy h:mm a')}
              </span>
              <a
                href={article.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-teal-500 hover:text-teal-400"
              >
                Open in Drive
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Action Buttons */}
          <ArticleActions
            articleId={article.id}
            currentStatus={article.status}
            aiDetectionLevel={detectionLevel}
          />
        </div>
      </div>

      {/* Scan Summary Cards */}
      {scan && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* AI Detection */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/60 p-6">
            {aiPending ? (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-600">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300">AI Detection</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Analyzing... results pending
                  </p>
                </div>
              </>
            ) : (
              <>
                <ScoreGauge
                  score={aiScore * 100}
                  label="AI Score"
                  invertColors
                  size="lg"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-300">AI Detection</p>
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${levelColors[detectionLevel] ?? levelColors[2]}`}>
                      Level {detectionLevel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {(aiScore * 100).toFixed(1)}% AI · {(humanScore * 100).toFixed(1)}% Human
                  </p>
                  {aiDiff !== null && (
                    <p className={`mt-0.5 text-[10px] font-medium ${
                      aiDiff > 0 ? 'text-red-300' : 'text-green-300'
                    }`}>
                      {aiDiff > 0 ? '↑' : '↓'} {Math.abs(aiDiff).toFixed(1)}% {aiDiff > 0 ? 'above' : 'below'} avg
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Plagiarism */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/60 p-6">
            <ScoreGauge
              score={scan.plagiarismScore}
              label="Plagiarism"
              invertColors
              size="lg"
            />
            <div>
              <p className="text-sm font-medium text-slate-300">Plagiarism</p>
              <p className="mt-1 text-xs text-slate-500">
                {scan.plagiarismScore.toFixed(1)}% matched ·{' '}
                {scan.matchedWords}/{scan.totalWords} words
              </p>
              {plagDiff !== null && (
                <p className={`mt-0.5 text-[10px] font-medium ${
                  plagDiff > 0 ? 'text-red-300' : 'text-green-300'
                }`}>
                  {plagDiff > 0 ? '↑' : '↓'} {Math.abs(plagDiff).toFixed(1)}% {plagDiff > 0 ? 'above' : 'below'} avg
                </p>
              )}
            </div>
          </div>

          {/* Reading Stats */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/60 p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-600 bg-slate-700/50">
              <BookOpen className="h-6 w-6 text-teal-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">Reading Stats</p>
              <p className="mt-1 text-xs text-slate-500">
                {wordCount.toLocaleString()} words
              </p>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                ~{readingTime} min read
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PDF Report Link */}
      {scan?.pdfReportUrl && (
        <a
          href={scan.pdfReportUrl}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
        >
          <Download className="h-4 w-4" />
          Download PDF Report
        </a>
      )}

      {/* ========== AI DETECTION DEEP DIVE ========== */}
      {scan && !aiPending && totalParas > 0 && (
        <div className="space-y-6">
          {/* Risk Assessment Banner */}
          <div className={`rounded-xl border p-5 ${risk.bg}`}>
            <div className="flex items-start gap-3">
              <risk.icon className={`mt-0.5 h-5 w-5 shrink-0 ${risk.text}`} />
              <div>
                <h3 className={`text-sm font-semibold ${risk.text}`}>
                  {risk.label} — {aiPercent.toFixed(0)}% AI Detected
                </h3>
                <p className="mt-1 text-sm text-slate-400">{risk.desc}</p>
              </div>
            </div>
          </div>

          {/* AI Detection Breakdown */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
                  <BarChart3 className="h-5 w-5 text-teal-500" />
                  AI Detection Breakdown
                </h2>
                {/* Detection Level Info Tooltip */}
                <div className="group relative">
                  <Info className="h-4 w-4 cursor-help text-slate-500 hover:text-slate-300" />
                  <div className="invisible absolute left-0 top-6 z-50 w-80 rounded-lg border border-slate-600 bg-slate-800 p-4 shadow-xl group-hover:visible">
                    <p className="mb-2 text-xs font-semibold text-slate-200">AI Detection Sensitivity Levels:</p>
                    <div className="space-y-2 text-xs text-slate-400">
                      <div>
                        <span className="font-semibold text-slate-300">Level 1 — Basic:</span>{' '}
                        Only catches content copied straight from ChatGPT, Gemini, or other AI tools with zero edits
                      </div>
                      <div>
                        <span className="font-semibold text-blue-400">Level 2 — Standard (Default):</span>{' '}
                        Catches AI-generated content with minor tweaks — tense changes, added words, light editing
                      </div>
                      <div>
                        <span className="font-semibold text-amber-400">Level 3 — Strict:</span>{' '}
                        Catches heavily modified AI content — paraphrased, tool-rewritten, or substantially edited AI text
                      </div>
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${levelColors[detectionLevel] ?? levelColors[2]}`}>
                  Level {detectionLevel}
                </span>
              </div>
              <span className="text-sm text-slate-500">
                {totalParas} section{totalParas !== 1 ? 's' : ''} analyzed
              </span>
            </div>

            {/* Visual breakdown bar */}
            <div className="mb-4">
              <div className="flex h-8 w-full overflow-hidden rounded-lg">
                {aiCount > 0 && (
                  <div
                    className="flex items-center justify-center bg-red-500/80 text-xs font-medium text-white transition-all"
                    style={{ width: `${(aiCount / totalParas) * 100}%` }}
                  >
                    {aiCount > 0 && `${aiCount} AI`}
                  </div>
                )}
                {mixedCount > 0 && (
                  <div
                    className="flex items-center justify-center bg-yellow-500/80 text-xs font-medium text-white transition-all"
                    style={{ width: `${(mixedCount / totalParas) * 100}%` }}
                  >
                    {mixedCount > 0 && `${mixedCount} Mixed`}
                  </div>
                )}
                {humanCount > 0 && (
                  <div
                    className="flex items-center justify-center bg-green-500/80 text-xs font-medium text-white transition-all"
                    style={{ width: `${(humanCount / totalParas) * 100}%` }}
                  >
                    {humanCount > 0 && `${humanCount} Human`}
                  </div>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="mb-6 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-red-300" />
                <span className="text-slate-400">
                  <span className="font-semibold text-red-300">{aiCount}</span> AI-Generated Section{aiCount !== 1 ? 's' : ''}
                </span>
              </div>
              {mixedCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-300" />
                  <span className="text-slate-400">
                    <span className="font-semibold text-yellow-300">{mixedCount}</span> Mixed
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-green-300" />
                <span className="text-slate-400">
                  <span className="font-semibold text-green-300">{humanCount}</span> Human-Written Section{humanCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Full Article with Inline Highlighting */}
            {cleanContent && paragraphRanges.length > 0 ? (
              <div className="mt-2">
                <p className="mb-4 text-xs text-slate-500">
                  Paragraphs color-coded by classification. Dotted underlines mark specific AI-flagged phrases — hover for details.
                </p>
                <HighlightedArticle
                  content={cleanContent}
                  paragraphRanges={paragraphRanges}
                  phraseHighlights={phraseHighlights}
                />
              </div>
            ) : (
              <p className="mt-4 text-xs italic text-slate-600">
                Full article highlighting not available — content will appear for newly scanned articles
              </p>
            )}
          </div>


        </div>
      )}

      {/* AI Pending message */}
      {scan && aiPending && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-300">
                AI Detection Analysis in Progress
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Copyleaks is analyzing this content for AI-generated patterns. Results typically arrive within 2-5 minutes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plagiarism Sources — Internet */}
      {internetSources.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-200">
            Internet Sources ({internetSources.length})
          </h2>
          <div className="space-y-2">
            {internetSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between rounded-lg border border-slate-700/50 p-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Globe className="h-4 w-4 shrink-0 text-teal-500" />
                  <div className="min-w-0">
                    <a
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm text-teal-500 hover:text-teal-400"
                    >
                      {source.sourceTitle || source.sourceUrl}
                    </a>
                    <p className="truncate text-xs text-slate-500">
                      {source.sourceUrl}
                    </p>
                  </div>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <span
                    className={`text-sm font-semibold ${
                      source.percentage > 10
                        ? 'text-red-300'
                        : source.percentage > 5
                        ? 'text-yellow-300'
                        : 'text-slate-300'
                    }`}
                  >
                    {source.percentage.toFixed(1)}%
                  </span>
                  <p className="text-xs text-slate-500">
                    {source.matchedWords} words
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plagiarism Sources — Internal Database */}
      {databaseSources.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-200">
            Internal Database Matches ({databaseSources.length})
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            These matches are from Copyleaks&apos; shared document database, not public websites.
          </p>
          <div className="space-y-2">
            {databaseSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between rounded-lg border border-slate-700/50 p-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Database className="h-4 w-4 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <span className="block truncate text-sm text-slate-400">
                      {source.sourceTitle || 'Internal Database Match'}
                    </span>
                  </div>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <span className="text-sm font-semibold text-slate-400">
                    {source.percentage.toFixed(1)}%
                  </span>
                  <p className="text-xs text-slate-500">
                    {source.matchedWords} words
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No sources but plagiarism score is 0 */}
      {scan && scan.sources.length === 0 && scan.plagiarismScore === 0 && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6 text-center">
          <p className="text-sm text-green-300">
            ✅ No plagiarism sources detected — this content appears to be original.
          </p>
        </div>
      )}

      {/* No scan results message */}
      {!scan && (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm text-slate-400">
            {article.status === 'SCANNING'
              ? 'Scan in progress… Results will appear here when complete.'
              : article.status === 'ERROR'
              ? 'Scan failed. The article will be retried automatically.'
              : 'This article has not been scanned yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
