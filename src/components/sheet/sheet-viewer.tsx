'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import type { Sheet, CellSpan, InstrumentId } from '@/types';
import { INSTRUMENTS, DIFFICULTY_LABELS } from '@/types';
import { ChordSummary, InstrumentSelector, ChordSuggestions, ChordDiagram, PianoKeyboard } from '@/components/chord';
import type { CustomChordMap } from '@/components/chord';
import type { StringChord, PianoChord, CustomChord } from '@/types';
import { isPianoChord } from '@/types';
import { useChordNotation } from '@/lib/use-chord-notation';
import { useChordColor } from '@/lib/use-chord-color';
import { usePlayback, parseTempo } from '@/lib/use-playback';
import type { PlayStep } from '@/lib/use-playback';
import { useArtwork } from '@/lib/use-artwork';
import { useAuth } from '@/lib/auth-context';
import { findChordVariants, INSTRUMENT_CONFIG } from '@/lib/chord-data';

const LS_KEY = 'chordsheet_instrument';

function getSavedInstrument(fallback: InstrumentId): InstrumentId {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(LS_KEY) as InstrumentId;
  return v && (INSTRUMENTS as readonly string[]).includes(v) ? v : fallback;
}

interface SheetViewerProps {
  sheet: Sheet;
}

function getRefLabel(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return '▶ YouTube';
  if (url.includes('spotify.com')) return '♫ Spotify';
  if (url.includes('deezer.com')) return '♫ Deezer';
  if (url.includes('soundcloud.com')) return '♫ SoundCloud';
  if (url.includes('apple.com/music') || url.includes('music.apple')) return '♫ Apple Music';
  return '🔗 Référence';
}

const spanToGridCols: Record<CellSpan, number> = {
  0.25: 1,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function SheetViewer({ sheet }: SheetViewerProps) {
  const translate = useChordNotation();
  const getColor = useChordColor();
  const { user } = useAuth();
  const [showInlineDiagram, setShowInlineDiagram] = useState(() => user?.showInlineDiagram ?? false);
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(
    () => getSavedInstrument(sheet.instrumentId || 'guitar')
  );

  const handleInstrumentChange = (id: InstrumentId) => {
    setInstrumentId(id);
    localStorage.setItem(LS_KEY, id);
  };

  // Playback
  const { isPlaying, activeStep, playSection, togglePlay, stop } = usePlayback({
    sections: sheet.sections,
    tempo: sheet.tempo,
    instrumentId,
    customChords: sheet.customChords as Record<string, unknown>,
  });

  const bpm = parseTempo(sheet.tempo);
  const { artworkUrl } = useArtwork(sheet.artist, sheet.title);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:max-w-none">
      {/* Header */}
      <div className="mb-8 border-b-2 border-[var(--ink)] pb-4 print:mb-6 print:pb-3">
        <div className="flex items-start justify-between gap-4">
          {/* Artwork */}
          {artworkUrl && (
            <div className="flex-shrink-0 print:hidden">
              <img
                src={artworkUrl}
                alt={`${sheet.artist} — ${sheet.title}`}
                className="w-20 h-20 rounded-lg shadow-md object-cover"
              />
              <p className="text-[8px] text-[var(--ink-faint)] mt-0.5 text-center">via iTunes</p>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-playfair text-3xl font-bold text-[var(--ink)] print:text-2xl">
              {sheet.title || 'Sans titre'}
            </h1>
            {sheet.artist && (
              <Link
                href={`/artist/${encodeURIComponent(sheet.artist)}`}
                className="text-lg text-[var(--ink-light)] mt-1 block hover:text-[var(--accent)] transition-colors print:text-[var(--ink-light)]"
              >
                {sheet.artist}
              </Link>
            )}
            {sheet.ownerName && (
              <p className="text-xs text-[var(--ink-faint)] mt-1 print:hidden">par {sheet.ownerName}</p>
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
          {sheet.tempo && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 text-orange-700 rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              <span className="text-base leading-none">♩</span>
              {sheet.tempo}
            </span>
          )}
          {sheet.capo && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              Capo {sheet.capo}
            </span>
          )}
          {sheet.difficulty && DIFFICULTY_LABELS[sheet.difficulty] && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 text-[var(--ink-light)] rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              {DIFFICULTY_LABELS[sheet.difficulty]}
            </span>
          )}
          {sheet.referenceUrl && (
            <a
              href={sheet.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded text-sm
                hover:bg-red-100 transition-colors print:hidden"
            >
              {getRefLabel(sheet.referenceUrl)}
            </a>
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
              <span className="text-sm font-semibold uppercase tracking-wider text-[var(--ink)]">
                {section.label}
              </span>
              {section.beatsPerMeasure === 3 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">
                  3/4
                </span>
              )}
              {section.repeat > 1 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent)] text-white">
                  ×{section.repeat}
                </span>
              )}
              <button
                onClick={() => {
                  if (isPlaying && activeStep?.sectionId === section.id) stop();
                  else playSection(section.id);
                }}
                className={`print:hidden ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border
                  ${isPlaying && activeStep?.sectionId === section.id
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'bg-white border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
                title={isPlaying && activeStep?.sectionId === section.id ? 'Stop' : 'Jouer cette section'}
              >
                {isPlaying && activeStep?.sectionId === section.id ? (
                  <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><rect x="4" y="3" width="4" height="14" rx="1"/><rect x="12" y="3" width="4" height="14" rx="1"/></svg>Stop</>
                ) : (
                  <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>Play</>
                )}
              </button>
            </div>

            {/* Grille */}
            <div className="space-y-2">
              {section.rows.map((row, rowIndex) => {
                if (row.every(c => !c.chord)) return null;

                const rowRepeat = section.rowRepeats?.[rowIndex] ?? 1;
                const isRowActive =
                  isPlaying &&
                  activeStep?.sectionId === section.id &&
                  activeStep?.rowIndex === rowIndex;

                return (
                  <div key={rowIndex} className="flex items-center gap-2">
                    <div
                      className="flex-1 grid gap-1"
                      style={{ gridTemplateColumns: `repeat(${section.beatsPerMeasure === 3 ? 12 : 16}, minmax(0, 1fr))` }}
                    >
                      {row.map((cell, cellIndex) => {
                        const isActive = isRowActive && activeStep?.cellIndex === cellIndex;

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
                            showInlineDiagram={showInlineDiagram}
                          />
                        );
                      })}
                    </div>
                    {rowRepeat > 1 && (
                      <span className="print:inline flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-[var(--cell-bg)] border border-[var(--line)] text-[var(--ink-faint)]">
                        ×{rowRepeat}
                      </span>
                    )}
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInlineDiagram(v => !v)}
              title={showInlineDiagram ? 'Masquer les diagrammes dans les cases' : 'Afficher les diagrammes dans les cases'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                showInlineDiagram
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-white border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--ink-faint)]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2"/>
                <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2"/>
                <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2"/>
                <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2"/>
              </svg>
              Inline
            </button>
            <InstrumentSelector
              value={instrumentId}
              onChange={handleInstrumentChange}
            />
          </div>
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
  showInlineDiagram,
}: {
  chord: string;
  span: CellSpan;
  isActive: boolean;
  activeStep: PlayStep | null;
  instrumentId: InstrumentId;
  customChords?: Record<string, CustomChord>;
  translate: (name: string) => string;
  getColor: (chord: string) => { border: string; bg: string } | null;
  showInlineDiagram: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const custom = resolveCustomChord(chord, instrumentId, customChords);

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  };

  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 200);
  };
  const color = getColor(chord);

  // Résoudre le diagramme inline (accord custom en priorité, sinon première variante)
  const inlineDiagramChord = showInlineDiagram && span >= 1
    ? (custom ?? findChordVariants(chord, instrumentId)[0] ?? null)
    : null;
  const numStrings = INSTRUMENT_CONFIG[instrumentId]?.strings ?? 6;

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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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

      <div className="relative z-10 flex flex-col items-center gap-1 py-1">
        <span className={`font-mono font-medium text-[var(--ink)] ${span <= 0.5 ? 'text-sm' : 'text-base'} print:text-sm`}>
          {translate(chord)}
        </span>
        {inlineDiagramChord && !isPianoChord(inlineDiagramChord) && (
          <div className={showInlineDiagram ? '' : 'print:hidden'}>
            <ChordDiagram chord={inlineDiagramChord} size="xs" numStrings={numStrings} />
          </div>
        )}
        {inlineDiagramChord && isPianoChord(inlineDiagramChord) && (
          <div className={showInlineDiagram ? '' : 'print:hidden'}>
            <PianoKeyboard chord={inlineDiagramChord} />
          </div>
        )}
      </div>

      {span <= 0.5 && (
        <span className="absolute bottom-0.5 left-1 text-[8px] text-[var(--ink-faint)] font-mono print:hidden">
          {span === 0.25 ? '¼' : '½'}
        </span>
      )}

      {/* Popup diagramme au survol — seulement si l'option inline est désactivée */}
      {hovered && !showInlineDiagram && (
        <div className="print:hidden" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
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
