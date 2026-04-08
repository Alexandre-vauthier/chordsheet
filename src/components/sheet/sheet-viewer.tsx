'use client';

import { useState, useRef, useCallback } from 'react';
import type { Sheet, CellSpan, InstrumentId, Section, Difficulty } from '@/types';
import { INSTRUMENTS, DIFFICULTY_LABELS } from '@/types';
import { ChordSummary, InstrumentSelector, ChordSuggestions } from '@/components/chord';
import type { CustomChordMap } from '@/components/chord';
import type { StringChord, PianoChord, CustomChord } from '@/types';
import { isPianoChord } from '@/types';
import { useChordNotation } from '@/lib/use-chord-notation';
import { useChordColor } from '@/lib/use-chord-color';
import { findChordVariants } from '@/lib/chord-data';
import { playChord } from '@/lib/chord-audio';

const LS_KEY = 'chordsheet_instrument';

function getSavedInstrument(fallback: InstrumentId): InstrumentId {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(LS_KEY) as InstrumentId;
  return v && (INSTRUMENTS as readonly string[]).includes(v) ? v : fallback;
}

interface SheetViewerProps {
  sheet: Sheet;
}

const spanToGridCols: Record<CellSpan, number> = {
  0.25: 1,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
};

// ─── Playback helpers ─────────────────────────────────────────────────────────

interface PlayStep {
  sectionId: string;
  rowIndex: number;
  cellIndex: number;
  durationMs: number;
}

function parseTempo(tempoStr: string | undefined): number {
  if (!tempoStr) return 90;
  const match = tempoStr.match(/(\d+)/);
  if (!match) return 90;
  return Math.max(40, Math.min(300, parseInt(match[1])));
}

function buildSequence(sections: Section[], beatMs: number): PlayStep[] {
  const steps: PlayStep[] = [];
  for (const section of sections) {
    for (let rep = 0; rep < (section.repeat || 1); rep++) {
      for (let r = 0; r < section.rows.length; r++) {
        for (let c = 0; c < section.rows[r].length; c++) {
          steps.push({
            sectionId: section.id,
            rowIndex: r,
            cellIndex: c,
            durationMs: section.rows[r][c].span * beatMs,
          });
        }
      }
    }
  }
  return steps;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SheetViewer({ sheet }: SheetViewerProps) {
  const translate = useChordNotation();
  const getColor = useChordColor();
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(
    () => getSavedInstrument(sheet.instrumentId || 'guitar')
  );

  const handleInstrumentChange = (id: InstrumentId) => {
    setInstrumentId(id);
    localStorage.setItem(LS_KEY, id);
  };

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState<PlayStep | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsPlaying(false);
    setActiveStep(null);
  }, []);

  const play = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const bpm = parseTempo(sheet.tempo);
    const beatMs = (60 / bpm) * 1000;
    const sequence = buildSequence(sheet.sections, beatMs);
    if (!sequence.length) return;

    setIsPlaying(true);
    let i = 0;

    const advance = () => {
      if (i >= sequence.length) {
        setIsPlaying(false);
        setActiveStep(null);
        return;
      }
      const step = sequence[i];
      setActiveStep(step);

      // Jouer l'accord si la cellule n'est pas vide
      const cell = sheet.sections
        .find(s => s.id === step.sectionId)
        ?.rows[step.rowIndex]?.[step.cellIndex];
      if (cell?.chord) {
        // Vérifier d'abord les accords personnalisés
        const customChord = sheet.customChords?.[cell.chord];
        const chordData = customChord ?? findChordVariants(cell.chord, instrumentId)[0];
        if (chordData) playChord(chordData, instrumentId);
      }

      i++;
      timeoutRef.current = setTimeout(advance, step.durationMs);
    };

    advance();
  }, [sheet, instrumentId]);

  const togglePlay = () => (isPlaying ? stop() : play());

  const bpm = parseTempo(sheet.tempo);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:max-w-none">
      {/* Header */}
      <div className="mb-8 border-b-2 border-[var(--ink)] pb-4 print:mb-6 print:pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-playfair text-3xl font-bold text-[var(--ink)] print:text-2xl">
              {sheet.title || 'Sans titre'}
            </h1>
            {sheet.artist && (
              <p className="text-lg text-[var(--ink-light)] mt-1">{sheet.artist}</p>
            )}
          </div>

          {/* Bouton Play */}
          <button
            onClick={togglePlay}
            title={isPlaying ? 'Stop' : `Play — ${bpm} BPM`}
            className={`
              print:hidden flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
              transition-all duration-150 border-[1.5px]
              ${isPlaying
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white hover:bg-[#a83d25]'
                : 'bg-white border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }
            `}
          >
            {isPlaying ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <rect x="4" y="3" width="4" height="14" rx="1" />
                  <rect x="12" y="3" width="4" height="14" rx="1" />
                </svg>
                Stop
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Play
              </>
            )}
          </button>
        </div>

        {/* Métadonnées */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {sheet.key && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              {sheet.key}
            </span>
          )}
          {sheet.tempo && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 text-orange-700 rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {sheet.tempo}
            </span>
          )}
          {sheet.capo && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              Capo {sheet.capo}
            </span>
          )}
          {sheet.difficulty && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 text-[var(--ink-light)] rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              {sheet.difficulty} · {DIFFICULTY_LABELS[sheet.difficulty as Difficulty]}
            </span>
          )}
        </div>

        {/* Genres */}
        {sheet.genres && sheet.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 print:hidden">
            {sheet.genres.map((genre) => (
              <span
                key={genre}
                className="px-2.5 py-1 bg-gray-100 text-[var(--ink-light)] rounded-full text-xs font-medium"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-8 print:space-y-6">
        {sheet.sections.map((section) => (
          <div key={section.id} className="print:break-inside-avoid">
            {/* Header de section */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--ink-light)]">
                {section.label}
              </span>
              {section.beatsPerMeasure === 3 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">
                  3/4
                </span>
              )}
              {section.repeat > 1 && (
                <span className="font-playfair text-sm italic text-[var(--ink-light)]">
                  ×{section.repeat}
                </span>
              )}
            </div>

            {/* Grille */}
            <div className="space-y-2">
              {section.rows.map((row, rowIndex) => {
                // Ligne entièrement vide → non affichée
                if (row.every(c => !c.chord)) return null;

                return (
                  <div
                    key={rowIndex}
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${section.beatsPerMeasure === 3 ? 12 : 16}, minmax(0, 1fr))` }}
                  >
                    {row.map((cell, cellIndex) => {
                      const isActive =
                        isPlaying &&
                        activeStep?.sectionId === section.id &&
                        activeStep?.rowIndex === rowIndex &&
                        activeStep?.cellIndex === cellIndex;

                      // Cellule vide → espace transparent sans bordure
                      if (!cell.chord) {
                        return (
                          <div
                            key={cellIndex}
                            style={{ gridColumn: `span ${spanToGridCols[cell.span]}` }}
                          />
                        );
                      }

                      return (
                        <ViewerChordCell
                          key={cellIndex}
                          chord={cell.chord}
                          span={cell.span}
                          isActive={isActive}
                          activeStep={activeStep}
                          instrumentId={instrumentId}
                          customChords={sheet.customChords as Record<string, CustomChord> | undefined}
                          translate={translate}
                          getColor={getColor}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Rappel des accords utilisés */}
      <div className="mt-8 print:hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[var(--ink-light)]">Diagrammes des accords</h2>
          <InstrumentSelector
            value={instrumentId}
            onChange={handleInstrumentChange}
          />
        </div>
        <ChordSummary
          sections={sheet.sections}
          instrumentId={instrumentId}
          customChords={sheet.customChords as CustomChordMap}
        />
      </div>

      {/* Footer (visible uniquement à l'impression) */}
      <div className="hidden print:block mt-8 pt-4 border-t border-[var(--line)] text-xs text-[var(--ink-faint)]">
        <p>Créé avec ChordSheet • chordsheet.app</p>
      </div>
    </div>
  );
}

// ─── Cellule d'accord interactive (hover → diagramme + play) ─────────────────

function resolveCustomChord(
  chordName: string,
  instrumentId: InstrumentId,
  customChords?: Record<string, CustomChord>,
): (StringChord | PianoChord) | null {
  if (!customChords) return null;
  const key = `${chordName.toLowerCase()}-${instrumentId}`;
  const custom = customChords[key];
  if (!custom) return null;
  return isPianoChord(custom as StringChord | PianoChord)
    ? (custom as unknown as PianoChord)
    : (custom as unknown as StringChord);
}

function ViewerChordCell({
  chord,
  span,
  isActive,
  activeStep,
  instrumentId,
  customChords,
  translate,
  getColor,
}: {
  chord: string;
  span: CellSpan;
  isActive: boolean;
  activeStep: PlayStep | null;
  instrumentId: InstrumentId;
  customChords?: Record<string, CustomChord>;
  translate: (name: string) => string;
  getColor: (chord: string) => { border: string; bg: string } | null;
}) {
  const [hovered, setHovered] = useState(false);
  const custom = resolveCustomChord(chord, instrumentId, customChords);
  const color = getColor(chord);

  return (
    <div
      style={{
        gridColumn: `span ${spanToGridCols[span]}`,
        ...(color ? { borderLeftColor: color.border, borderLeftWidth: '5px' } : {}),
      }}
      className={`
        relative rounded-lg border-[1.5px] min-h-12 flex items-center justify-center
        bg-[var(--cell-bg)] border-[#8a7a6a] cursor-pointer
        ${span <= 0.5 ? 'bg-[#f7f3ec] border-[var(--ink-faint)]' : ''}
        ${isActive ? 'border-[var(--accent)]' : ''}
        print:min-h-10 print:border
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Sweep animation */}
      {isActive && activeStep && (
        <div
          className="absolute inset-0 origin-left pointer-events-none"
          style={{
            background: 'rgba(200,75,47,0.13)',
            animation: `beatSweep ${activeStep.durationMs}ms linear forwards`,
          }}
        />
      )}

      <span
        className={`
          relative z-10 font-mono font-medium text-[var(--ink)]
          ${span <= 0.5 ? 'text-sm' : 'text-base'}
          print:text-sm
        `}
      >
        {translate(chord)}
      </span>

      {span <= 0.5 && (
        <span className="absolute bottom-0.5 left-1 text-[8px] text-[var(--ink-faint)] font-mono print:hidden">
          {span === 0.25 ? '¼' : '½'}
        </span>
      )}

      {/* Popup diagramme au survol */}
      {hovered && (
        <div className="print:hidden">
          <ChordSuggestions
            chordName={chord}
            instrumentId={instrumentId}
            customChord={custom}
            position="bottom"
          />
        </div>
      )}
    </div>
  );
}
