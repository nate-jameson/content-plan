import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AddWriterForm } from './add-writer-form';
import { WriterToggle } from './writer-toggle';
import { ExternalLink, FolderOpen, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function WritersPage() {
  const writers = await prisma.writer.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { articles: true } },
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-200">Writers</h1>
          <p className="text-sm text-slate-400">
            Manage content writers and their Google Drive folders
          </p>
        </div>
      </div>

      {/* Add Writer Form */}
      <AddWriterForm />

      {/* Writers List */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-4 font-medium">Writer</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Drive Folder</th>
                <th className="p-4 font-medium text-center">Articles</th>
                <th className="p-4 font-medium text-center">Avg AI %</th>
                <th className="p-4 font-medium text-center">Avg Plag %</th>
                <th className="p-4 font-medium text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {writers.map((writer) => (
                <tr
                  key={writer.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/20"
                >
                  <td className="p-4">
                    <Link
                      href={`/writers/${writer.id}`}
                      className="font-medium text-slate-200 hover:text-teal-400"
                    >
                      {writer.name}
                    </Link>
                  </td>
                  <td className="p-4 text-slate-400">{writer.email || '—'}</td>
                  <td className="p-4">
                    <a
                      href={`https://drive.google.com/drive/folders/${writer.driveFolderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-teal-500 hover:text-teal-400"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs">
                        {writer.driveFolderId.slice(0, 12)}…
                      </span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="p-4 text-center text-slate-300">
                    {writer._count.articles}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={
                        writer.avgAiScore > 0.5
                          ? 'text-red-300'
                          : writer.avgAiScore > 0.2
                          ? 'text-yellow-300'
                          : 'text-green-300'
                      }
                    >
                      {(writer.avgAiScore * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={
                        writer.avgPlagiarism > 20
                          ? 'text-red-300'
                          : writer.avgPlagiarism > 10
                          ? 'text-yellow-300'
                          : 'text-green-300'
                      }
                    >
                      {writer.avgPlagiarism.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <WriterToggle writerId={writer.id} isActive={writer.isActive} />
                  </td>
                </tr>
              ))}
              {writers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Users className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                    No writers added yet. Use the form above to add one.
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
