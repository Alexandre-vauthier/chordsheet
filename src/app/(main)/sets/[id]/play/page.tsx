'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useSet } from '@/lib/use-sets';
import { useConcertSession } from '@/lib/use-concert-session';
import { useGroups } from '@/lib/use-groups';
import { parseTempo } from '@/lib/use-playback';
import { playMetronomeTick } from '@/lib/chord-audio';
import { SheetViewer } from '@/components/sheet/sheet-viewer';
import { Button } from '@/components/ui/button';
import type { Section } from '@/types';

interface SetPlayPageProps {
  params: Promise<{ id: string }>;
}

// Calcule quelle cellule doit être mise en évidence à l'instant T
// Même logique que buildSequence dans use-playback.ts
function calculateConcertCell(
  sections: Section[],
  startTimeMs: number,
  bpm: number,
  tempoUnit?: 'quarter' | 'eighth'
): { sectionIdx: number; rowIdx: number; cellIdx: number; remainingMs: number; preLaunch?: boolean } | null {
  const elapsed = Date.now() - startTimeMs;

  // Pré-lancement : trouver la première cellule pour la mettre en évidence statiquement
  if (elapsed < 0) {
    for (let si = 0; si < sections.length; si++) {
      for (let ri = 0; ri < sections[si].rows.length; ri++) {
        for (let ci = 0; ci < sections[si].rows[ri].length; ci++) {
          if (sections[si].rows[ri][ci].chord)
            return { sectionIdx: si, rowIdx: ri, cellIdx: ci, remainingMs: 0, preLaunch: true };
        }
      }
    }
    return null;
  }

  const factor = tempoUnit === 'eighth' ? 0.5 : 1;
  const beatMs = (60000 / bpm) * factor;
  let accumulated = 0;
  let lastChord: { sectionIdx: number; rowIdx: number; cellIdx: number; remainingMs: number } | null = null;

  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];
    const beatsPerMeasure = section.beatsPerMeasure || 4;
    for (let rep = 0; rep < (section.repeat || 1); rep++) {
      for (let ri = 0; ri < section.rows.length; ri++) {
        const rowRepeat = section.rowRepeats?.[ri] ?? 1;
        for (let rr = 0; rr < rowRepeat; rr++) {
          const row = section.rows[ri];
          let lastNonEmpty = row.length - 1;
          while (lastNonEmpty > 0 && !row[lastNonEmpty].chord.trim()) lastNonEmpty--;
          for (let ci = 0; ci <= lastNonEmpty; ci++) {
            const cell = row[ci];
            const dur = cell.span * beatsPerMeasure * beatMs;
            if (elapsed < accumulated + dur) {
              const remainingMs = accumulated + dur - elapsed;
              return cell.chord
                ? { sectionIdx: si, rowIdx: ri, cellIdx: ci, remainingMs }
                : lastChord;
            }
            accumulated += dur;
            if (cell.chord) lastChord = { sectionIdx: si, rowIdx: ri, cellIdx: ci, remainingMs: 0 };
          }
        }
      }
    }
  }
  return null;
}

export default function SetPlayPage({ params }: SetPlayPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { set, sheets, isLoading, error } = useSet(id);

  const isGroupSet = !!set?.groupId;
  const isDrummer = user?.preferredInstrument === 'percussion';

  const { currentIndex: syncedIndex, isSynced, goToSheet, autoScroll, startAutoScroll, stopAutoScroll } = useConcertSession(
    isGroupSet ? id : undefined,
    isGroupSet ? set?.groupId : undefined
  );
  const { groups, endConcert } = useGroups();
  const activeConcert = groups.find(g => g.id === set?.groupId)?.activeConcert;

  const [localIndex, setLocalIndex] = useState(0);
  const currentIndex = isGroupSet ? syncedIndex : localIndex;

  const setIndex = useCallback((index: number) => {
    if (isGroupSet) goToSheet(index);
    else setLocalIndex(index);
  }, [isGroupSet, goToSheet]);

  const currentSheet = sheets[currentIndex];

  // ── Batteur : count-in + métronome ─────────────────────────────────────────
  const [countBeat, setCountBeat] = useState(0); // 0 = inactif, 1-8 = décompte
  const countTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const metronomeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopMetronome = useCallback(() => {
    if (metronomeRef.current) {
      clearInterval(metronomeRef.current);
      metronomeRef.current = null;
    }
  }, []);

  const cancelCountIn = useCallback(() => {
    countTimersRef.current.forEach(clearTimeout);
    countTimersRef.current = [];
    setCountBeat(0);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    stopMetronome();
  }, [stopMetronome]);

  const startCountIn = useCallback(() => {
    if (!currentSheet || !isGroupSet || !isDrummer) return;
    cancelCountIn();

    const bpm = parseTempo(currentSheet.tempo || '90');
    const msPerBeat = 60000 / bpm;

    // Clicks Web Audio
    try {
      const AudioCtxCtor = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? AudioContext;
      const audioCtx = new AudioCtxCtor();
      audioCtxRef.current = audioCtx;

      for (let i = 0; i < 8; i++) {
        const time = audioCtx.currentTime + (i * msPerBeat / 1000);
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        // Accent sur les beats 1 et 5 (début de chaque groupe de 4)
        osc.frequency.value = i % 4 === 0 ? 1200 : 900;
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.setValueAtTime(i % 4 === 0 ? 0.9 : 0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        osc.start(time);
        osc.stop(time + 0.1);
      }
    } catch { /* AudioContext non supporté */ }

    // Compteur visuel
    for (let beat = 1; beat <= 8; beat++) {
      const t = setTimeout(() => setCountBeat(beat), (beat - 1) * msPerBeat);
      countTimersRef.current.push(t);
    }

    // Après 8 temps : lancer l'auto-scroll + démarrer le métronome continu
    const endT = setTimeout(() => {
      setCountBeat(0);
      const finalBpm = parseTempo(currentSheet.tempo || '90');
      startAutoScroll(currentIndex, finalBpm);
      // Métronome continu pour le batteur
      const beatsPerMeasure = currentSheet.sections[0]?.beatsPerMeasure || 4;
      let beat = 0;
      stopMetronome();
      metronomeRef.current = setInterval(() => {
        playMetronomeTick(beat === 0);
        beat = (beat + 1) % beatsPerMeasure;
      }, msPerBeat);
    }, 8 * msPerBeat);
    countTimersRef.current.push(endT);
  }, [currentSheet, isGroupSet, isDrummer, currentIndex, startAutoScroll, cancelCountIn, stopMetronome]);

  // Cleanup au démontage
  useEffect(() => () => cancelCountIn(), [cancelCountIn]);

  // ── Auto-scroll : boucle RAF ────────────────────────────────────────────────
  const [concertCellPath, setConcertCellPath] = useState<{
    sectionIdx: number; rowIdx: number; cellIdx: number; durationMs: number;
  } | null>(null);
  const rafRef = useRef<number>(0);
  const prevConcertPathRef = useRef<{ sectionIdx: number; rowIdx: number; cellIdx: number } | null>(null);
  const prevPreLaunchRef = useRef<boolean>(false);

  useEffect(() => {
    if (!autoScroll || autoScroll.sheetIndex !== currentIndex || !currentSheet) {
      setConcertCellPath(null);
      prevConcertPathRef.current = null;
      prevPreLaunchRef.current = false;
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const result = calculateConcertCell(
        currentSheet.sections,
        autoScroll.startTimeMs,
        autoScroll.bpm,
        currentSheet.tempoUnit
      );
      if (!result) {
        setConcertCellPath(null);
        prevConcertPathRef.current = null;
        return;
      }
      const { remainingMs, preLaunch, ...path } = result;
      const prev = prevConcertPathRef.current;
      const pathChanged = !prev || prev.sectionIdx !== path.sectionIdx || prev.rowIdx !== path.rowIdx || prev.cellIdx !== path.cellIdx;
      const launchStateChanged = (preLaunch ?? false) !== prevPreLaunchRef.current;
      if (pathChanged || launchStateChanged) {
        setConcertCellPath({ ...path, durationMs: remainingMs });
        prevConcertPathRef.current = path;
        prevPreLaunchRef.current = preLaunch ?? false;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoScroll, currentIndex, currentSheet]);

  // ── Navigation clavier ──────────────────────────────────────────────────────
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < sheets.length - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (hasPrevious) setIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        if (hasNext) setIndex(currentIndex + 1);
      } else if (e.key === 'Escape') {
        router.push(`/sets/${id}`);
      }
    },
    [hasPrevious, hasNext, currentIndex, setIndex, router, id]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Rendu ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error || !set || sheets.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-red-600 mb-4">{error || 'Set vide ou non trouvé'}</p>
        <button onClick={() => router.push('/sets')} className="text-[var(--accent)] hover:underline">
          Retour aux sets
        </button>
      </div>
    );
  }

  const isAutoScrollActive = !!autoScroll && autoScroll.sheetIndex === currentIndex;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Barre de navigation */}
      <div className="bg-[var(--nav-bg)] text-[var(--nav-text)] py-2 px-4 print:hidden sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/sets/${id}`}
              className="text-sm text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] transition-colors"
            >
              ← Quitter
            </Link>
            <div className="h-4 w-px bg-white/20" />
            <span className="text-sm font-medium">{set.name}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Indicateur de synchro */}
            {isGroupSet && (
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isSynced ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
                <span className="text-xs text-[var(--nav-text)]/70">
                  {isSynced ? 'Synchro' : 'Connexion…'}
                </span>
              </div>
            )}
            {isGroupSet && activeConcert && (
              <button
                onClick={() => endConcert(set!.groupId!).catch(() => {})}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition-colors"
                title="Terminer le concert pour tous"
              >
                <span className="w-1.5 h-1.5 rounded bg-white" />
                Terminer
              </button>
            )}
            <span className="text-sm text-[var(--nav-text)]/70">
              {currentIndex + 1} / {sheets.length}
            </span>
          </div>
        </div>
      </div>

      {/* Mini-liste des grilles */}
      <div className="bg-[var(--cell-bg)] border-b border-[var(--line)] py-2 px-4 print:hidden">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sheets.map((sheet, index) => (
              <button
                key={sheet.id}
                onClick={() => setIndex(index)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs transition-all
                  ${index === currentIndex
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--line)]'
                  }`}
              >
                {index + 1}. {sheet.title || 'Sans titre'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grille courante */}
      <div className="flex-1">
        {currentSheet && (
          <SheetViewer
            sheet={currentSheet}
            concertCellPath={concertCellPath ?? undefined}
          />
        )}
      </div>

      {/* Barre de navigation bas (sticky) — inclut les contrôles batteur */}
      <div className="bg-[var(--cell-bg)] border-t border-[var(--line)] print:hidden sticky bottom-0">
        {/* Rangée batteur */}
        {isGroupSet && isDrummer && (
          <div className="border-b border-[var(--line)] py-2 px-4 flex items-center justify-center gap-4">
            {countBeat > 0 ? (
              <>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(b => (
                    <div
                      key={b}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-100 ${
                        b === countBeat
                          ? 'bg-red-500 text-white scale-125'
                          : b < countBeat
                            ? 'bg-red-200 text-red-600'
                            : 'bg-[var(--line)] text-[var(--ink-faint)]'
                      }`}
                    >
                      {b}
                    </div>
                  ))}
                </div>
                <button
                  onClick={startCountIn}
                  className="px-3 py-1 text-xs rounded-lg border border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--ink-faint)] transition-colors"
                >
                  ↺ Recommencer
                </button>
              </>
            ) : isAutoScrollActive ? (
              <button
                onClick={() => { stopMetronome(); stopAutoScroll().catch(() => {}); }}
                className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <span className="w-2 h-2 rounded bg-white" />
                Arrêter
              </button>
            ) : (
              <button
                onClick={startCountIn}
                className="flex items-center gap-2 px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <span className="text-sm leading-none">▶</span>
                Play
              </button>
            )}
          </div>
        )}

        {/* Rangée navigation */}
        <div className="py-4 px-6 max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setIndex(currentIndex - 1)}
            disabled={!hasPrevious}
            className="min-w-[120px]"
          >
            ← Précédent
          </Button>

          <div className="text-center">
            <p className="font-medium text-[var(--ink)]">
              {currentSheet?.title || 'Sans titre'}
            </p>
            {currentSheet?.artist && (
              <p className="text-sm text-[var(--ink-light)]">{currentSheet.artist}</p>
            )}
          </div>

          <Button
            variant={hasNext ? 'primary' : 'ghost'}
            onClick={() => setIndex(currentIndex + 1)}
            disabled={!hasNext}
            className="min-w-[120px]"
          >
            Suivant →
          </Button>
        </div>
      </div> {/* fin sticky bottom */}

      <div className="fixed bottom-20 right-4 text-xs text-[var(--ink-faint)] print:hidden">
        <kbd className="px-1.5 py-0.5 bg-[var(--line)] rounded">←</kbd> / <kbd className="px-1.5 py-0.5 bg-[var(--line)] rounded">→</kbd> pour naviguer
      </div>
    </div>
  );
}
