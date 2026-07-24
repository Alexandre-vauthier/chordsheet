'use client';

// Prototype de détection d'accords en temps réel au micro.
// Reprend la méthode du service Python (services/chord-detector/chord_utils.py) :
// chromagramme → comparaison cosinus à 36 templates (maj / min / dom7).
// Objectif : évaluer la précision en conditions réelles avant d'envisager le
// suivi automatique de la grille. Rien n'est branché sur le sheet-viewer.

import { useRef, useState, useCallback, useEffect } from 'react';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface Template {
  name: string;
  vec: number[];
  penalty: number; // biais de simplicité : retranché du score cosinus au matching
}

// Un accord enrichi (4 notes) ne doit l'emporter sur la triade que s'il la bat
// de plus de COLOR_PENALTY. Sinon les harmoniques (ex. la quinte de la tierce)
// font gagner à tort un maj7/7/6 sur une simple triade jouée proprement.
const COLOR_PENALTY = 0.04;

function l2normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

// Familles d'accords : suffixe + intervalles (demi-tons depuis la fondamentale).
// Poids 0.7 sur les notes « de couleur » (7e, 6te, altérations) pour que les
// triades simples ne soient pas systématiquement étiquetées en accords enrichis.
// Rappel : le chromagramme ne voit que les 12 classes de notes, donc les accords
// faits des mêmes notes sont indiscernables (ex. C6 = Am7).
const QUALITIES: { suffix: string; intervals: [number, number][] }[] = [
  { suffix: '',      intervals: [[0, 1], [4, 1], [7, 1]] },            // majeur
  { suffix: 'm',     intervals: [[0, 1], [3, 1], [7, 1]] },            // mineur
  { suffix: '7',     intervals: [[0, 1], [4, 1], [7, 1], [10, 0.7]] }, // dominante 7
  { suffix: 'm7',    intervals: [[0, 1], [3, 1], [7, 1], [10, 0.7]] }, // mineur 7
  { suffix: 'maj7',  intervals: [[0, 1], [4, 1], [7, 1], [11, 0.7]] }, // majeur 7
  { suffix: '6',     intervals: [[0, 1], [4, 1], [7, 1], [9, 0.7]] },  // majeur 6
  { suffix: 'm6',    intervals: [[0, 1], [3, 1], [7, 1], [9, 0.7]] },  // mineur 6
  { suffix: 'sus2',  intervals: [[0, 1], [2, 1], [7, 1]] },            // sus2
  { suffix: 'sus4',  intervals: [[0, 1], [5, 1], [7, 1]] },            // sus4
  { suffix: 'dim',   intervals: [[0, 1], [3, 1], [6, 1]] },            // diminué
  { suffix: 'aug',   intervals: [[0, 1], [4, 1], [8, 1]] },            // augmenté
  { suffix: 'm7b5',  intervals: [[0, 1], [3, 1], [6, 1], [10, 0.7]] }, // demi-diminué
];

function makeTemplates(): Template[] {
  const templates: Template[] = [];
  for (let i = 0; i < 12; i++) {
    for (const q of QUALITIES) {
      const vec = new Array(12).fill(0);
      for (const [semitone, weight] of q.intervals) {
        vec[(i + semitone) % 12] = weight;
      }
      // Triades (3 notes) : aucun biais. Accords enrichis (4 notes) : pénalisés.
      const penalty = q.intervals.length >= 4 ? COLOR_PENALTY : 0;
      templates.push({ name: `${NOTES[i]}${q.suffix}`, vec: l2normalize(vec), penalty });
    }
  }
  return templates;
}

const TEMPLATES = makeTemplates();

export interface ChordCandidate {
  name: string;
  score: number;
}

export interface ChordListenerState {
  listening: boolean;
  chord: string;              // accord lissé affiché ('' si rien de fiable)
  confidence: number;         // score du meilleur candidat (0..1)
  chroma: number[];           // 12 bins normalisés (0..1) pour la visualisation
  candidates: ChordCandidate[]; // top 3 pour juger la précision
  error: string | null;
}

const INITIAL: ChordListenerState = {
  listening: false,
  chord: '',
  confidence: 0,
  chroma: new Array(12).fill(0),
  candidates: [],
  error: null,
};

// Paramètres réglables du prototype
const FFT_SIZE = 16384;       // résolution fréquentielle (grave mieux résolu)
const TICK_MS = 100;          // ~10 analyses/seconde
const F_MIN = 65;             // Hz (~C2) : on ignore le sub-grave
const F_MAX = 2000;           // Hz : on ignore l'aigu peu informatif pour l'accord
const SCORE_GATE = 0.72;      // score cosinus minimal pour valider un accord
const SMOOTH_WINDOW = 5;      // vote majoritaire sur N dernières analyses

export function useChordListener() {
  const [state, setState] = useState<ChordListenerState>(INITIAL);

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const historyRef = useRef<string[]>([]);
  const lastTickRef = useRef(0);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
    historyRef.current = [];
    lastTickRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setState((s) => ({ ...INITIAL, error: s.error }));
  }, [cleanup]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      await ctx.resume().catch(() => {}); // iOS : le contexte peut démarrer suspendu

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      setState((s) => ({ ...s, listening: true, error: null }));

      const bins = analyser.frequencyBinCount;
      const freqData = new Float32Array(bins);
      const sr = ctx.sampleRate;

      const tick = (ts: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (ts - lastTickRef.current < TICK_MS) return;
        lastTickRef.current = ts;

        const an = analyserRef.current;
        if (!an) return;
        an.getFloatFrequencyData(freqData);

        const chroma = new Array(12).fill(0);
        let energy = 0;
        for (let k = 0; k < bins; k++) {
          const f = (k * sr) / an.fftSize;
          if (f < F_MIN || f > F_MAX) continue;
          const mag = Math.pow(10, freqData[k] / 20); // dB → linéaire
          if (!isFinite(mag)) continue;
          const pitch = 69 + 12 * Math.log2(f / 440);
          const pc = ((Math.round(pitch) % 12) + 12) % 12;
          chroma[pc] += mag;
          energy += mag;
        }

        const maxBin = Math.max(...chroma, 1e-9);
        const chromaViz = chroma.map((x) => x / maxBin);
        const chromaNorm = l2normalize(chroma);

        // Score cosinus de tous les templates ; classement sur le score ajusté
        // (cosinus - biais de simplicité), mais on conserve le cosinus brut pour
        // l'affichage de la confiance.
        const scored = TEMPLATES.map((t) => {
          let dot = 0;
          for (let j = 0; j < 12; j++) dot += chromaNorm[j] * t.vec[j];
          return { name: t.name, score: dot, adj: dot - t.penalty };
        }).sort((a, b) => b.adj - a.adj);

        const best = scored[0];
        const gate = energy > 1e-3 && best.adj > SCORE_GATE;
        const detected = gate ? best.name : '';

        // Lissage : vote majoritaire sur les dernières analyses
        const hist = historyRef.current;
        hist.push(detected);
        if (hist.length > SMOOTH_WINDOW) hist.shift();
        const counts = new Map<string, number>();
        for (const c of hist) counts.set(c, (counts.get(c) || 0) + 1);
        let smooth = '';
        let smoothN = 0;
        counts.forEach((n, c) => { if (n > smoothN) { smoothN = n; smooth = c; } });

        setState((s) => ({
          ...s,
          chord: smooth,
          confidence: Math.max(0, Math.min(1, best.score)),
          chroma: chromaViz,
          candidates: scored.slice(0, 3),
        }));
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      cleanup();
      const msg = e instanceof Error ? e.message : 'Micro indisponible';
      setState((s) => ({ ...s, listening: false, error: msg }));
    }
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { ...state, start, stop };
}
