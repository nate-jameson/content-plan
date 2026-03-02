import { cn } from '@/lib/utils';
import type { ArticleStatus } from '@/types';

const statusConfig: Record<
  ArticleStatus,
  { label: string; className: string }
> = {
  DETECTED: {
    label: 'Detected',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  QUEUED: {
    label: 'Queued',
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
  SCANNING: {
    label: 'Scanning',
    className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  },
  REVIEWED: {
    label: 'Reviewed',
    className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-green-500/10 text-green-400 border-green-500/20',
  },
  FLAGGED: {
    label: 'Flagged',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  ERROR: {
    label: 'Error',
    className: 'bg-red-500/10 text-red-300 border-red-500/20',
  },
};

interface StatusBadgeProps {
  status: ArticleStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.DETECTED;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
