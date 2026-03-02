import Link from 'next/link';
import { prisma } from '@/lib/db';
import { StatusBadge } from '@/components/status-badge';
import { ScoreGauge } from '@/components/score-gauge';
import {
  FileText,
  Bot,
  ShieldAlert,
  Clock,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  const [
    totalArticles,
    pendingReview,
    avgScores,
    writers,
    recentArticles,
  ] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: 'COMPLETED' } }),
    prisma.scanResult.aggregate({
      _avg: {
        aiScore: true,
        plagiarismScore: true,
        grammarScore: true,
      },
    }),
    prisma.writer.findMany({
      where: { isActive: true },
      orderBy: { totalArticles: 'desc' },
      take: 15,
    }),
    prisma.article.findMany({
      orderBy: { detectedAt: 'desc' },
      take: 10,
      include: {
        writer: { select: { name: true } },
        scanResult: {
          select: {
            plagiarismScore: true,
            aiScore: true,
            grammarScore: true,
          },
        },
      },
    }),
  ]);

  return {
    totalArticles,
    pendingReview,
    avgAiScore: avgScores._avg.aiScore ?? 0,
    avgPlagiarism: avgScores._avg.plagiarismScore ?? 0,
    avgGrammar: avgScores._avg.grammarScore ?? 0,
    writers,
    recentArticles,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Content quality monitoring across all writers
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<FileText className="h-5 w-5 text-teal-500" />}
          label="Total Articles"
          value={data.totalArticles}
        />
        <SummaryCard
          icon={<Bot className="h-5 w-5 text-purple-400" />}
          label="Avg AI Score"
          value={`${(data.avgAiScore * 100).toFixed(0)}%`}
        />
        <SummaryCard
          icon={<ShieldAlert className="h-5 w-5 text-orange-400" />}
          label="Avg Plagiarism"
          value={`${data.avgPlagiarism.toFixed(1)}%`}
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-yellow-400" />}
          label="Pending Review"
          value={data.pendingReview}
        />
      </div>

      {/* Writer Leaderboard + Recent Articles */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Writer Leaderboard */}
        <div className="xl:col-span-2 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">
              Writer Leaderboard
            </h2>
            <Link
              href="/writers"
              className="text-sm text-teal-500 hover:text-teal-400"
            >
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Writer</th>
                  <th className="pb-3 pr-4 font-medium text-center">Articles</th>
                  <th className="pb-3 pr-4 font-medium text-center">Avg AI %</th>
                  <th className="pb-3 pr-4 font-medium text-center">Avg Plagiarism %</th>
                  <th className="pb-3 pr-4 font-medium text-center">Avg Grammar</th>
                  <th className="pb-3 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.writers.map((writer) => (
                  <tr
                    key={writer.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/20"
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={`/writers/${writer.id}`}
                        className="font-medium text-slate-100 hover:text-teal-400"
                      >
                        {writer.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-center text-slate-300">
                      {writer.totalArticles}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span
                        className={
                          writer.avgAiScore > 0.5
                            ? 'text-red-400'
                            : writer.avgAiScore > 0.2
                            ? 'text-yellow-400'
                            : 'text-green-400'
                        }
                      >
                        {(writer.avgAiScore * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span
                        className={
                          writer.avgPlagiarism > 20
                            ? 'text-red-400'
                            : writer.avgPlagiarism > 10
                            ? 'text-yellow-400'
                            : 'text-green-400'
                        }
                      >
                        {writer.avgPlagiarism.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span
                        className={
                          writer.avgGrammarScore >= 80
                            ? 'text-green-400'
                            : writer.avgGrammarScore >= 50
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }
                      >
                        {writer.avgGrammarScore.toFixed(0)}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          writer.isActive ? 'bg-green-400' : 'bg-slate-500'
                        }`}
                      />
                    </td>
                  </tr>
                ))}
                {data.writers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No writers added yet.{' '}
                      <Link href="/writers" className="text-teal-500 hover:underline">
                        Add your first writer
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Articles */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">
            Recent Articles
          </h2>
          <div className="space-y-3">
            {data.recentArticles.map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.id}`}
                className="block rounded-lg border border-slate-700/50 p-3 transition-colors hover:border-slate-600 hover:bg-slate-700/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-200 line-clamp-1">
                    {article.title}
                  </p>
                  <StatusBadge status={article.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {article.writer.name} ·{' '}
                  {formatDistanceToNow(new Date(article.detectedAt), {
                    addSuffix: true,
                  })}
                </p>
                {article.scanResult && (
                  <div className="mt-2 flex gap-4 text-xs text-slate-400">
                    <span>
                      AI: {(article.scanResult.aiScore * 100).toFixed(0)}%
                    </span>
                    <span>
                      Plag: {article.scanResult.plagiarismScore.toFixed(1)}%
                    </span>
                    {article.scanResult.grammarScore != null && (
                      <span>Grammar: {article.scanResult.grammarScore.toFixed(0)}</span>
                    )}
                  </div>
                )}
              </Link>
            ))}
            {data.recentArticles.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                No articles detected yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-100">{value}</p>
    </div>
  );
}
