import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { StatusBadge } from '@/components/status-badge';
import { ScoreGauge } from '@/components/score-gauge';
import { ArticleActions } from './article-actions';
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

  const scan = article.scanResult;
  const aiPending = scan && scan.aiScore < 0; // -1 means export pending
  const aiScore = aiPending ? 0 : (scan?.aiScore ?? 0);
  const humanScore = aiPending ? 0 : (scan?.humanScore ?? 0);

  // Separate internet vs database sources
  const internetSources = scan?.sources.filter((s) => s.isInternetSource) ?? [];
  const databaseSources = scan?.sources.filter((s) => !s.isInternetSource) ?? [];

  // AI paragraph stats
  const aiParas = scan?.paragraphs ?? [];
  const aiCount = aiParas.filter((p) => p.classification === 'ai').length;
  const humanCount = aiParas.filter((p) => p.classification === 'human').length;
  const mixedCount = aiParas.filter((p) => p.classification === 'mixed').length;
  const totalParas = aiParas.length;

  // Extract explain patterns from raw response
  const rawResponse = scan?.rawResponse as any;
  const explainPatterns = rawResponse?.explain?.patterns;

  // Determine AI risk level
  const aiPercent = aiScore * 100;
  const riskLevel =
    aiPercent >= 70 ? 'high' : aiPercent >= 40 ? 'medium' : 'low';
  const riskConfig = {
    high: {
      color: 'red',
      label: 'High AI Risk',
      icon: AlertTriangle,
      bg: 'bg-red-500/10 border-red-500/30',
      text: 'text-red-400',
      desc: 'This content has significant indicators of AI generation. Recommend thorough manual review and potential rewrite.',
    },
    medium: {
      color: 'yellow',
      label: 'Moderate AI Risk',
      icon: AlertTriangle,
      bg: 'bg-yellow-500/10 border-yellow-500/30',
      text: 'text-yellow-400',
      desc: 'Some sections show AI-like patterns. Review flagged paragraphs and consider targeted edits.',
    },
    low: {
      color: 'green',
      label: 'Low AI Risk',
      icon: CheckCircle,
      bg: 'bg-green-500/10 border-green-500/30',
      text: 'text-green-400',
      desc: 'Content appears predominantly human-written. Minor patterns detected are within normal range.',
    },
  };
  const risk = riskConfig[riskLevel];

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
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-100">
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
          <ArticleActions articleId={article.id} currentStatus={article.status} />
        </div>
      </div>

      {/* Scan Summary Cards */}
      {scan && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* AI Detection */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
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
                  <p className="text-sm font-medium text-slate-300">AI Detection</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(aiScore * 100).toFixed(1)}% AI · {(humanScore * 100).toFixed(1)}% Human
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Plagiarism / Originality */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <ScoreGauge
              score={100 - scan.plagiarismScore}
              label="Originality"
              size="lg"
            />
            <div>
              <p className="text-sm font-medium text-slate-300">Plagiarism</p>
              <p className="mt-1 text-xs text-slate-500">
                {scan.plagiarismScore.toFixed(1)}% matched ·{' '}
                {scan.matchedWords}/{scan.totalWords} words
              </p>
            </div>
          </div>

          {/* Writing Quality */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <ScoreGauge
              score={scan.grammarScore ?? 0}
              label="Grammar"
              size="lg"
            />
            <div>
              <p className="text-sm font-medium text-slate-300">Writing Quality</p>
              <p className="mt-1 text-xs text-slate-500">
                {scan.readabilityGrade
                  ? `${scan.readabilityGrade} level`
                  : 'No readability data'}
                {scan.readingTimeMinutes != null &&
                  ` · ${scan.readingTimeMinutes.toFixed(0)} min read`}
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
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                <BarChart3 className="h-5 w-5 text-teal-500" />
                AI Detection Breakdown
              </h2>
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
                <Bot className="h-4 w-4 text-red-400" />
                <span className="text-slate-400">
                  <span className="font-semibold text-red-400">{aiCount}</span> AI-Generated Section{aiCount !== 1 ? 's' : ''}
                </span>
              </div>
              {mixedCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <span className="text-slate-400">
                    <span className="font-semibold text-yellow-400">{mixedCount}</span> Mixed
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-green-400" />
                <span className="text-slate-400">
                  <span className="font-semibold text-green-400">{humanCount}</span> Human-Written Section{humanCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Paragraph-by-paragraph analysis */}
            <div className="space-y-3">
              {aiParas.map((para, idx) => {
                const isAi = para.classification === 'ai';
                const isMixed = para.classification === 'mixed';
                const prob = para.aiProbability * 100;
                const hasRealText = para.text && !para.text.startsWith('[Section');
                
                return (
                  <div
                    key={para.id}
                    className={`rounded-lg border p-4 ${
                      isAi
                        ? 'border-red-500/30 bg-red-500/5'
                        : isMixed
                        ? 'border-yellow-500/30 bg-yellow-500/5'
                        : 'border-green-500/30 bg-green-500/5'
                    }`}
                  >
                    {/* Header row */}
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isAi
                              ? 'bg-red-500/20 text-red-400'
                              : isMixed
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}
                        >
                          {isAi ? (
                            <Bot className="h-3 w-3" />
                          ) : isMixed ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <User className="h-3 w-3" />
                          )}
                          {isAi ? 'AI Generated' : isMixed ? 'Mixed' : 'Human Written'}
                        </span>
                        <span className="text-xs text-slate-600">
                          Section {idx + 1}
                        </span>
                      </div>
                      
                      {/* Confidence bar */}
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isAi
                                ? 'bg-red-500'
                                : isMixed
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${isAi || isMixed ? prob : 100 - prob}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium tabular-nums ${
                            isAi ? 'text-red-400' : isMixed ? 'text-yellow-400' : 'text-green-400'
                          }`}
                        >
                          {prob.toFixed(0)}% AI
                        </span>
                      </div>
                    </div>

                    {/* Text content */}
                    {hasRealText ? (
                      <p className={`text-sm leading-relaxed ${
                        isAi ? 'text-red-200/80' : isMixed ? 'text-yellow-200/80' : 'text-green-200/80'
                      }`}>
                        {para.text.length > 800
                          ? para.text.substring(0, 800) + '…'
                          : para.text}
                      </p>
                    ) : (
                      <p className="text-xs italic text-slate-600">
                        Text preview not available — content will appear for newly scanned articles
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Pattern Analysis (if explain data available) */}
          {explainPatterns?.statistics && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
                <Bot className="h-5 w-5 text-teal-500" />
                AI Pattern Analysis
              </h2>
              <p className="mb-4 text-sm text-slate-500">
                Copyleaks identified {explainPatterns.statistics.aiCount?.length ?? 0} writing patterns.
                Each pattern&apos;s frequency is compared against known AI vs. human writing distributions.
              </p>
              <div className="space-y-2">
                {(explainPatterns.statistics.aiCount as number[])?.map((aiFreq: number, i: number) => {
                  const humanFreq = (explainPatterns.statistics.humanCount as number[])?.[i] ?? 0;
                  const total = aiFreq + humanFreq;
                  const aiPct = total > 0 ? (aiFreq / total) * 100 : 0;
                  const isAiDominant = aiPct > 60;
                  
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-right text-xs text-slate-500">
                        Pattern {i + 1}
                      </span>
                      <div className="flex h-5 flex-1 overflow-hidden rounded bg-slate-700/50">
                        <div
                          className="bg-red-500/60 transition-all"
                          style={{ width: `${aiPct}%` }}
                          title={`AI: ${aiFreq.toFixed(1)} per 1M`}
                        />
                        <div
                          className="bg-green-500/60 transition-all"
                          style={{ width: `${100 - aiPct}%` }}
                          title={`Human: ${humanFreq.toFixed(1)} per 1M`}
                        />
                      </div>
                      <span className={`w-16 shrink-0 text-xs font-medium ${isAiDominant ? 'text-red-400' : 'text-green-400'}`}>
                        {aiPct.toFixed(0)}% AI
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-red-500/60" /> AI pattern frequency
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-green-500/60" /> Human pattern frequency
                </span>
              </div>
            </div>
          )}
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
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">
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
                        ? 'text-red-400'
                        : source.percentage > 5
                        ? 'text-yellow-400'
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
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">
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
          <p className="text-sm text-green-400">
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
