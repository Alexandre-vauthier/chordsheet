import { useState, useRef, useCallback, useEffect } from 'react';
import type { Section, Cell, InstrumentId, StringChord, PianoChord } from '@/types';
import { findChordVariants, enharmonicEquivalent, parseChordInput } from '@/lib/chord-data';
import { playChord, playArpeggio, playMetronomeTick, getAudioContext } from '@/lib/chord-audio';
import { useLibraryChords, libraryKey } from '@/lib/library-chords-context';

export interface PlayStep {
  sectionId: string;
  rowIndex: number;
  cellIndex: number;
  durationMs: number;
  rowRepeatIndex: number;
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
              rowRepeatIndex: rr,
            });
          }
        }
      }
    }
  }
  return steps;
}

export interface ChordSeqItem {
  sectionId: string;
  rowIndex: number;
  cellIndex: number;
  rowId: string;       // data-row-id de la mesure (pour le défilement)
  pos: string;         // data-pos de la cellule (pour le surlignage ciblé)
  chord: string;
  span: number;        // durée en mesures (pour calculer la durée d'une cellule)
  beats: number;       // temps par mesure de la section (3 ou 4)
  repeatIndex: number; // passage courant de la mesure répétée (0-based)
  rowRepeat: number;   // nombre total de passages de la mesure
}

// Séquence ordonnée des cellules porteuses d'accord, dans l'ordre de lecture
// (sections, répétitions de section puis de mesure). Base du suivi micro.
export function buildChordSequence(sections: Section[]): ChordSeqItem[] {
  const seq: ChordSeqItem[] = [];
  for (const section of sections) {
    for (let rep = 0; rep < (section.repeat || 1); rep++) {
      for (let r = 0; r < section.rows.length; r++) {
        const rowRepeat = section.rowRepeats?.[r] ?? 1;
        for (let rr = 0; rr < rowRepeat; rr++) {
          const row = section.rows[r];
          for (let c = 0; c < row.length; c++) {
            const chord = row[c].chord?.trim();
            if (!chord) continue;
            seq.push({
              sectionId: section.id,
              rowIndex: r,
              cellIndex: c,
              rowId: `${section.id}-${r}`,
              pos: `${section.id}:${r}:${c}`,
              chord,
              span: row[c].span,
              beats: section.beatsPerMeasure || 4,
              repeatIndex: rr,
              rowRepeat,
            });
          }
        }
      }
    }
  }
  return seq;
}

type TempoUnit = 'quarter' | 'eighth';

const TEMPO_UNIT_FACTOR: Record<TempoUnit, number> = {
  quarter: 1,
  eighth: 0.5,
};

export type PlayStyle = 'block' | 'arpeggio';
export interface PlaybackVoice {
  id: InstrumentId;
  style: PlayStyle;
}

// Instruments d'accompagnement proposés (ceux qui ont un son jouable).
// Partagé entre le lecteur (sheet-viewer) et l'éditeur (config de lecture par défaut).
export const ACCOMPANIMENT_INSTRUMENTS: InstrumentId[] = ['guitar', 'bass', 'piano', 'mandolin', 'banjo', 'ukulele'];

interface UsePlaybackOptions {
  sections: Section[];
  tempo: string | undefined;
  tempoUnit?: TempoUnit;
  instrumentId: InstrumentId;
  // Voix jouées simultanément à chaque accord (accompagnement), chacune avec son
  // style (plaqué / arpège). Défaut : le seul instrument principal, plaqué.
  playbackInstruments?: PlaybackVoice[];
  customChords?: Record<string, unknown>;
  selectedChords?: Record<string, StringChord | PianoChord>;
  metronomeEnabled?: boolean;
  chordsEnabled?: boolean;
  capo?: number;
}

export function usePlayback({ sections, tempo, tempoUnit, instrumentId, playbackInstruments, customChords, selectedChords, metronomeEnabled, chordsEnabled = true, capo = 0 }: UsePlaybackOptions) {
  const { overrides, additions } = useLibraryChords();
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState<PlayStep | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metronomeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs pour que le useEffect métronome accède aux valeurs courantes
  const factor = TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
  const beatMsRef = useRef<number>((60 / parseTempo(tempo)) * 1000 * factor);
  const bpMeasureRef = useRef<number>(sections[0]?.beatsPerMeasure || 4);
  const chordsEnabledRef = useRef(chordsEnabled);
  // Voix d'accompagnement, lues sans redémarrer la lecture en cours.
  const playbackVoicesRef = useRef<PlaybackVoice[]>(playbackInstruments ?? [{ id: instrumentId, style: 'block' }]);
  useEffect(() => {
    playbackVoicesRef.current = playbackInstruments ?? [{ id: instrumentId, style: 'block' }];
  }, [playbackInstruments, instrumentId]);

  // Mettre à jour les refs quand tempo/tempoUnit/sections changent
  useEffect(() => {
    beatMsRef.current = (60 / parseTempo(tempo)) * 1000 * TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
  }, [tempo, tempoUnit]);
  useEffect(() => {
    bpMeasureRef.current = sections[0]?.beatsPerMeasure || 4;
  }, [sections]);

  // Refs pour que les ticks accèdent aux flags sans redémarrer
  const metronomeEnabledRef = useRef(metronomeEnabled ?? false);
  useEffect(() => {
    metronomeEnabledRef.current = metronomeEnabled ?? false;
  }, [metronomeEnabled]);
  useEffect(() => {
    chordsEnabledRef.current = chordsEnabled;
  }, [chordsEnabled]);

  // Le métronome tourne dès que isPlaying — le toggle ne fait que mute/unmute.
  // Beat 0 est joué directement dans advance() pour être synchronisé avec le premier accord.
  // Planifié sur l'horloge audio (comme la boîte à rythme et les accords) pour
  // ne pas dériver : chaque beat vise un instant absolu, look-ahead de 100 ms.
  useEffect(() => {
    if (metronomeRef.current) {
      clearInterval(metronomeRef.current);
      metronomeRef.current = null;
    }
    if (isPlaying) {
      const ctx = getAudioContext();
      let beat = 1;                                  // beat 0 déjà joué dans advance()
      let nextBeat = ctx.currentTime + beatMsRef.current / 1000; // premier tick un temps après le départ
      const tick = () => {
        const beatSec = beatMsRef.current / 1000;
        while (nextBeat < ctx.currentTime + 0.1) {
          if (metronomeEnabledRef.current) playMetronomeTick(beat === 0, nextBeat);
          beat = (beat + 1) % bpMeasureRef.current;
          nextBeat += beatSec;
        }
      };
      tick();
      metronomeRef.current = setInterval(tick, 25);
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

  const resolveChord = useCallback((rawChordName: string, inst: InstrumentId): StringChord | PianoChord | undefined => {
    const chordName = parseChordInput(rawChordName).chord;
    const selected = selectedChords?.[chordName] ?? selectedChords?.[rawChordName];
    const customKey = `${chordName.toLowerCase()}-${inst}`;
    const custom = customChords?.[customKey];
    const enh = enharmonicEquivalent(chordName);
    const adminOverride =
      overrides.get(libraryKey(chordName, inst))?.chord ??
      (enh ? overrides.get(libraryKey(enh, inst))?.chord : undefined);
    const nameLower = chordName.trim().toLowerCase();
    const enhLower = enh?.trim().toLowerCase();
    const adminAddition = additions.find(
      a => a.instrumentId === inst &&
        (a.chord.name.trim().toLowerCase() === nameLower ||
         (enhLower && a.chord.name.trim().toLowerCase() === enhLower))
    )?.chord;
    return (
      selected ??
      (custom as StringChord | PianoChord | undefined) ??
      adminOverride ??
      adminAddition ??
      findChordVariants(chordName, inst)[0]
    );
  }, [customChords, selectedChords, overrides, additions]);

  const runSteps = useCallback((steps: PlayStep[], getCellFn: (step: PlayStep) => Cell | undefined) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!steps.length) return;
    setIsPlaying(true);
    // Ligne de temps sur l'horloge audio (comme la boîte à rythme) : chaque pas
    // vise un instant absolu, et le délai du setTimeout est recalculé à partir de
    // ctx.currentTime → la dérive du setTimeout est corrigée à chaque pas, donc
    // les accords ne glissent plus par rapport à la batterie.
    const ctx = getAudioContext();
    let nextTime = ctx.currentTime;
    let i = 0;
    const advance = () => {
      if (i >= steps.length) { setIsPlaying(false); setActiveStep(null); return; }
      const step = steps[i];
      setActiveStep(step);
      // Premier pas : tick beat 1 synchronisé exactement avec le premier accord
      if (i === 0 && metronomeEnabledRef.current) playMetronomeTick(true);
      const cell = getCellFn(step);
      if (cell?.chord && chordsEnabledRef.current) {
        // Jouer l'accord sur chaque voix d'accompagnement (voix indépendantes),
        // plaqué ou en arpège calé au tempo (croches sur la durée de la cellule).
        const eighthMs = beatMsRef.current / 2;
        for (const voice of playbackVoicesRef.current) {
          const chordData = resolveChord(cell.chord, voice.id);
          if (!chordData) continue;
          if (voice.style === 'arpeggio') {
            const steps = Math.max(1, Math.round(step.durationMs / eighthMs));
            playArpeggio(chordData, voice.id, capo, eighthMs, steps);
          } else {
            playChord(chordData, voice.id, capo);
          }
        }
      }
      i++;
      // Prochain pas calé sur l'horloge audio, avec correction de la dérive.
      nextTime += step.durationMs / 1000;
      const delayMs = Math.max(0, (nextTime - ctx.currentTime) * 1000);
      timeoutRef.current = setTimeout(advance, delayMs);
    };
    advance();
  }, [resolveChord, capo]);

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
        steps.push({ sectionId, rowIndex, cellIndex: c, durationMs: row[c].span * bpmeasure * beatMs, rowRepeatIndex: rr });
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
