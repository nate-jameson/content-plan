'use client';

import { useState, type ReactElement } from 'react';

interface ParagraphRange {
  startChar: number;
  endChar: number;
  classification: string;
  aiProbability: number;
}

interface PhraseHighlight {
  globalStart: number;
  globalEnd: number;
  phrase: string;
  ratio: number;
  aiFreq: number;
  humanFreq: number;
}

interface Props {
  content: string;
  paragraphRanges: ParagraphRange[];
  phraseHighlights: PhraseHighlight[];
}

export function HighlightedArticle({ content, paragraphRanges, phraseHighlights }: Props) {
  const [hoveredPhrase, setHoveredPhrase] = useState<number | null>(null);

  if (!content) {
    return <p className="text-sm italic text-slate-500">Article content not available.</p>;
  }

  // If no paragraph ranges, just show plain text
  if (paragraphRanges.length === 0) {
    return (
      <div className="prose prose-sm prose-invert max-w-none">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{content}</p>
      </div>
    );
  }

  // Render content paragraph by paragraph with highlighting
  return (
    <div className="space-y-1">
      {paragraphRanges.map((para, pIdx) => {
        const paraText = content.slice(para.startChar, para.endChar);
        if (!paraText.trim()) return null;

        const bgClass =
          para.classification === 'ai'
            ? 'bg-red-500/8 border-l-2 border-red-500/40'
            : para.classification === 'mixed'
            ? 'bg-yellow-500/8 border-l-2 border-yellow-500/40'
            : 'bg-green-500/5 border-l-2 border-green-500/20';

        // Find phrases that fall within this paragraph
        const paraPhrasesInRange = phraseHighlights.filter(
          (ph) => ph.globalStart >= para.startChar && ph.globalEnd <= para.endChar
        );

        // If no phrases in this paragraph, render plain
        if (paraPhrasesInRange.length === 0) {
          return (
            <div key={pIdx} className={`rounded-md px-4 py-3 ${bgClass}`}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                {paraText}
              </p>
            </div>
          );
        }

        // Sort phrases by position
        const sorted = [...paraPhrasesInRange].sort((a, b) => a.globalStart - b.globalStart);

        // Build fragments with highlights
        const fragments: ReactElement[] = [];
        let cursor = para.startChar;

        for (let i = 0; i < sorted.length; i++) {
          const ph = sorted[i];
          // Text before this phrase
          if (ph.globalStart > cursor) {
            fragments.push(
              <span key={`t-${i}`}>{content.slice(cursor, ph.globalStart)}</span>
            );
          }
          // The highlighted phrase
          const phraseIdx = phraseHighlights.indexOf(ph);
          const isHighRatio = ph.ratio >= 10;
          const isMedRatio = ph.ratio >= 5;
          const underlineColor = isHighRatio
            ? 'decoration-red-400/70'
            : isMedRatio
            ? 'decoration-yellow-400/70'
            : 'decoration-blue-400/70';

          fragments.push(
            <span
              key={`p-${i}`}
              className={`relative cursor-help underline decoration-dotted decoration-2 ${underlineColor}`}
              onMouseEnter={() => setHoveredPhrase(phraseIdx)}
              onMouseLeave={() => setHoveredPhrase(null)}
            >
              {content.slice(ph.globalStart, ph.globalEnd)}
              {hoveredPhrase === phraseIdx && (
                <span className="absolute -top-14 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs shadow-xl">
                  <span className={`font-semibold ${isHighRatio ? 'text-red-300' : isMedRatio ? 'text-yellow-300' : 'text-blue-300'}`}>
                    {ph.ratio.toFixed(1)}× more likely AI
                  </span>
                  <span className="ml-2 text-slate-500">
                    AI: {ph.aiFreq.toFixed(1)} · Human: {ph.humanFreq.toFixed(1)} per 1M
                  </span>
                </span>
              )}
            </span>
          );
          cursor = ph.globalEnd;
        }

        // Remaining text after last phrase
        if (cursor < para.endChar) {
          fragments.push(
            <span key="tail">{content.slice(cursor, para.endChar)}</span>
          );
        }

        return (
          <div key={pIdx} className={`rounded-md px-4 py-3 ${bgClass}`}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {fragments}
            </p>
          </div>
        );
      })}
    </div>
  );
}
