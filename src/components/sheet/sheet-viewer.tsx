'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Sheet, CellSpan, InstrumentId } from '@/types';
import { INSTRUMENTS } from '@/types';
import { ChordSummary, InstrumentSelector, ChordDiagram, PianoKeyboard } from '@/components/chord';
import type { CustomChordMap } from '@/components/chord';
import type { StringChord, PianoChord, CustomChord } from '@/types';
import { isPianoChord } from '@/types';
import { useChordNotation } from '@/lib/use-chord-notation';
import { useChordColor } from '@/lib/use-chord-color';
import { transposeChord } from '@/lib/transpose';
import { usePlayback, parseTempo } from '@/lib/use-playback';
import { useGrooveBox } from '@/lib/use-groove-box';
import type { PlayStep } from '@/lib/use-playback';
import { useArtwork } from '@/lib/use-artwork';
import { useAuth } from '@/lib/auth-context';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import { useChordVariants } from '@/lib/use-chord-variants';
import { playChord, playMetronomeTick } from '@/lib/chord-audio';
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
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  isTogglingBookmark?: boolean;
  concertCellPath?: { sectionIdx: number; rowIdx: number; cellIdx: number; durationMs?: number; rowRepeatIndex?: number };
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

// Signature d'une section = empreinte de ses accords (indépendante du label, repeat, rowRepeats)
function sectionSignature(section: { rows: { chord: string; span: number }[][] }): string {
  return section.rows
    .map(row => row.map(c => `${c.chord}:${c.span}`).join(','))
    .join('|');
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SheetViewer({ sheet, isBookmarked, onToggleBookmark, isTogglingBookmark, concertCellPath }: SheetViewerProps) {
  const translate = useChordNotation();
  const getColor = useChordColor();
  const { user, updateUser } = useAuth();
  const [showInlineDiagram, setShowInlineDiagram] = useState(() => user?.showInlineDiagram ?? false);
  const [showChordSummary, setShowChordSummary] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 640) {
      setShowChordSummary(user?.showChordSummaryByDefault ?? true);
    }
    // Mobile : reste false (replié par défaut)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.showChordSummaryByDefault]);
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(() => {
    // Priorité 1 : dernier choix explicite (localStorage)
    if (hasLocalInstrument()) return getSavedInstrument('guitar');
    // Priorité 2 : instrument de la grille si pas de choix utilisateur
    if (sheet.instrumentId) return sheet.instrumentId;
    return 'guitar';
  });

  // Priorité 2 bis : préférence profil une fois le user chargé, si pas de localStorage
  useEffect(() => {
    if (!hasLocalInstrument() && user?.preferredInstrument) {
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

  const [metronomeEnabled, setMetronomeEnabled] = useState(() => user?.defaultMetronome ?? false);
  const [grooveEnabled, setGrooveEnabled] = useState(() => user?.defaultGrooveBox ?? false);
  const [chordsEnabled, setChordsEnabled] = useState(() => user?.defaultChordsAudio ?? true);
  const [countInEnabled, setCountInEnabled] = useState(() => user?.defaultCountIn ?? false);
  const [countBeat, setCountBeat] = useState(0); // 0 = inactif, 1-4 = décompte
  const countTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [transpose, setTranspose] = useState(0);
  const [selectedChords, setSelectedChords] = useState<Record<string, StringChord | PianoChord>>({});
  const [localTempo, setLocalTempo] = useState<string>(sheet.tempo || '90');
  const [localTempoUnit, setLocalTempoUnit] = useState<'quarter' | 'eighth'>(sheet.tempoUnit ?? 'quarter');
  const [minimizeRepeated, setMinimizeRepeated] = useState(() => user?.minimizeRepeatedSections ?? false);

  const displaySections = transposeSections(sheet.sections, transpose);
  const displayKey = transposeKey(sheet.key, transpose);

  // Y a-t-il au moins une section en doublon ?
  const hasRepeatedSections = (() => {
    const seen = new Set<string>();
    for (const s of displaySections) {
      const sig = sectionSignature(s);
      if (seen.has(sig)) return true;
      seen.add(sig);
    }
    return false;
  })();

  // Playback
  const { isPlaying, activeStep, playSection, play, togglePlay, stop } = usePlayback({
    sections: displaySections,
    tempo: localTempo,
    tempoUnit: localTempoUnit,
    instrumentId,
    customChords: sheet.customChords as Record<string, unknown>,
    selectedChords,
    metronomeEnabled,
    chordsEnabled,
    capo: sheet.capo ?? 0,
  });

  const bpm = parseTempo(sheet.tempo);

  const cancelCountIn = useCallback(() => {
    countTimersRef.current.forEach(clearTimeout);
    countTimersRef.current = [];
    setCountBeat(0);
  }, []);

  // Cleanup au démontage
  useEffect(() => () => cancelCountIn(), [cancelCountIn]);

  // Auto-scroll : ligne active en haut de l'écran (solo + concert)
  const scrollToRow = useCallback((rowId: string) => {
    const el = document.querySelector(`[data-row-id="${rowId}"]`) as HTMLElement | null;
    if (!el) return;
    const navbarHeight = 56;
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - navbarHeight - 12, behavior: 'smooth' });
  }, []);

  const handlePlay = useCallback(() => {
    if (isPlaying) { stop(); return; }
    if (countBeat > 0) { cancelCountIn(); return; }
    if (!countInEnabled) { play(); return; }

    // Scroll vers la première ligne dès le démarrage du décompte
    const firstSection = displaySections[0];
    if (firstSection) {
      const firstRowIndex = firstSection.rows.findIndex(r => r.some(c => c.chord));
      if (firstRowIndex !== -1) scrollToRow(`${firstSection.id}-${firstRowIndex}`);
    }

    const factor = localTempoUnit === 'eighth' ? 0.5 : 1;
    const msPerBeat = (60000 / parseTempo(localTempo)) * factor;

    for (let b = 1; b <= 4; b++) {
      const t = setTimeout(() => {
        setCountBeat(b);
        playMetronomeTick(b === 1);
      }, (b - 1) * msPerBeat);
      countTimersRef.current.push(t);
    }
    const startT = setTimeout(() => {
      setCountBeat(0);
      countTimersRef.current = [];
      play();
    }, 4 * msPerBeat);
    countTimersRef.current.push(startT);
  }, [isPlaying, countBeat, countInEnabled, stop, cancelCountIn, play, localTempo, localTempoUnit, displaySections, scrollToRow]);

  useEffect(() => {
    if (!isPlaying || !activeStep) return;
    scrollToRow(`${activeStep.sectionId}-${activeStep.rowIndex}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep?.sectionId, activeStep?.rowIndex]);

  useEffect(() => {
    if (!concertCellPath) return;
    const section = displaySections[concertCellPath.sectionIdx];
    if (section) scrollToRow(`${section.id}-${concertCellPath.rowIdx}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concertCellPath?.sectionIdx, concertCellPath?.rowIdx]);

  useGrooveBox({
    enabled: isPlaying,
    muted: !grooveEnabled,
    bpm: (() => { const b = parseTempo(localTempo); return b > 100 ? Math.round(b / 2) : b; })(),
    beatsPerMeasure: sheet.beatsPerMeasure ?? 4,
    genres: sheet.genres ?? [],
  });

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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {/* Artwork + Titre : toujours sur la même ligne */}
          <div className="relative flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
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
            <div className="flex items-center gap-2">
              <h1 className="font-playfair text-3xl font-bold text-[var(--ink)] print:text-2xl">
                {sheet.title || 'Sans titre'}
              </h1>
              {onToggleBookmark && (
                <button
                  onClick={onToggleBookmark}
                  disabled={isTogglingBookmark}
                  title={isBookmarked ? 'Retirer du book' : 'Ajouter au book'}
                  className={`print:hidden shrink-0 text-2xl leading-none transition-colors ${
                    isBookmarked ? 'text-amber-400' : 'text-[var(--ink-faint)] hover:text-amber-400'
                  }`}
                >
                  {isBookmarked ? '★' : '☆'}
                </button>
              )}
            </div>
            {sheet.artist && (
              <Link
                href={`/artist/${encodeURIComponent(sheet.artist)}`}
                className="text-lg text-[var(--ink-light)] mt-1 block hover:text-[var(--accent)] transition-colors print:text-[var(--ink-light)]"
              >
                {sheet.artist}
              </Link>
            )}
            {sheet.ownerName && (
              <p className="text-xs text-[var(--ink-faint)] mt-1 print:hidden">
                par{' '}
                {sheet.ownerId && sheet.ownerId !== 'deleted' ? (
                  <Link
                    href={`/user/${sheet.ownerId}`}
                    className="hover:text-[var(--accent)] transition-colors"
                  >
                    {sheet.ownerName}
                  </Link>
                ) : (
                  sheet.ownerName
                )}
              </p>
            )}
          </div>
          {sheet.capo ? (
            <span className="sm:hidden print:hidden absolute bottom-0 right-0 px-1.5 py-0.5 bg-[var(--cell-bg)] text-[var(--ink-light)] rounded text-xs border border-[var(--line)]">
              Capo {sheet.capo}
            </span>
          ) : null}
          </div>{/* fin artwork+titre */}

          {/* Contrôles : ligne pleine largeur sous le titre sur mobile, colonne droite sur desktop */}
          <div className="print:hidden hidden sm:flex flex-col gap-2 sm:flex-shrink-0 sm:items-end">
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

              {/* Toggle boite à rythme */}
              <button
                onClick={() => setGrooveEnabled(v => !v)}
                title={grooveEnabled ? 'Désactiver la boite à rythme' : 'Activer la boite à rythme'}
                className={`
                  flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150
                  ${grooveEnabled
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }
                `}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <ellipse cx="12" cy="9" rx="7" ry="2.5"/>
                  <line x1="5" y1="9" x2="5" y2="16" strokeLinecap="round"/>
                  <line x1="19" y1="9" x2="19" y2="16" strokeLinecap="round"/>
                  <path d="M5 16c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Toggle lecture des accords */}
              <button
                onClick={() => setChordsEnabled(v => !v)}
                title={chordsEnabled ? 'Désactiver la lecture des accords' : 'Activer la lecture des accords'}
                className={`
                  flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150
                  ${chordsEnabled
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }
                `}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
              </button>

              {/* Tempo éditable */}
              <div className="flex items-center gap-1 px-3 py-2 bg-[var(--cell-bg)] text-[var(--ink)] rounded-lg border-[1.5px] border-[var(--line)] hover:border-[var(--ink-faint)] transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    const units = ['quarter', 'eighth'] as const;
                    setLocalTempoUnit(u => units[(units.indexOf(u) + 1) % units.length]);
                  }}
                  title="Changer l'unité de tempo (♩ noire → ♪ croche)"
                  className="text-base leading-none hover:text-[var(--accent)] transition-colors cursor-pointer"
                >
                  {localTempoUnit === 'eighth' ? '♪' : '♩'}
                </button>
                <input
                  type="number"
                  min={40}
                  max={300}
                  value={localTempo}
                  onChange={(e) => setLocalTempo(e.target.value)}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value);
                    setLocalTempo(String(v >= 40 && v <= 300 ? v : parseTempo(sheet.tempo)));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-10 bg-transparent border-none outline-none text-sm font-medium text-center
                    [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  title="Modifier le tempo"
                />
                <span className="text-xs text-[var(--ink-light)]">BPM</span>
              </div>

              {/* Toggle count-in */}
              <button
                onClick={() => setCountInEnabled(v => !v)}
                title={countInEnabled ? 'Désactiver le décompte' : 'Activer le décompte (4 temps avant play)'}
                className={`
                  flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150
                  ${countInEnabled
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }
                `}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <rect x="2"  y="16" width="4" height="6" rx="1"/>
                  <rect x="7"  y="11" width="4" height="11" rx="1"/>
                  <rect x="12" y="6"  width="4" height="16" rx="1"/>
                  <rect x="17" y="1"  width="4" height="21" rx="1"/>
                </svg>
              </button>

              {/* Play / Stop */}
              <button
                onClick={handlePlay}
                title={isPlaying ? 'Stop' : countBeat > 0 ? 'Annuler le décompte' : `Play — ${bpm} BPM`}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                  transition-all duration-150 border-[1.5px]
                  ${isPlaying || countBeat > 0
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white hover:bg-[#a83d25]'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }
                `}
              >
                {countBeat > 0 ? (
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map(b => (
                      <span
                        key={b}
                        className={`w-2 h-2 rounded-full transition-all duration-75 ${
                          b === countBeat ? 'bg-white scale-150' : b < countBeat ? 'bg-white/50' : 'bg-white/25'
                        }`}
                      />
                    ))}
                  </div>
                ) : isPlaying ? (
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

            {/* Métadonnées compactes sous les boutons */}
            <div className="hidden sm:flex flex-wrap items-center gap-1.5 sm:justify-end">
              {/* Genres — cliquables vers Explorer filtré */}
              {sheet.genres?.map((genre) => (
                <Link
                  key={genre}
                  href={`/explore?genre=${encodeURIComponent(genre)}`}
                  className="px-2 py-0.5 bg-[var(--line)] text-[var(--ink-light)] rounded-full text-xs font-medium hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
                >
                  {genre}
                </Link>
              ))}

              {/* Tonalité + transpose */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTranspose(t => t - 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-xs font-medium"
                >−</button>
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[var(--cell-bg)] text-[var(--ink)] rounded text-xs min-w-[3rem] justify-center border border-[var(--line)]">
                  <span className="text-xs">♯♭</span>
                  {displayKey || '—'}
                  {transpose !== 0 && (
                    <span className="text-[9px] opacity-70">{transpose > 0 ? `+${transpose}` : transpose}</span>
                  )}
                </span>
                <button
                  onClick={() => setTranspose(t => t + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-xs font-medium"
                >+</button>
                {transpose !== 0 && (
                  <button
                    onClick={() => setTranspose(0)}
                    className="text-[9px] text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors"
                    title="Réinitialiser"
                  >↺</button>
                )}
              </div>

              {sheet.capo ? (
                <span className="px-1.5 py-0.5 bg-[var(--cell-bg)] text-[var(--ink-light)] rounded text-xs border border-[var(--line)]">
                  Capo {sheet.capo}
                </span>
              ) : null}
              {sheet.beatsPerMeasure === 3 && (
                <span className="px-1.5 py-0.5 bg-[var(--cell-bg)] text-[var(--ink-light)] rounded text-xs border border-[var(--line)]">
                  Ternaire
                </span>
              )}
              {sheet.referenceUrl && (
                <a
                  href={sheet.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-xs hover:bg-red-100 transition-colors"
                >
                  {getRefLabel(sheet.referenceUrl)}
                </a>
              )}
            </div>
          </div>

          {/* Métadonnées print uniquement — colonne droite */}
          <div className="hidden print:flex flex-col items-end justify-center gap-1 shrink-0 text-right">
            {sheet.key && (
              <span className="text-sm font-semibold text-[var(--ink)]">
                ♯♭ {displayKey}
              </span>
            )}
            <span className="text-sm text-[var(--ink)]">
              {localTempoUnit === 'eighth' ? '♪' : '♩'} {localTempo} BPM
            </span>
            {sheet.capo ? (
              <span className="text-sm text-[var(--ink-light)]">Capo {sheet.capo}</span>
            ) : null}
            {sheet.beatsPerMeasure === 3 && (
              <span className="text-sm text-[var(--ink-light)]">Ternaire</span>
            )}
          </div>
        </div>
      </div>

      {/* Barre instrument + diagrammes */}
      <div className="mb-6 print:hidden">
        <div className="flex items-center justify-between mb-3">
          {instrumentId !== 'voice' && (
            <button
              onClick={() => setShowChordSummary(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors"
            >
              Accords utilisés
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showChordSummary ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          )}
          <div className={`flex items-center gap-3 ${instrumentId === 'voice' ? 'ml-auto' : ''}`}>
            {showChordSummary && instrumentId !== 'voice' && hasRepeatedSections && (
              <button
                onClick={() => {
                  const next = !minimizeRepeated;
                  setMinimizeRepeated(next);
                  updateUser({ minimizeRepeatedSections: next }).catch(() => {/* silent */});
                }}
                title="Masquer les accords des sections identiques"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  minimizeRepeated
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--ink-faint)]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round"/>
                </svg>
                Minimiser
              </button>
            )}
            {showChordSummary && instrumentId !== 'voice' && (
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
                  <rect x="3" y="2" width="18" height="20" rx="2" strokeWidth="1.8"/>
                  <line x1="7" y1="7" x2="17" y2="7" strokeWidth="1.5"/>
                  <line x1="7" y1="11" x2="17" y2="11" strokeWidth="1.5"/>
                  <line x1="7" y1="15" x2="17" y2="15" strokeWidth="1.5"/>
                  <line x1="7" y1="2" x2="7" y2="22" strokeWidth="1.2"/>
                  <line x1="12" y1="2" x2="12" y2="22" strokeWidth="1.2"/>
                  <line x1="17" y1="2" x2="17" y2="22" strokeWidth="1.2"/>
                </svg>
                Diagrammes
              </button>
            )}
            <InstrumentSelector
              value={instrumentId}
              onChange={handleInstrumentChange}
              exclude={sheet.lyrics ? [] : ['voice']}
            />
          </div>
        </div>
        {showChordSummary && instrumentId !== 'voice' && instrumentId !== 'percussion' && (
          <ChordSummary
            sections={displaySections}
            instrumentId={instrumentId}
            customChords={sheet.customChords as CustomChordMap}
            capo={sheet.capo ?? 0}
            compact
            onVariantChange={(chordName, chord) =>
              setSelectedChords(prev => ({ ...prev, [chordName]: chord }))
            }
          />
        )}
      </div>

      {/* Résumé accords — uniquement à l'impression, si option activée */}
      {user?.printChordDiagrams && instrumentId !== 'voice' && instrumentId !== 'percussion' && (
        <div className="hidden print:block mb-8 print-chord-summary">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">Accords utilisés</h2>
            <div className="flex-1 h-px bg-[var(--line)]" />
          </div>
          <ChordSummary
            sections={displaySections}
            instrumentId={instrumentId}
            customChords={sheet.customChords as CustomChordMap}
            capo={sheet.capo ?? 0}
            compact
            onVariantChange={(chordName, chord) =>
              setSelectedChords(prev => ({ ...prev, [chordName]: chord }))
            }
          />
        </div>
      )}

      {/* Sections — masquées pour Voix */}
      <div className={`space-y-8 print:space-y-6 ${instrumentId === 'voice' && sheet.lyrics ? 'hidden' : ''}`}>
        {(() => {
          const seenSignatures = new Map<string, string>(); // signature → label de la première occurrence
          return displaySections.map((section) => {
            const sig = sectionSignature(section);
            const firstLabel = seenSignatures.get(sig);
            const isDuplicate = minimizeRepeated && !!firstLabel;
            const isDuplicateForPrint = (user?.printMinimizeRepeatedSections ?? false) && !!firstLabel;
            if (!seenSignatures.has(sig)) seenSignatures.set(sig, section.label);
            return { section, isDuplicate, isDuplicateForPrint, firstLabel: firstLabel ?? null };
          });
        })().map(({ section, isDuplicate, isDuplicateForPrint, firstLabel }, sectionIdx) => (
          <div key={section.id} className="print:break-inside-avoid" data-section-id={section.id}>
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
              {(isDuplicate || isDuplicateForPrint) && firstLabel && (
                <span className="hidden print:inline text-sm text-[var(--ink-light)] italic">
                  = {firstLabel}
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

            {/* Grille — masquée à l'écran si doublon en mode minimisé, masquée à l'impression si option profil */}
            {isDuplicate && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--line)] text-xs text-[var(--ink-faint)] print:hidden">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 20h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Identique à <span className="font-medium text-[var(--ink-light)] uppercase tracking-wide ml-0.5">{firstLabel}</span>
              </div>
            )}
            <div className={`space-y-2 ${isDuplicate ? 'hidden print:block' : ''} ${isDuplicateForPrint ? 'print:hidden' : ''}`}>
              {section.rows.map((row, rowIndex) => {
                if (row.every(c => !c.chord)) return null;

                const rowRepeat = section.rowRepeats?.[rowIndex] ?? 1;
                const isRowActive =
                  isPlaying &&
                  activeStep?.sectionId === section.id &&
                  activeStep?.rowIndex === rowIndex;
                const isRowConcertActive = !!concertCellPath &&
                  concertCellPath.sectionIdx === sectionIdx &&
                  concertCellPath.rowIdx === rowIndex;

                // Index de répétition courant (solo ou concert)
                const activeRepeatIdx = isRowActive
                  ? activeStep!.rowRepeatIndex
                  : isRowConcertActive
                    ? (concertCellPath!.rowRepeatIndex ?? 0)
                    : undefined;
                const isRepeatBadgeActive = activeRepeatIdx !== undefined;
                const isLastRepeat = isRepeatBadgeActive && activeRepeatIdx === rowRepeat - 1;

                return (
                  <div key={rowIndex} className="relative" data-row-id={`${section.id}-${rowIndex}`}>
                    <div
                      className="grid gap-1 w-full measure-row"
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

                        const isConcertActive = !!concertCellPath &&
                          concertCellPath.sectionIdx === sectionIdx &&
                          concertCellPath.rowIdx === rowIndex &&
                          concertCellPath.cellIdx === cellIndex;

                        return (
                          <ViewerChordCell
                            key={cellIndex}
                            chord={cell.chord}
                            span={cell.span}
                            isActive={isActive}
                            isConcertActive={isConcertActive}
                            concertCellDurationMs={isConcertActive ? concertCellPath?.durationMs : undefined}
                            activeStep={activeStep}
                            instrumentId={instrumentId}
                            customChords={sheet.customChords as Record<string, CustomChord> | undefined}
                            selectedChords={selectedChords}
                            translate={translate}
                            getColor={getColor}
                            showInlineDiagram={showInlineDiagram}
                            capo={sheet.capo ?? 0}
                          />
                        );
                      })}
                    </div>
                    {rowRepeat > 1 && !isLastRepeat && (
                      <span className={`absolute top-1/2 -translate-y-1/2 z-10 print:inline
                        right-0 translate-x-1/2 md:translate-x-[calc(100%+6px)]
                        print:right-0 print:translate-x-1/2
                        text-xs font-bold px-2 py-0.5 rounded-lg shadow-sm
                        ${isRepeatBadgeActive ? 'animate-repeat-blink' : 'bg-[var(--accent)] text-white'}`}>
                        ×{isRepeatBadgeActive ? rowRepeat - activeRepeatIdx! : rowRepeat}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Paroles — visibles uniquement en mode Voix */}
      {sheet.lyrics && instrumentId === 'voice' && (
        <div className="mt-10 print:mt-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">Paroles</h2>
            <div className="flex-1 h-px bg-[var(--line)]" />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-[0.95rem] text-[var(--ink)] leading-loose bg-[var(--cell-bg)] rounded-lg border border-[var(--line)] p-6">
            {sheet.lyrics}
          </pre>
        </div>
      )}

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
  isConcertActive,
  concertCellDurationMs,
  activeStep,
  instrumentId,
  customChords,
  selectedChords,
  translate,
  getColor,
  showInlineDiagram,
  capo = 0,
}: {
  chord: string;
  span: CellSpan;
  isActive: boolean;
  isConcertActive?: boolean;
  concertCellDurationMs?: number;
  activeStep: PlayStep | null;
  instrumentId: InstrumentId;
  customChords?: Record<string, CustomChord>;
  selectedChords?: Record<string, StringChord | PianoChord>;
  translate: (name: string) => string;
  getColor: (chord: string) => { border: string; bg: string } | null;
  showInlineDiagram: boolean;
  capo?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pour le piano, le capo décale la hauteur → chercher l'accord transposé
  const lookupChord = instrumentId === 'piano' && capo > 0 ? transposeChord(chord, capo) : chord;
  // Pour la basse, afficher uniquement la fondamentale (ex: Cmaj7 → C)
  const bassRoot = instrumentId === 'bass' ? (lookupChord.match(/^([A-G][#b]?)/)?.[1] ?? lookupChord) : null;
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

  // selectedChords reflète la variante naviguée dans ChordSummary (priorité sur tout)
  const selected = selectedChords?.[chord];

  // Résoudre la variante à afficher — même logique que ChordSummary :
  // 1. Navigation en cours (selectedChords)
  // 2. Préférence auteur si toujours présente dans la bibliothèque
  // 3. Préférence auteur si accord vraiment custom (isExplicitlyCreated)
  // 4. Fallback : première variante de la bibliothèque
  const displayChord = (() => {
    if (selected) return selected;
    if (custom) {
      const inLib = libraryVariants.find(v => v.id === custom.id);
      if (inLib) return inLib;
      const rawCustom = customChords?.[`${lookupChord.toLowerCase()}-${instrumentId}`];
      if (rawCustom?.isExplicitlyCreated) return custom;
      return libraryVariants[0] ?? null;
    }
    return libraryVariants[0] ?? null;
  })();

  const playableChord = displayChord;
  const minSpanForInline = instrumentId === 'piano' ? 1 : 0.5;
  const inlineDiagramChord = showInlineDiagram && span >= minSpanForInline ? displayChord : null;
  const numStrings = INSTRUMENT_CONFIG[instrumentId]?.strings ?? 6;
  const diagramHorizontal = instrumentId === 'percussion';

  return (
    <div
      {...(isConcertActive ? { 'data-concert-active': '' } : {})}
      style={{
        gridColumn: `span ${spanToGridCols(span)}`,
        ...(color ? { borderColor: color.border, borderLeftWidth: '5px' } : {}),
        ...((isActive || isConcertActive) && !color ? { borderColor: 'var(--accent)' } : {}),
      }}
      className={`
        chord-cell relative rounded-lg border-[1.5px] min-h-12 flex items-center justify-center
        bg-[var(--cell-bg)] border-[#8a7a6a]
        ${span <= 0.5 ? 'bg-[#f7f3ec] border-[var(--ink-faint)]' : ''}
        ${isActive && !color ? 'border-[var(--accent)]' : ''}
        print:min-h-10 print:border
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Sweep animation — lecture normale */}
      {isActive && activeStep && (
        <div
          className="absolute inset-0 origin-left pointer-events-none"
          style={{
            background: color ? color.border.substring(0, 7) + '21' : 'rgba(200,75,47,0.13)',
            animation: `beatSweep ${activeStep.durationMs}ms linear forwards`,
          }}
        />
      )}
      {/* Sweep animation — mode concert batteur (même rendu que le play natif) */}
      {isConcertActive && (concertCellDurationMs ?? 0) > 0 && (
        <div
          className="absolute inset-0 origin-left pointer-events-none"
          style={{
            background: color ? color.border.substring(0, 7) + '21' : 'rgba(200,75,47,0.13)',
            animation: `beatSweep ${concertCellDurationMs}ms linear forwards`,
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center gap-1 py-1">
        <span className={`chord-name font-mono font-medium text-[var(--ink)] ${span <= 0.5 ? 'text-sm' : 'text-base'} print:text-sm`}>
          {bassRoot ? translate(bassRoot) : translate(lookupChord)}
        </span>
        {/* Diagramme inline — cliquable pour jouer, avec overlay ▶ au survol */}
        {inlineDiagramChord && (
          <div
            className="group/play relative cursor-pointer print:hidden"
            onClick={(e) => {
              e.stopPropagation();
              if (playableChord) playChord(playableChord, instrumentId, capo);
            }}
            title="Cliquer pour écouter"
          >
            {!isPianoChord(inlineDiagramChord) ? (
              <ChordDiagram chord={inlineDiagramChord} size="xs" numStrings={numStrings} horizontal={diagramHorizontal} />
            ) : (
              <PianoKeyboard chord={inlineDiagramChord} />
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity rounded bg-[var(--ink)]/10 print:hidden">
              <span className="text-[var(--ink)] text-xs opacity-70">▶</span>
            </div>
          </div>
        )}
      </div>

      {span <= 0.5 && (
        <span className="absolute bottom-0.5 left-1 text-[8px] text-[var(--ink-faint)] font-mono print:hidden">
          {span === 0.25 ? '¼' : '½'}
        </span>
      )}

      {/* Popup diagramme au survol — seulement si l'option inline est désactivée */}
      {hovered && (!showInlineDiagram || span < minSpanForInline) && displayChord && (
        <div
          className="print:hidden absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="bg-[var(--cell-bg)] rounded-xl shadow-lg border border-[var(--line)] p-3 min-w-[140px]">
            <div
              className="group/play relative flex justify-center cursor-pointer"
              onClick={(e) => { e.stopPropagation(); playChord(displayChord, instrumentId, capo); }}
              title="Cliquer pour écouter"
            >
              {!isPianoChord(displayChord) ? (
                <ChordDiagram chord={displayChord} size="sm" numStrings={numStrings} horizontal={diagramHorizontal} />
              ) : (
                <PianoKeyboard chord={displayChord} />
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity rounded-lg bg-[var(--ink)]/10">
                <span className="text-[var(--ink)] text-sm opacity-70">▶</span>
              </div>
            </div>
            <div className="text-center mt-2 text-sm font-medium text-[var(--ink)]">
              {translate(lookupChord)}
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 bg-[var(--cell-bg)] border-[var(--line)] border-l border-t transform rotate-45" />
        </div>
      )}
    </div>
  );
}
