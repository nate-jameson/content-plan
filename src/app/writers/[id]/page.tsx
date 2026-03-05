import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { StatusBadge } from '@/components/status-badge';
import { ScoreGauge } from '@/components/score-gauge';
import { Sparkline } from '@/components/sparkline';
import { formatDistanceToNow } from 'date-fns';
import { format } from 'date-fns';
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  FolderOpen,
  AlertTriangle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const levelBadgeColors: Record<number, string> = {
  1: 'bg-slate-600/30 text-slate-400',
  2: 'bg-blue-500/20 text-blue-400',
  3: 'bg-amber-500/20 text-amber-400',
};

export default async function WriterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const writer = await prisma.writer.findUnique({
    where: { id },
    include: {
      articles: {
        orderBy: { detectedAt: 'desc' },
        include: {
          scanResult: {
            select: {
              plagiarismScore: true,
              aiScore: true,
              grammarScore: true,
            },
          },
        },
      },
    },
  });

  if (!writer) {
    notFound();
  }

  const flaggedCount = writer.articles.filter(
    (a) => a.status === 'FLAGGED'
  ).length;

  // Get trend data: last 20 completed articles ordered by detected date
  const trendArticles = await prisma.article.findMany({
    where: {
      writerId: id,
      status: { in: ['COMPLETED', 'REVIEWED', 'APPROVED', 'FLAGGED'] },
    },
    orderBy: { detectedAt: 'asc' },
    take: 20,
    select: {
      detectedAt: true,
      scanResult: {
        select: {
          aiScore: true,
          plagiarismScore: true,
        },
      },
    },
  });

  const aiTrendData = trendArticles
    .filter((a) => a.scanResult)
    .map((a) => ({
      label: format(new Date(a.detectedAt), 'MMM d'),
      value: (a.scanResult!.aiScore * 100),
    }));

  const plagTrendData = trendArticles
    .filter((a) => a.scanResult)
    .map((a) => ({
      label: format(new Date(a.detectedAt), 'MMM d'),
      value: a.scanResult!.plagiarismScore,
    }));

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/writers"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Writers
      </Link>

      {/* Profile Header */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-xl font-bold text-white">
              {writer.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-200">
                {writer.name}
              </h1>
              {writer.email && <p className="text-sm text-slate-400">{writer.email}</p>}
              <a
                href={`https://drive.google.com/drive/folders/${writer.driveFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-teal-500 hover:text-teal-400"
              >
                <FolderOpen className="h-3 w-3" />
                Drive Folder
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex gap-6">
            <ScoreGauge
              score={writer.avgAiScore * 100}
              label="Avg AI %"
              invertColors
              size="md"
            />
            <ScoreGauge
              score={100 - writer.avgPlagiarism}
              label="Originality"
              size="md"
            />
            <ScoreGauge
              score={writer.avgGrammarScore}
              label="Grammar"
              size="md"
            />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Articles" value={writer.totalArticles} />
        <StatCard
          label="Avg AI Score"
          value={`${(writer.avgAiScore * 100).toFixed(0)}%`}
        />
        <StatCard
          label="Avg Plagiarism"
          value={`${writer.avgPlagiarism.toFixed(1)}%`}
        />
        <StatCard
          label="Flagged"
          value={flaggedCount}
          warn={flaggedCount > 0}
        />
      </div>

      {/* Score Trends */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-200">
          Score Trends
        </h2>
        {aiTrendData.length >= 2 ? (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-red-300">AI Detection %</p>
              <Sparkline data={aiTrendData} color="#f87171" width={600} height={60} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-amber-400">Plagiarism %</p>
              <Sparkline data={plagTrendData} color="#fbbf24" width={600} height={60} />
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-500">
            📈 Not enough completed articles for trend data yet
          </div>
        )}
      </div>

      {/* Article List */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-200">
          Articles ({writer.articles.length})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="pb-3 pr-4 font-medium">Title</th>
                <th className="pb-3 pr-4 font-medium text-center">Status</th>
                <th className="pb-3 pr-4 font-medium text-center">AI %</th>
                <th className="pb-3 pr-4 font-medium text-center">Plagiarism %</th>
                <th className="pb-3 pr-4 font-medium text-center">Grammar</th>
                <th className="pb-3 font-medium">Detected</th>
              </tr>
            </thead>
            <tbody>
              {writer.articles.map((article) => {
                const level = article.aiDetectionLevel ?? 2;
                return (
                  <tr
                    key={article.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/20"
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={`/articles/${article.id}`}
                        className="font-medium text-slate-200 hover:text-teal-400"
                      >
                        {article.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <StatusBadge status={article.status} />
                    </td>
                    <td className="py-3 pr-4 text-center text-slate-300">
                      {article.scanResult ? (
                        <span className="inline-flex items-center gap-1">
                          {(article.scanResult.aiScore * 100).toFixed(0)}%
                          <span className={`inline-flex rounded px-1 py-0.5 text-[10px] font-semibold leading-none ${levelBadgeColors[level] ?? levelBadgeColors[2]}`}>
                            L{level}
                          </span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-center text-slate-300">
                      {article.scanResult
                        ? `${article.scanResult.plagiarismScore.toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="py-3 pr-4 text-center text-slate-300">
                      {article.scanResult?.grammarScore != null
                        ? article.scanResult.grammarScore.toFixed(0)
                        : '—'}
                    </td>
                    <td className="py-3 text-slate-500">
                      {formatDistanceToNow(new Date(article.detectedAt), {
                        addSuffix: true,
                      })}
                    </td>
                  </tr>
                );
              })}
              {writer.articles.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-500"
                  >
                    No articles detected for this writer yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${
          warn ? 'text-red-300' : 'text-slate-200'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
