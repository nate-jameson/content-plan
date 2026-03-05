'use client';

export function Sparkline({
  data,
  color = '#14b8a6',
  width = 200,
  height = 60,
}: {
  data: { label: string; value: number }[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <span className="text-xs text-slate-500">Not enough data</span>
    );
  }

  const padding = 4;
  const dotRadius = 3;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = Math.min(...data.map((d) => d.value), 0);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (d.value - minVal) / range) * (height - padding * 2);
    return { x, y, label: d.label, value: d.value };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ maxWidth: width, height }}
      preserveAspectRatio="none"
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={dotRadius} fill={color} />
          <title>
            {p.label}: {p.value.toFixed(1)}%
          </title>
        </g>
      ))}
    </svg>
  );
}
