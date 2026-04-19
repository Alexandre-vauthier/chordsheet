'use client';

import { useState, useRef, useEffect } from 'react';
import type { StringChord, PianoChord, InstrumentId } from '@/types';
import { isPianoChord } from '@/types';
import { useChordVariants } from '@/lib/use-chord-variants';
import { ChordDiagram } from './chord-diagram';
import { PianoKeyboard } from './piano-keyboard';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import { playChord } from '@/lib/chord-audio';

interface ChordSuggestionsProps {
  chordName: string;
  instrumentId: InstrumentId;
  customChord?: StringChord | PianoChord | null;

  position?: 'top' | 'bottom';
  capo?: number;
}

export function ChordSuggestions({
  chordName,
  instrumentId,
  customChord,
  position = 'bottom',
  capo = 0,
}: ChordSuggestionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Variantes depuis bibliothèque (statique + overrides Firestore)
  const libraryVariants = useChordVariants(chordName, instrumentId);

  // L'accord custom de la grille est prioritaire sur tout
  const variants = customChord
    ? [customChord, ...libraryVariants.filter(v => v.id !== customChord.id)]
    : libraryVariants;

  // Reset l'index quand le nom change
  useEffect(() => {
    setCurrentIndex(0);
  }, [chordName, instrumentId]);

  if (variants.length === 0) return null;

  const instrument = INSTRUMENT_CONFIG[instrumentId];
  const currentChord = variants[currentIndex];
  const hasMultipleVariants = variants.length > 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? variants.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === variants.length - 1 ? 0 : prev + 1));
  };

  const handleDiagramClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playChord(currentChord, instrumentId, capo);
  };

  return (
    <div
      ref={containerRef}
      className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 z-50`}
    >
      <div className="bg-[var(--cell-bg)] rounded-xl shadow-lg border border-[var(--line)] p-3 min-w-[140px]">
        {/* Diagramme — cliquable pour jouer */}
        <div
          className="group/play relative flex justify-center cursor-pointer"
          onClick={handleDiagramClick}
          title="Cliquer pour écouter"
        >
          {isPianoChord(currentChord) ? (
            <PianoKeyboard chord={currentChord} />
          ) : (
            <ChordDiagram
              chord={currentChord}
              size="sm"
              numStrings={instrument.strings}
            />
          )}
          {/* Overlay ▶ au survol */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity rounded-lg bg-[var(--ink)]/10">
            <span className="text-[var(--ink)] text-sm opacity-70">▶</span>
          </div>
        </div>

        {/* Nom de l'accord */}
        <div className="text-center mt-2">
          <span className="text-sm font-medium text-[var(--ink)]">
            {chordName}
          </span>
        </div>

        {/* Navigation entre variantes */}
        {hasMultipleVariants && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={handlePrev}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--paper)] hover:bg-[var(--line)] transition-colors text-[var(--ink-light)]"
            >
              ‹
            </button>
            <span className="text-xs text-[var(--ink-faint)]">
              {currentIndex + 1}/{variants.length}
            </span>
            <button
              onClick={handleNext}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--paper)] hover:bg-[var(--line)] transition-colors text-[var(--ink-light)]"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Flèche pointant vers la cellule */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--cell-bg)] border-[var(--line)] transform rotate-45 ${
          position === 'top'
            ? '-bottom-1.5 border-r border-b'
            : '-top-1.5 border-l border-t'
        }`}
      />
    </div>
  );
}
