'use client';

import { useState } from 'react';
import { Bot, AlertTriangle, User, Info } from 'lucide-react';

interface ExplainPhrase {
  phrase: string;
  ratio: number;
  aiFreq: number;
  humanFreq: number;
  charStart: number;
  charEnd: number;
}

interface Paragraph {
  id: string;
  classification: string;
  aiProbability: number;
  text: string | null;
  paragraphIndex: number;
}

interface HighlightedArticleProps {
  paragraphs: Paragraph[];
  explainPhrases: ExplainPhrase[];
  cleanContent: string;
}

// Compute which character range each paragraph covers in the full content
function mapParagraphRanges(paragraphs: Paragraph[], fullContent: string) {
  const ranges: { start: number; end: number }[] = [];
  let searchFrom = 0;

  for (const para of paragraphs) {
    if (!para.text) {
      ranges.push({ start: -1, end: -1 });
      continue;
    }

    // Find this paragraph's text in the full content
    // Use a trimmed version for matching to handle whitespace differences
    const trimmedPara = para.text.trim();
    if (!trimmedPara) {
      ranges.push({ start: -1, end: -1 });
      continue;
    }

    // Try exact match first
    let idx = fullContent.indexOf(trimmedPara, searchFrom);

    // If not found, try first 50 chars (paragraph text may have been truncated differently)
    if (idx === -1 && trimmedPara.length > 50) {
      const prefix = trimmedPara.substring(0, 50);
      idx = fullContent.indexOf(prefix, searchFrom);
    }

    if (idx >= 0) {
      const end = idx + trimmedPara.length;
      ranges.push({ start: idx, end });
      searchFrom = end;
    } else {
      ranges.push({ start: -1, end: -1 });
    }
  }

  return ranges;
}

function HighlightedParagraph({
  text,
  phrases,
}: {
  text: string;
  phrases: { localStart: number; localEnd: number; phrase: ExplainPhrase }[];
}) {
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  if (!phrases.length) {
    return <span>{text}</span>;
  }

  // Sort by position, remove overlaps
  const sorted = [...phrases].sort((a, b) => a.localStart - b.localStart);
  const filtered: typeof sorted = [];
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

    const p = m.phrase;
    const isHigh = p.ratio >= 10;
    const isMed = p.ratio >= 5;

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
                {p.ratio.toFixed(1)}× more likely AI
              </span>
            </span>
            <span className="mt-1 flex gap-3 text-slate-500">
              <span>AI: {p.aiFreq.toFixed(1)}/1M</span>
              <span>Human: {p.humanFreq.toFixed(1)}/1M</span>
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

export function HighlightedArticle({
  paragraphs,
  explainPhrases,
  cleanContent,
}: HighlightedArticleProps) {
  // Map each paragraph to its character range in the full content
  const paraRanges = mapParagraphRanges(paragraphs, cleanContent);

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

        // Find which explain phrases fall within this paragraph's range
        const paraRange = paraRanges[idx];
        const localPhrases: { localStart: number; localEnd: number; phrase: ExplainPhrase }[] = [];

        if (paraRange.start >= 0) {
          for (const ep of explainPhrases) {
            // Check if this phrase overlaps with this paragraph
            if (ep.charStart >= paraRange.start && ep.charEnd <= paraRange.end) {
              localPhrases.push({
                localStart: ep.charStart - paraRange.start,
                localEnd: ep.charEnd - paraRange.start,
                phrase: ep,
              });
            }
          }
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
                phrases={localPhrases}
              />
            </p>
          </div>
        );
      })}
    </div>
  );
}
