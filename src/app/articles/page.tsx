import Link from 'next/link';
import { prisma } from '@/lib/db';
import { StatusBadge } from '@/components/status-badge';
import { formatDistanceToNow } from 'date-fns';
import { FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Detected', value: 'DETECTED' },
  { label: 'Scanning', value: 'SCANNING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Flagged', value: 'FLAGGED' },
  { label: 'Approved', value: 'APPROVED' },
] as const;

const levelBadgeColors: Record<number, string> = {
  1: 'bg-slate-600/30 text-slate-400',
  2: 'bg-blue-500/20 text-blue-400',
  3: 'bg-amber-500/20 text-amber-400',
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const where = status ? { status: status as any } : {};

  const articles = await prisma.article.findMany({
    where,
    orderBy: { detectedAt: 'desc' },
    include: {
      writer: { select: { id: true, name: true } },
      scanResult: {
        select: {
          aiScore: true,
          plagiarismScore: true,
          grammarScore: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-200">Articles</h1>
        <p className="text-sm text-slate-400">
          All detected articles and their scan results
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = (status || '') === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.value ? `/articles?status=${tab.value}` : '/articles'}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Articles Table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-4 font-medium">Title</th>
                <th className="p-4 font-medium">Writer</th>
                <th className="p-4 font-medium text-center">Status</th>
                <th className="p-4 font-medium text-center">AI %</th>
                <th className="p-4 font-medium text-center">Plagiarism %</th>
                <th className="p-4 font-medium text-center">Grammar</th>
                <th className="p-4 font-medium">Detected</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => {
                const level = article.aiDetectionLevel ?? 2;
                return (
                  <tr
                    key={article.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/20"
                  >
                    <td className="p-4">
                      <Link
                        href={`/articles/${article.id}`}
                        className="font-medium text-slate-200 hover:text-teal-400"
                      >
                        {article.title}
                      </Link>
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/writers/${article.writer.id}`}
                        className="text-slate-400 hover:text-teal-400"
                      >
                        {article.writer.name}
                      </Link>
                    </td>
                    <td className="p-4 text-center">
                      <StatusBadge status={article.status} />
                    </td>
                    <td className="p-4 text-center text-slate-300">
                      {article.scanResult ? (
                        <span className="inline-flex items-center gap-1">
                          {(article.scanResult.aiScore * 100).toFixed(0)}%
                          <span className={`inline-flex rounded px-1 py-0.5 text-[10px] font-semibold leading-none ${levelBadgeColors[level] ?? levelBadgeColors[2]}`}>
                            L{level}
                          </span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-4 text-center text-slate-300">
                      {article.scanResult
                        ? `${article.scanResult.plagiarismScore.toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="p-4 text-center text-slate-300">
                      {article.scanResult?.grammarScore != null
                        ? article.scanResult.grammarScore.toFixed(0)
                        : '—'}
                    </td>
                    <td className="p-4 text-slate-500">
                      {formatDistanceToNow(new Date(article.detectedAt), {
                        addSuffix: true,
                      })}
                    </td>
                  </tr>
                );
              })}
              {articles.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                    {status
                      ? `No articles with status "${status}"`
                      : 'No articles detected yet'}
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
