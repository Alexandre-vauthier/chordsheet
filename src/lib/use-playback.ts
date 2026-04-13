import { useState, useRef, useCallback, useEffect } from 'react';
import type { Section, InstrumentId, StringChord, PianoChord } from '@/types';
import { findChordVariants } from '@/lib/chord-data';
import { playChord, playMetronomeTick } from '@/lib/chord-audio';

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

interface UsePlaybackOptions {
  sections: Section[];
  tempo: string | undefined;
  instrumentId: InstrumentId;
  customChords?: Record<string, unknown>;
  selectedChords?: Record<string, StringChord | PianoChord>;
  metronomeEnabled?: boolean;
}

export function usePlayback({ sections, tempo, instrumentId, customChords, selectedChords, metronomeEnabled }: UsePlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState<PlayStep | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metronomeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs pour que le useEffect métronome accède aux valeurs courantes
  const beatMsRef = useRef<number>((60 / parseTempo(tempo)) * 1000);
  const bpMeasureRef = useRef<number>(sections[0]?.beatsPerMeasure || 4);

  // Mettre à jour les refs quand tempo/sections changent
  useEffect(() => {
    beatMsRef.current = (60 / parseTempo(tempo)) * 1000;
  }, [tempo]);
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

  const playSequence = useCallback((targetSections: Section[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const bpm = parseTempo(tempo);
    const beatMs = (60 / bpm) * 1000;
    const sequence = buildSequence(targetSections, beatMs);
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

      // Jouer l'accord
      const cell = targetSections
        .find(s => s.id === step.sectionId)
        ?.rows[step.rowIndex]?.[step.cellIndex];
      if (cell?.chord) {
        // Priorité : variante sélectionnée dans ChordSummary > accord custom > première variante statique
        const selected = selectedChords?.[cell.chord];
        const customKey = `${cell.chord.toLowerCase()}-${instrumentId}`;
        const custom = customChords?.[customKey];
        const chordData = selected ?? (custom as StringChord | PianoChord | undefined) ?? findChordVariants(cell.chord, instrumentId)[0];
        if (chordData) playChord(chordData as StringChord | PianoChord, instrumentId);
      }

      i++;
      timeoutRef.current = setTimeout(advance, step.durationMs);
    };

    advance();
  }, [tempo, instrumentId, customChords, selectedChords]);

  const play = useCallback(() => {
    playSequence(sections);
  }, [sections, playSequence]);

  const playSection = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section) playSequence([section]);
  }, [sections, playSequence]);

  const togglePlay = useCallback(() => {
    if (isPlaying) stop(); else play();
  }, [isPlaying, stop, play]);

  return { isPlaying, activeStep, play, stop, playSection, togglePlay };
}
