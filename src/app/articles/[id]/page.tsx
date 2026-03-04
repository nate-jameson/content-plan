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

      {/* Paragraph-level AI Detection */}
      {scan && scan.paragraphs.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">
            Paragraph-Level AI Detection
          </h2>
          <div className="space-y-3">
            {scan.paragraphs.map((para) => (
              <div
                key={para.id}
                className={`rounded-lg border p-4 text-sm leading-relaxed ${
                  para.classification === 'ai'
                    ? 'border-red-500/30 bg-red-500/5 text-red-200'
                    : para.classification === 'mixed'
                    ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-200'
                    : 'border-green-500/30 bg-green-500/5 text-green-200'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      para.classification === 'ai'
                        ? 'bg-red-500/20 text-red-400'
                        : para.classification === 'mixed'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {para.classification === 'ai'
                      ? '🤖 AI Generated'
                      : para.classification === 'mixed'
                      ? '🔄 Mixed'
                      : '✍️ Human Written'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {(para.aiProbability * 100).toFixed(0)}% AI probability
                  </span>
                </div>
                <p>{para.text || `[Paragraph ${para.paragraphIndex + 1}]`}</p>
              </div>
            ))}
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
