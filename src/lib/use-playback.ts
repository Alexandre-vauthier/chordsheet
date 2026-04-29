import { useState, useRef, useCallback, useEffect } from 'react';
import type { Section, Cell, InstrumentId, StringChord, PianoChord } from '@/types';
import { findChordVariants, enharmonicEquivalent, parseChordInput } from '@/lib/chord-data';
import { playChord, playMetronomeTick } from '@/lib/chord-audio';
import { useLibraryChords, libraryKey } from '@/lib/library-chords-context';

export interface PlayStep {
  sectionId: string;
  rowIndex: number;
  cellIndex: number;
  durationMs: number;
}

export function parseTempo(tempoStr: string | undefined): number {
  if (!tempoStr) return 90;
  const match = tempoStr.match(/(\d+)/);
  if (!match) return 90;
  return Math.max(40, Math.min(300, parseInt(match[1])));
}

// Span = nombre de mesures (1 = 1 mesure, 0.5 = demi-mesure, etc.)
// Durée = span × beatsPerMeasure × beatMs (3 en ternaire, 4 en binaire).
function buildSequence(sections: Section[], beatMs: number): PlayStep[] {
  const steps: PlayStep[] = [];
  for (const section of sections) {
    const bpm = section.beatsPerMeasure || 4;
    for (let rep = 0; rep < (section.repeat || 1); rep++) {
      for (let r = 0; r < section.rows.length; r++) {
        const rowRepeat = section.rowRepeats?.[r] ?? 1;
        for (let rr = 0; rr < rowRepeat; rr++) {
          const row = section.rows[r];
          // Trouver le dernier index avec un accord non vide
          let lastNonEmpty = row.length - 1;
          while (lastNonEmpty > 0 && !row[lastNonEmpty].chord.trim()) {
            lastNonEmpty--;
          }
          for (let c = 0; c <= lastNonEmpty; c++) {
            steps.push({
              sectionId: section.id,
              rowIndex: r,
              cellIndex: c,
              durationMs: row[c].span * bpm * beatMs,
            });
          }
        }
      }
    }
  }
  return steps;
}

type TempoUnit = 'quarter' | 'eighth';

const TEMPO_UNIT_FACTOR: Record<TempoUnit, number> = {
  quarter: 1,
  eighth: 0.5,
};

interface UsePlaybackOptions {
  sections: Section[];
  tempo: string | undefined;
  tempoUnit?: TempoUnit;
  instrumentId: InstrumentId;
  customChords?: Record<string, unknown>;
  selectedChords?: Record<string, StringChord | PianoChord>;
  metronomeEnabled?: boolean;
  capo?: number;
}

export function usePlayback({ sections, tempo, tempoUnit, instrumentId, customChords, selectedChords, metronomeEnabled, capo = 0 }: UsePlaybackOptions) {
  const { overrides, additions } = useLibraryChords();
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState<PlayStep | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metronomeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs pour que le useEffect métronome accède aux valeurs courantes
  const factor = TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
  const beatMsRef = useRef<number>((60 / parseTempo(tempo)) * 1000 * factor);
  const bpMeasureRef = useRef<number>(sections[0]?.beatsPerMeasure || 4);

  // Mettre à jour les refs quand tempo/tempoUnit/sections changent
  useEffect(() => {
    beatMsRef.current = (60 / parseTempo(tempo)) * 1000 * TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
  }, [tempo, tempoUnit]);
  useEffect(() => {
    bpMeasureRef.current = sections[0]?.beatsPerMeasure || 4;
  }, [sections]);

  // Ref pour que le tick accède à metronomeEnabled sans redémarrer l'interval
  const metronomeEnabledRef = useRef(metronomeEnabled ?? false);
  useEffect(() => {
    metronomeEnabledRef.current = metronomeEnabled ?? false;
  }, [metronomeEnabled]);

  // Le métronome tourne dès que isPlaying — le toggle ne fait que mute/unmute
  useEffect(() => {
    if (metronomeRef.current) {
      clearInterval(metronomeRef.current);
      metronomeRef.current = null;
    }
    if (isPlaying) {
      let beat = 0;
      if (metronomeEnabledRef.current) playMetronomeTick(true);
      metronomeRef.current = setInterval(() => {
        beat = (beat + 1) % bpMeasureRef.current;
        if (metronomeEnabledRef.current) playMetronomeTick(beat === 0);
      }, beatMsRef.current);
    }
    return () => {
      if (metronomeRef.current) {
        clearInterval(metronomeRef.current);
        metronomeRef.current = null;
      }
    };
  }, [isPlaying]);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setIsPlaying(false);
    setActiveStep(null);
  }, []);

  // Stop on unmount (navigation)
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (metronomeRef.current) clearInterval(metronomeRef.current);
    };
  }, []);

  const resolveChord = useCallback((rawChordName: string): StringChord | PianoChord | undefined => {
    const chordName = parseChordInput(rawChordName).chord;
    const selected = selectedChords?.[chordName] ?? selectedChords?.[rawChordName];
    const customKey = `${chordName.toLowerCase()}-${instrumentId}`;
    const custom = customChords?.[customKey];
    const enh = enharmonicEquivalent(chordName);
    const adminOverride =
      overrides.get(libraryKey(chordName, instrumentId))?.chord ??
      (enh ? overrides.get(libraryKey(enh, instrumentId))?.chord : undefined);
    const nameLower = chordName.trim().toLowerCase();
    const enhLower = enh?.trim().toLowerCase();
    const adminAddition = additions.find(
      a => a.instrumentId === instrumentId &&
        (a.chord.name.trim().toLowerCase() === nameLower ||
         (enhLower && a.chord.name.trim().toLowerCase() === enhLower))
    )?.chord;
    return (
      selected ??
      (custom as StringChord | PianoChord | undefined) ??
      adminOverride ??
      adminAddition ??
      findChordVariants(chordName, instrumentId)[0]
    );
  }, [instrumentId, customChords, selectedChords, overrides, additions]);

  const runSteps = useCallback((steps: PlayStep[], getCellFn: (step: PlayStep) => Cell | undefined) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!steps.length) return;
    setIsPlaying(true);
    let i = 0;
    const advance = () => {
      if (i >= steps.length) { setIsPlaying(false); setActiveStep(null); return; }
      const step = steps[i];
      setActiveStep(step);
      const cell = getCellFn(step);
      if (cell?.chord) {
        const chordData = resolveChord(cell.chord);
        if (chordData) playChord(chordData, instrumentId, capo);
      }
      i++;
      timeoutRef.current = setTimeout(advance, step.durationMs);
    };
    advance();
  }, [resolveChord, instrumentId, capo]);

  const playSequence = useCallback((targetSections: Section[]) => {
    const bpm = parseTempo(tempo);
    const factor = TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
    const beatMs = (60 / bpm) * 1000 * factor;
    const steps = buildSequence(targetSections, beatMs);
    runSteps(steps, (step) =>
      targetSections.find(s => s.id === step.sectionId)?.rows[step.rowIndex]?.[step.cellIndex]
    );
  }, [tempo, tempoUnit, runSteps]);

  const playRow = useCallback((sectionId: string, rowIndex: number) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    const bpm = parseTempo(tempo);
    const factor = TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
    const beatMs = (60 / bpm) * 1000 * factor;
    const bpmeasure = section.beatsPerMeasure || 4;
    const rowRepeat = section.rowRepeats?.[rowIndex] ?? 1;
    const row = section.rows[rowIndex];
    if (!row) return;
    const steps: PlayStep[] = [];
    for (let rr = 0; rr < rowRepeat; rr++) {
      let lastNonEmpty = row.length - 1;
      while (lastNonEmpty > 0 && !row[lastNonEmpty].chord.trim()) lastNonEmpty--;
      for (let c = 0; c <= lastNonEmpty; c++) {
        steps.push({ sectionId, rowIndex, cellIndex: c, durationMs: row[c].span * bpmeasure * beatMs });
      }
    }
    runSteps(steps, (step) => section.rows[step.rowIndex]?.[step.cellIndex]);
  }, [sections, tempo, tempoUnit, runSteps]);

  const play = useCallback(() => {
    playSequence(sections);
  }, [sections, playSequence]);

  const playSection = useCallback((sectionId: string) => {
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx !== -1) playSequence(sections.slice(idx));
  }, [sections, playSequence]);

  const togglePlay = useCallback(() => {
    if (isPlaying) stop(); else play();
  }, [isPlaying, stop, play]);

  return { isPlaying, activeStep, play, stop, playSection, playRow, togglePlay };
}
