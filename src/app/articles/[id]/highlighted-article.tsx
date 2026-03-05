'use client';

import { useState } from 'react';
import { Bot, AlertTriangle, User, Info } from 'lucide-react';

interface LocalPhrase {
  localStart: number;
  localEnd: number;
  phrase: string;
  ratio: number;
  aiFreq: number;
  humanFreq: number;
}

interface Paragraph {
  id: string;
  classification: string;
  aiProbability: number;
  text: string | null;
  paragraphIndex: number;
  localPhrases: LocalPhrase[];
}

interface HighlightedArticleProps {
  paragraphs: Paragraph[];
}

function HighlightedParagraph({
  text,
  phrases,
}: {
  text: string;
  phrases: LocalPhrase[];
}) {
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  if (!phrases.length) {
    return <span>{text}</span>;
  }

  // Sort by position, remove overlaps, validate bounds
  const sorted = [...phrases].sort((a, b) => a.localStart - b.localStart);
  const filtered: LocalPhrase[] = [];
  let lastEnd = -1;
  for (const m of sorted) {
    if (m.localStart >= lastEnd && m.localStart >= 0 && m.localEnd <= text.length) {
      filtered.push(m);
      lastEnd = m.localEnd;
    }
  }

  const segments: React.ReactNode[] = [];
  let cursor = 0;

  filtered.forEach((m, i) => {
    if (m.localStart > cursor) {
      segments.push(<span key={`t-${i}`}>{text.slice(cursor, m.localStart)}</span>);
    }

    const isHigh = m.ratio >= 10;
    const isMed = m.ratio >= 5;

    segments.push(
      <span
        key={`h-${i}`}
        className={`relative cursor-help border-b-2 border-dotted ${
          isHigh
            ? 'bg-red-500/20 border-red-400/60'
            : isMed
            ? 'bg-yellow-500/15 border-yellow-400/50'
            : 'bg-blue-500/10 border-blue-400/40'
        }`}
        onMouseEnter={() => setActiveTooltip(i)}
        onMouseLeave={() => setActiveTooltip(null)}
      >
        {text.slice(m.localStart, m.localEnd)}
        {activeTooltip === i && (
          <span className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs shadow-xl">
            <span className="flex items-center gap-2">
              <Info className="h-3 w-3 text-teal-400" />
              <span className={`font-bold ${
                isHigh ? 'text-red-400' : isMed ? 'text-yellow-400' : 'text-slate-300'
              }`}>
                {m.ratio.toFixed(1)}× more likely AI
              </span>
            </span>
            <span className="mt-1 flex gap-3 text-slate-500">
              <span>AI: {m.aiFreq.toFixed(1)}/1M</span>
              <span>Human: {m.humanFreq.toFixed(1)}/1M</span>
            </span>
          </span>
        )}
      </span>
    );

    cursor = m.localEnd;
  });

  if (cursor < text.length) {
    segments.push(<span key="tail">{text.slice(cursor)}</span>);
  }

  return <span>{segments}</span>;
}

export function HighlightedArticle({ paragraphs }: HighlightedArticleProps) {
  return (
    <div className="prose prose-sm prose-invert max-w-none space-y-0">
      {paragraphs.map((para, idx) => {
        const isAi = para.classification === 'ai';
        const isMixed = para.classification === 'mixed';
        const isHuman = para.classification === 'human';
        const prob = para.aiProbability * 100;
        const hasRealText = para.text && !para.text.startsWith('[Section');

        if (!hasRealText) {
          return (
            <div
              key={para.id}
              className="border-l-2 border-slate-700 py-2 pl-4 text-xs italic text-slate-600"
            >
              [Section {idx + 1} — text not available for pre-existing articles]
            </div>
          );
        }

        return (
          <div
            key={para.id}
            className={`group relative border-l-2 py-2 pl-4 transition-colors ${
              isAi
                ? 'border-red-500/60 bg-red-500/[0.07] hover:bg-red-500/[0.12]'
                : isMixed
                ? 'border-yellow-500/50 bg-yellow-500/[0.05] hover:bg-yellow-500/[0.10]'
                : 'border-green-500/20 bg-transparent hover:bg-green-500/[0.04]'
            }`}
          >
            {/* Classification badge */}
            <div
              className={`mb-1 flex items-center gap-2 text-xs ${
                isHuman
                  ? 'opacity-0 transition-opacity group-hover:opacity-100'
                  : ''
              }`}
            >
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                  isAi
                    ? 'bg-red-500/20 text-red-400'
                    : isMixed
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-green-500/15 text-green-500'
                }`}
              >
                {isAi ? (
                  <Bot className="h-3 w-3" />
                ) : isMixed ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <User className="h-3 w-3" />
                )}
                {isAi ? 'AI' : isMixed ? 'Mixed' : 'Human'}
                <span className="ml-0.5 opacity-70">{prob.toFixed(0)}%</span>
              </span>
            </div>
            <p
              className={`text-sm leading-relaxed ${
                isAi
                  ? 'text-slate-200'
                  : isMixed
                  ? 'text-slate-200'
                  : 'text-slate-300'
              }`}
            >
              <HighlightedParagraph
                text={para.text!}
                phrases={para.localPhrases}
              />
            </p>
          </div>
        );
      })}
    </div>
  );
}
