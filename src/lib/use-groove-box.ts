'use client';

import { useEffect, useRef } from 'react';
import { DrumMachine } from 'smplr';
import { getAudioContext } from './chord-audio';

// ─── Voix disponibles (kit LM-2 "LinnDrum") ──────────────────────────────────
// Le LinnDrum a été le premier échantillonneur de batterie du marché : ses sons
// sont de vrais fûts enregistrés, pas une synthèse analogique (contrairement au
// kit CR-78 utilisé auparavant) — c'est ce qui rend la boîte à rythme réaliste.

export type Voice =
  | 'kick' | 'snare' | 'snareGhost' | 'hihatClosed' | 'hihatOpen' | 'ride'
  | 'rimshot' | 'clap' | 'cowbell' | 'tomHigh' | 'tomLow' | 'congaHigh'
  | 'congaLow' | 'crash' | 'tambourine';

const VOICE_SAMPLE: Record<Voice, { group: string; velocity: number }> = {
  kick:        { group: 'kick',       velocity: 120 },
  snare:       { group: 'snare-h',    velocity: 110 },
  snareGhost:  { group: 'snare-l',    velocity: 55 },
  hihatClosed: { group: 'hhclosed',   velocity: 70 },
  hihatOpen:   { group: 'hhopen',     velocity: 75 },
  ride:        { group: 'ride',       velocity: 75 },
  rimshot:     { group: 'stick-h',    velocity: 95 },
  clap:        { group: 'clap',       velocity: 100 },
  cowbell:     { group: 'cowbell',    velocity: 90 },
  tomHigh:     { group: 'tom-h',      velocity: 100 },
  tomLow:      { group: 'tom-l',      velocity: 100 },
  congaHigh:   { group: 'conga-h',    velocity: 90 },
  congaLow:    { group: 'conga-l',    velocity: 90 },
  crash:       { group: 'crash',      velocity: 100 },
  tambourine:  { group: 'tambourine', velocity: 70 },
};

const ALL_VOICES = Object.keys(VOICE_SAMPLE) as Voice[];

// ─── Synthèse de secours (le temps que les échantillons LM-2 chargent) ──────

function synthKick(ctx: AudioContext, dest: AudioNode, t: number) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.07);
  const env = ctx.createGain();
  env.gain.setValueAtTime(1.0, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  const dist = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = (Math.PI + 120) * x / (Math.PI + 120 * Math.abs(x));
  }
  dist.curve = curve;
  osc.connect(env); env.connect(dist); dist.connect(dest);
  osc.start(t); osc.stop(t + 0.4);
  const cLen = Math.floor(ctx.sampleRate * 0.006);
  const cBuf = ctx.createBuffer(1, cLen, ctx.sampleRate);
  const cCh = cBuf.getChannelData(0);
  for (let i = 0; i < cLen; i++) cCh[i] = Math.random() * 2 - 1;
  const cSrc = ctx.createBufferSource(); cSrc.buffer = cBuf;
  const cEnv = ctx.createGain();
  cEnv.gain.setValueAtTime(0.4, t);
  cEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.006);
  cSrc.connect(cEnv); cEnv.connect(dest);
  cSrc.start(t);
}

function synthSnare(ctx: AudioContext, dest: AudioNode, t: number) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(185, t);
  const oscEnv = ctx.createGain();
  oscEnv.gain.setValueAtTime(0.7, t);
  oscEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(oscEnv); oscEnv.connect(dest);
  osc.start(t); osc.stop(t + 0.1);
  const nLen = Math.floor(ctx.sampleRate * 0.18);
  const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const nCh = nBuf.getChannelData(0);
  for (let i = 0; i < nLen; i++) nCh[i] = Math.random() * 2 - 1;
  const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.6;
  const nEnv = ctx.createGain();
  nEnv.gain.setValueAtTime(0.85, t);
  nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  nSrc.connect(bp); bp.connect(nEnv); nEnv.connect(dest);
  nSrc.start(t); nSrc.stop(t + 0.18);
}

const HIHAT_FREQS = [205.3, 269.2, 327.0, 420.8, 495.0, 605.8];

function synthHihat(ctx: AudioContext, dest: AudioNode, t: number, vol = 0.28) {
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
  const env = ctx.createGain();
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  hp.connect(env); env.connect(dest);
  for (const freq of HIHAT_FREQS) {
    const osc = ctx.createOscillator();
    osc.type = 'square'; osc.frequency.value = freq;
    osc.connect(hp); osc.start(t); osc.stop(t + 0.05);
  }
}

function playVoiceFallback(ctx: AudioContext, dest: AudioNode, voice: Voice, t: number) {
  if (voice === 'kick') synthKick(ctx, dest, t);
  else if (voice === 'snare') synthSnare(ctx, dest, t);
  else if (voice === 'hihatClosed') synthHihat(ctx, dest, t);
  // Les autres voix n'ont pas d'équivalent synthétisé : silencieuses tant que
  // les échantillons ne sont pas prêts (quelques centaines de ms au premier play).
}

// ─── Patterns (16 pas = une mesure 4/4, 8 premiers = 3/4 tronqué) ───────────

type Pattern = Partial<Record<Voice, number[]>>;

interface PatternDef {
  id: string;
  label: string;
  category: string;
  pattern: Pattern;
}

export const PATTERN_DEFS: PatternDef[] = [
  {
    id: 'rock', label: 'Rock', category: 'Rock / Pop',
    pattern: { kick: [0, 8], snare: [4, 12], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
  },
  {
    id: 'rockDriving', label: 'Rock (dynamique)', category: 'Rock / Pop',
    pattern: { kick: [0, 3, 8, 11], snare: [4, 12], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
  },
  {
    id: 'pop', label: 'Pop', category: 'Rock / Pop',
    pattern: { kick: [0, 4, 8, 12], snare: [4, 12], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
  },
  {
    id: 'popBallad', label: 'Pop (ballade)', category: 'Rock / Pop',
    pattern: { kick: [0, 8], rimshot: [4, 12], hihatClosed: [2, 6, 10, 14] },
  },
  {
    id: 'jazz', label: 'Jazz (ride)', category: 'Jazz / Blues',
    pattern: { kick: [0], snare: [4, 8], ride: [0, 4, 6, 8, 12, 14] },
  },
  {
    id: 'jazzBrush', label: 'Jazz (balais)', category: 'Jazz / Blues',
    pattern: { kick: [0], snareGhost: [2, 6, 10, 14], ride: [0, 8] },
  },
  {
    id: 'blues', label: 'Blues', category: 'Jazz / Blues',
    pattern: { kick: [0, 8], snare: [4, 12], hihatClosed: [0, 3, 6, 8, 11, 14] },
  },
  {
    id: 'bluesShuffle', label: 'Blues (shuffle)', category: 'Jazz / Blues',
    pattern: { kick: [0, 3, 8, 11], snare: [4, 12], hihatClosed: [0, 3, 6, 8, 11, 14] },
  },
  {
    id: 'reggae', label: 'Reggae', category: 'Reggae / Latin',
    pattern: { kick: [8], snare: [4, 12], hihatClosed: [1, 3, 5, 7, 9, 11, 13, 15] },
  },
  {
    id: 'reggaeSkank', label: 'Reggae (skank)', category: 'Reggae / Latin',
    pattern: { kick: [8], rimshot: [4, 12], hihatClosed: [1, 3, 5, 7, 9, 11, 13, 15] },
  },
  {
    id: 'bossa', label: 'Bossa nova', category: 'Reggae / Latin',
    pattern: { kick: [0, 3, 8, 11], rimshot: [4, 12], congaLow: [2, 6, 10, 14], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
  },
  {
    id: 'samba', label: 'Samba', category: 'Reggae / Latin',
    pattern: { kick: [0, 8], congaHigh: [0, 2, 4, 6, 8, 10, 12, 14], congaLow: [3, 7, 11, 15], cowbell: [2, 6, 10, 14] },
  },
  {
    id: 'funk', label: 'Funk', category: 'Funk / Soul',
    pattern: { kick: [0, 3, 8, 11], snare: [4, 7, 12], hihatClosed: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  },
  {
    id: 'funkGhost', label: 'Funk (ghost notes)', category: 'Funk / Soul',
    pattern: {
      kick: [0, 3, 6, 8, 11], snare: [4, 7, 12], snareGhost: [1, 5, 9, 13, 15],
      cowbell: [2, 6, 10, 14], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14], hihatOpen: [15],
    },
  },
  {
    id: 'country', label: 'Country', category: 'Country / Folk',
    pattern: { kick: [0, 8], rimshot: [4, 12], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
  },
  {
    id: 'countryTrain', label: 'Country (train beat)', category: 'Country / Folk',
    pattern: { kick: [0, 4, 8, 12], rimshot: [2, 6, 10, 14], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
  },
];

const PATTERNS: Record<string, Pattern> = Object.fromEntries(PATTERN_DEFS.map((p) => [p.id, p.pattern]));

const GENRE_MAP: Record<string, string> = {
  'Rock': 'rock', 'Metal': 'rock', 'Punk': 'rock',
  'Pop': 'pop', 'Chanson française': 'pop', 'Films': 'pop', 'Jeux vidéo': 'pop',
  'Jazz': 'jazz', 'Classique': 'jazz',
  'Blues': 'blues',
  'Reggae': 'reggae',
  'Funk': 'funk', 'Soul': 'funk', 'R&B': 'funk',
  'Bossa Nova': 'bossa', 'Latino': 'bossa',
  'Country': 'country', 'Folk': 'country',
};

function pickPatternId(genres: string[]): string {
  for (const g of genres) {
    const id = GENRE_MAP[g];
    if (id && PATTERNS[id]) return id;
  }
  return 'rock';
}

function resolvePattern(groovePattern: string | undefined, genres: string[]): Pattern {
  if (groovePattern && PATTERNS[groovePattern]) return PATTERNS[groovePattern];
  return PATTERNS[pickPatternId(genres)];
}

// ─── Instrument échantillonné partagé (chargé une seule fois, sur le même
// AudioContext que les accords — voir chord-audio.ts) ───────────────────────

type DrumMachineInstance = {
  load: Promise<unknown>;
  start: (event: { note: string; time: number; velocity?: number }) => (time?: number) => void;
};

let compressor: DynamicsCompressorNode | null = null;
let drumInstance: DrumMachineInstance | null = null;
let drumReady = false;

function ensureAudioGraph(ctx: AudioContext): AudioNode {
  if (!compressor) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;
    comp.connect(ctx.destination);
    compressor = comp;
  }
  if (!drumInstance) {
    const instance = DrumMachine(ctx, { instrument: 'LM-2', destination: compressor }) as unknown as DrumMachineInstance;
    drumInstance = instance;
    instance.load
      .then(() => { drumReady = true; })
      .catch(() => { drumInstance = null; drumReady = false; });
  }
  return compressor;
}

function playVoice(ctx: AudioContext, dest: AudioNode, voice: Voice, t: number) {
  if (drumReady && drumInstance) {
    const { group, velocity } = VOICE_SAMPLE[voice];
    drumInstance.start({ note: group, time: t, velocity });
    return;
  }
  playVoiceFallback(ctx, dest, voice, t);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGrooveBox({
  enabled,
  muted,
  bpm,
  beatsPerMeasure,
  genres,
  groovePattern,
}: {
  enabled: boolean;  // lifecycle : suit isPlaying
  muted: boolean;    // mute/unmute sans relancer la programmation
  bpm: number;
  beatsPerMeasure: number;
  genres: string[];
  groovePattern?: string; // id explicite (voir PATTERN_DEFS) ; sinon déduit des genres
}) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);
  const nextTimeRef = useRef(0);

  const bpmRef = useRef(bpm);
  const bpmPerMeasureRef = useRef(beatsPerMeasure);
  const patternRef = useRef(resolvePattern(groovePattern, genres));
  const mutedRef = useRef(muted);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { bpmPerMeasureRef.current = beatsPerMeasure; }, [beatsPerMeasure]);
  useEffect(() => { patternRef.current = resolvePattern(groovePattern, genres); }, [genres, groovePattern]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    const ctx = getAudioContext();
    const dest = ensureAudioGraph(ctx);
    stepRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.05;

    const tick = () => {
      const s16 = 15 / bpmRef.current;
      const stepsPerMeasure = bpmPerMeasureRef.current * 4;
      const pattern = patternRef.current;

      while (nextTimeRef.current < ctx.currentTime + 0.1) {
        const t = nextTimeRef.current;
        const m = stepRef.current % stepsPerMeasure;

        if (!mutedRef.current) {
          for (const voice of ALL_VOICES) {
            if (pattern[voice]?.includes(m)) {
              playVoice(ctx, dest, voice, t);
            }
          }
        }

        nextTimeRef.current += s16;
        stepRef.current = (stepRef.current + 1) % stepsPerMeasure;
      }
    };

    timerRef.current = setInterval(tick, 25);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled]);
}
