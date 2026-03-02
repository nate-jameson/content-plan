'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Flag, RotateCcw } from 'lucide-react';
import type { ArticleStatus } from '@/types';

export function ArticleActions({
  articleId,
  currentStatus,
}: {
  articleId: string;
  currentStatus: ArticleStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(newStatus: ArticleStatus) {
    setLoading(newStatus);
    try {
      await fetch(`/api/articles/${articleId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const canReview = ['COMPLETED', 'REVIEWED'].includes(currentStatus);
  const canFlag = ['COMPLETED', 'REVIEWED', 'APPROVED'].includes(currentStatus);
  const canRequestRevision = ['COMPLETED', 'REVIEWED', 'FLAGGED'].includes(currentStatus);

  return (
    <div className="flex gap-2">
      {canReview && (
        <button
          onClick={() => updateStatus('APPROVED')}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {loading === 'APPROVED' ? 'Approving…' : 'Approve'}
        </button>
      )}
      {canFlag && (
        <button
          onClick={() => updateStatus('FLAGGED')}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
        >
          <Flag className="h-4 w-4" />
          {loading === 'FLAGGED' ? 'Flagging…' : 'Flag'}
        </button>
      )}
      {canRequestRevision && (
        <button
          onClick={() => updateStatus('QUEUED')}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          {loading === 'QUEUED' ? 'Requesting…' : 'Request Revision'}
        </button>
      )}
    </div>
  );
}
