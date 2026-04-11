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
// En 4/4 : 1 mesure = 4 noires. La durée d'une cellule = span × beatsPerMeasure × beatMs.
// Exemple : span 1 à 120 BPM en 4/4 → 1 × 4 × 500ms = 2000ms (4 temps).
function buildSequence(sections: Section[], beatMs: number): PlayStep[] {
  const steps: PlayStep[] = [];
  for (const section of sections) {
    const bpm = section.beatsPerMeasure || 4;
    for (let rep = 0; rep < (section.repeat || 1); rep++) {
      for (let r = 0; r < section.rows.length; r++) {
        const rowRepeat = section.rowRepeats?.[r] ?? 1;
        for (let rr = 0; rr < rowRepeat; rr++) {
          for (let c = 0; c < section.rows[r].length; c++) {
            steps.push({
              sectionId: section.id,
              rowIndex: r,
              cellIndex: c,
              durationMs: section.rows[r][c].span * bpm * beatMs,
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
  metronomeEnabled?: boolean;
}

export function usePlayback({ sections, tempo, instrumentId, customChords, metronomeEnabled }: UsePlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState<PlayStep | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metronomeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (metronomeRef.current) clearInterval(metronomeRef.current);
    timeoutRef.current = null;
    metronomeRef.current = null;
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
    if (metronomeRef.current) clearInterval(metronomeRef.current);

    const bpm = parseTempo(tempo);
    const beatMs = (60 / bpm) * 1000;
    const sequence = buildSequence(targetSections, beatMs);
    if (!sequence.length) return;

    setIsPlaying(true);

    // Métronome : tick à chaque beat (accent sur le premier temps de chaque mesure)
    if (metronomeEnabled) {
      const bpMeasure = targetSections[0]?.beatsPerMeasure || 4;
      let beat = 0;
      playMetronomeTick(true); // premier temps en accent
      metronomeRef.current = setInterval(() => {
        beat = (beat + 1) % bpMeasure;
        playMetronomeTick(beat === 0);
      }, beatMs);
    }

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
        const customKey = `${cell.chord.toLowerCase()}-${instrumentId}`;
        const custom = customChords?.[customKey];
        const chordData = custom ?? findChordVariants(cell.chord, instrumentId)[0];
        if (chordData) playChord(chordData as StringChord | PianoChord, instrumentId);
      }

      i++;
      timeoutRef.current = setTimeout(advance, step.durationMs);
    };

    advance();
  }, [tempo, instrumentId, customChords, metronomeEnabled]);

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
