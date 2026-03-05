'use client';

import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number; // 0-100
  label: string;
  invertColors?: boolean; // For AI score: low = green
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getColor(score: number, invert: boolean): string {
  const effective = invert ? 100 - score : score;
  if (effective >= 80) return 'text-green-300';
  if (effective >= 50) return 'text-yellow-300';
  return 'text-red-300';
}

function getStrokeColor(score: number, invert: boolean): string {
  const effective = invert ? 100 - score : score;
  if (effective >= 80) return 'stroke-green-400';
  if (effective >= 50) return 'stroke-yellow-400';
  return 'stroke-red-400';
}

const sizeMap = {
  sm: { width: 56, stroke: 4, fontSize: 'text-xs' },
  md: { width: 72, stroke: 5, fontSize: 'text-sm' },
  lg: { width: 96, stroke: 6, fontSize: 'text-base' },
};

export function ScoreGauge({
  score,
  label,
  invertColors = false,
  size = 'md',
  className,
}: ScoreGaugeProps) {
  const { width, stroke, fontSize } = sizeMap[size];
  const radius = (width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const dashOffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width, height: width }}>
        <svg
          width={width}
          height={width}
          className="-rotate-90"
          viewBox={`0 0 ${width} ${width}`}
        >
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-slate-700"
          />
          {/* Score arc */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={cn(
              'transition-all duration-700 ease-out',
              getStrokeColor(clampedScore, invertColors)
            )}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              'font-bold',
              fontSize,
              getColor(clampedScore, invertColors)
            )}
          >
            {Math.round(clampedScore)}
          </span>
        </div>
      </div>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}
