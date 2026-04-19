'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { Sheet, CellSpan, InstrumentId } from '@/types';
import { INSTRUMENTS, DIFFICULTY_LABELS } from '@/types';
import { ChordSummary, InstrumentSelector, ChordSuggestions, ChordDiagram, PianoKeyboard } from '@/components/chord';
import type { CustomChordMap } from '@/components/chord';
import type { StringChord, PianoChord, CustomChord } from '@/types';
import { isPianoChord } from '@/types';
import { useChordNotation } from '@/lib/use-chord-notation';
import { useChordColor } from '@/lib/use-chord-color';
import { transposeChord } from '@/lib/transpose';
import { usePlayback, parseTempo } from '@/lib/use-playback';
import type { PlayStep } from '@/lib/use-playback';
import { useArtwork } from '@/lib/use-artwork';
import { useAuth } from '@/lib/auth-context';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import { useChordVariants } from '@/lib/use-chord-variants';
import { playChord } from '@/lib/chord-audio';
import { transposeSections, transposeKey } from '@/lib/transpose';

const LS_KEY = 'chordsheet_instrument';

function getSavedInstrument(fallback: InstrumentId): InstrumentId {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(LS_KEY) as InstrumentId;
  return v && (INSTRUMENTS as readonly string[]).includes(v) ? v : fallback;
}

function hasLocalInstrument(): boolean {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(LS_KEY) as InstrumentId;
  return !!(v && (INSTRUMENTS as readonly string[]).includes(v));
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

const spanToGridCols = (span: CellSpan) => Math.round(span / 0.25);

// ─── Component ───────────────────────────────────────────────────────────────

export function SheetViewer({ sheet }: SheetViewerProps) {
  const translate = useChordNotation();
  const getColor = useChordColor();
  const { user, updateUser } = useAuth();
  const [showInlineDiagram, setShowInlineDiagram] = useState(() => user?.showInlineDiagram ?? false);
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(
    () => getSavedInstrument(sheet.instrumentId || 'guitar')
  );

  // Appliquer la préférence du profil si aucun choix local (premier appareil / nouveau navigateur)
  useEffect(() => {
    if (user?.preferredInstrument && !hasLocalInstrument()) {
      setInstrumentId(user.preferredInstrument);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.preferredInstrument]);

  const handleInstrumentChange = (id: InstrumentId) => {
    setInstrumentId(id);
    localStorage.setItem(LS_KEY, id);
    // Sauvegarder comme instrument de prédilection dans le profil
    updateUser({ preferredInstrument: id }).catch(() => {/* silent */});
  };

  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [transpose, setTranspose] = useState(0);
  const [selectedChords, setSelectedChords] = useState<Record<string, StringChord | PianoChord>>({});
  const [localTempo, setLocalTempo] = useState<string>(sheet.tempo || '90');

  const displaySections = transposeSections(sheet.sections, transpose);
  const displayKey = transposeKey(sheet.key, transpose);

  // Playback
  const { isPlaying, activeStep, playSection, togglePlay, stop } = usePlayback({
    sections: displaySections,
    tempo: localTempo,
    instrumentId,
    customChords: sheet.customChords as Record<string, unknown>,
    selectedChords,
    metronomeEnabled,
    capo: sheet.capo ?? 0,
  });

  const bpm = parseTempo(sheet.tempo);
  const { artworkUrl, previewUrl } = useArtwork(sheet.artist, sheet.title);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  // Stopper l'extrait si l'utilisateur change d'onglet
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && previewRef.current) {
        previewRef.current.pause();
        setPreviewPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const togglePreview = () => {
    if (!previewUrl) return;
    if (previewPlaying) {
      previewRef.current?.pause();
      setPreviewPlaying(false);
    } else {
      if (!previewRef.current) {
        previewRef.current = new Audio(previewUrl);
        previewRef.current.onended = () => setPreviewPlaying(false);
      }
      previewRef.current.play();
      setPreviewPlaying(true);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:max-w-none">
      {/* Header */}
      <div className="mb-8 border-b-2 border-[var(--ink)] pb-4 print:mb-6 print:pb-3">
        <div className="flex items-start justify-between gap-4">
          {/* Artwork */}
          {artworkUrl && (
            <div className="flex-shrink-0 print:hidden">
              <div
                className="relative w-20 h-20 group/art cursor-pointer"
                onClick={previewUrl ? togglePreview : undefined}
                title={previewUrl ? (previewPlaying ? 'Pause l\'extrait' : 'Écouter l\'extrait') : undefined}
              >
                <img
                  src={artworkUrl}
                  alt={`${sheet.artist} — ${sheet.title}`}
                  className="w-20 h-20 rounded-lg shadow-md object-cover"
                />
                {previewUrl && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover/art:bg-black/30 transition-all duration-200">
                    <span className={`text-white text-xl transition-opacity duration-200 ${previewPlaying ? 'opacity-100' : 'opacity-0 group-hover/art:opacity-100'}`}>
                      {previewPlaying ? '⏸' : '▶'}
                    </span>
                  </div>
                )}
              </div>
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

          {/* Ligne 1 : Métronome + Tempo + Play */}
          <div className="print:hidden flex-shrink-0 flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {/* Toggle métronome */}
              <button
                onClick={() => setMetronomeEnabled(v => !v)}
                title={metronomeEnabled ? 'Désactiver le métronome' : 'Activer le métronome'}
                className={`
                  flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150
                  ${metronomeEnabled
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }
                `}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <path d="M12 3 8 21" strokeLinecap="round"/>
                  <path d="M12 3l4 18" strokeLinecap="round"/>
                  <path d="M8.5 14.5l7-4" strokeLinecap="round"/>
                  <ellipse cx="12" cy="21" rx="3" ry="1.5"/>
                  <line x1="9.5" y1="3" x2="14.5" y2="3" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Tempo éditable */}
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded border border-transparent hover:border-orange-200 transition-colors">
                <span className="text-base leading-none">♩</span>
                <input
                  type="number"
                  min={40}
                  max={300}
                  value={bpm}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v >= 40 && v <= 300) setLocalTempo(String(v));
                  }}
                  className="w-10 bg-transparent border-none outline-none text-sm font-medium text-orange-700 text-center
                    [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  title="Modifier le tempo"
                />
                <span className="text-xs opacity-70">BPM</span>
              </div>

              {/* Play / Stop */}
              <button
                onClick={togglePlay}
                title={isPlaying ? 'Stop' : `Play — ${bpm} BPM`}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                  transition-all duration-150 border-[1.5px]
                  ${isPlaying
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white hover:bg-[#a83d25]'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
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
          </div>
        </div>

        {/* Ligne 2 : Tonalité + Capo + autres métadonnées */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {/* Tonalité + transpose */}
          <div className="flex items-center gap-1 print:hidden">
            <button
              onClick={() => setTranspose(t => t - 1)}
              className="w-6 h-6 flex items-center justify-center rounded border border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm font-medium"
            >−</button>
            <span className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 rounded text-sm min-w-[3.5rem] justify-center">
              <span className="text-sm">♯♭</span>
              {displayKey || '—'}
              {transpose !== 0 && (
                <span className="text-[10px] opacity-70">{transpose > 0 ? `+${transpose}` : transpose}</span>
              )}
            </span>
            <button
              onClick={() => setTranspose(t => t + 1)}
              className="w-6 h-6 flex items-center justify-center rounded border border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm font-medium"
            >+</button>
            {transpose !== 0 && (
              <button
                onClick={() => setTranspose(0)}
                className="text-[10px] text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors"
                title="Réinitialiser"
              >↺</button>
            )}
          </div>
          {sheet.key && (
            <span className="hidden print:flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 rounded text-sm">
              <span className="text-sm">♯♭</span>
              {displayKey}
            </span>
          )}
          {sheet.capo ? (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              Capo {sheet.capo}
            </span>
          ) : null}
          {sheet.beatsPerMeasure === 3 && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              Ternaire
            </span>
          )}
          {sheet.difficulty && DIFFICULTY_LABELS[sheet.difficulty] && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-[var(--cell-bg)] text-[var(--ink-light)] rounded text-sm print:bg-transparent print:text-[var(--ink)]">
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
          {/* Tempo pour l'impression */}
          <span className="hidden print:flex items-center gap-1.5 px-2 py-1 text-[var(--ink)] text-sm">
            <span className="text-base leading-none">♩</span>
            {localTempo} BPM
          </span>
        </div>

        {/* Genres */}
        {sheet.genres && sheet.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 print:hidden">
            {sheet.genres.map((genre) => (
              <span
                key={genre}
                className="px-2.5 py-1 bg-[var(--line)] text-[var(--ink-light)] rounded-full text-xs font-medium"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-8 print:space-y-6">
        {displaySections.map((section) => (
          <div key={section.id} className="print:break-inside-avoid">
            {/* Header de section */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold uppercase tracking-wider text-[var(--ink)]">
                {section.label}
              </span>
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
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
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
                  <div key={rowIndex} className="relative">
                    <div
                      className="grid gap-1 w-full"
                      style={{ gridTemplateColumns: `repeat(16, minmax(0, 1fr))` }}
                    >
                      {row.map((cell, cellIndex) => {
                        const isActive = isRowActive && activeStep?.cellIndex === cellIndex;

                        if (!cell.chord) {
                          return (
                            <div
                              key={cellIndex}
                              style={{ gridColumn: `span ${spanToGridCols(cell.span)}` }}
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
                            capo={sheet.capo ?? 0}
                          />
                        );
                      })}
                    </div>
                    {rowRepeat > 1 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 print:inline
                        text-xs font-semibold px-1.5 py-0.5 rounded
                        bg-[var(--accent)] text-white shadow-sm">
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


      {/* Diagrammes des accords */}
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
                  : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--ink-faint)]'
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
            <InstrumentSelector value={instrumentId} onChange={handleInstrumentChange} />
          </div>
        </div>
        <ChordSummary
          sections={displaySections}
          instrumentId={instrumentId}
          customChords={sheet.customChords as CustomChordMap}
          capo={sheet.capo ?? 0}
          onVariantChange={(chordName, chord) =>
            setSelectedChords(prev => ({ ...prev, [chordName]: chord }))
          }
        />
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
  capo = 0,
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
  capo?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pour le piano, le capo décale la hauteur → chercher l'accord transposé
  const lookupChord = instrumentId === 'piano' && capo > 0 ? transposeChord(chord, capo) : chord;
  const custom = resolveCustomChord(lookupChord, instrumentId, customChords);
  const libraryVariants = useChordVariants(lookupChord, instrumentId);

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  };

  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 200);
  };
  const color = getColor(chord);

  // Résoudre le diagramme inline (accord custom en priorité, sinon première variante library)
  const inlineDiagramChord = showInlineDiagram && span >= 1
    ? (custom ?? libraryVariants[0] ?? null)
    : null;
  const playableChord = custom ?? libraryVariants[0] ?? null;
  const numStrings = INSTRUMENT_CONFIG[instrumentId]?.strings ?? 6;

  const handleClick = () => {
    if (playableChord) playChord(playableChord, instrumentId, capo);
  };

  return (
    <div
      style={{
        gridColumn: `span ${spanToGridCols(span)}`,
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
      onClick={handleClick}
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
          {translate(lookupChord)}
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
            chordName={lookupChord}
            instrumentId={instrumentId}
            customChord={custom}
            capo={capo}
            position="bottom"
          />
        </div>
      )}
    </div>
  );
}
