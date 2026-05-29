'use client';

import { useEffect, useRef, useMemo } from 'react';
import type { Section, InstrumentId } from '@/types';

// ─── Samples audio (Tone.js CDN) ─────────────────────────────────────────────

const SAMPLE_URLS = {
  kick:  'https://tonejs.github.io/audio/drum-machine/kick.mp3',
  snare: 'https://tonejs.github.io/audio/drum-machine/snare.mp3',
  hihat: 'https://tonejs.github.io/audio/drum-machine/hihat.mp3',
};

// Cache module-level — partagé entre toutes les instances du hook
const sampleCache = new Map<string, AudioBuffer>();

async function loadSample(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  if (sampleCache.has(url)) return sampleCache.get(url)!;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    sampleCache.set(url, buf);
    return buf;
  } catch {
    return null;
  }
}

function playSample(ctx: AudioContext, buf: AudioBuffer, t: number, vol = 1, rate = 1) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(t);
}

// ─── Synthèse de secours (si samples non encore chargés) ─────────────────────

function synthKick(ctx: AudioContext, t: number) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.connect(env); env.connect(ctx.destination);
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.35);
  env.gain.setValueAtTime(1.0, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.start(t); osc.stop(t + 0.36);
}

function synthSnare(ctx: AudioContext, t: number) {
  const len = Math.floor(ctx.sampleRate * 0.1);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 800;
  const env = ctx.createGain();
  src.connect(hp); hp.connect(env); env.connect(ctx.destination);
  env.gain.setValueAtTime(0.55, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  src.start(t); src.stop(t + 0.1);
}

function synthHihat(ctx: AudioContext, t: number, vol = 0.2) {
  const len = Math.floor(ctx.sampleRate * 0.025);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 10000;
  const env = ctx.createGain();
  src.connect(hp); hp.connect(env); env.connect(ctx.destination);
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
  src.start(t); src.stop(t + 0.025);
}

// ─── Basse synthétisée ────────────────────────────────────────────────────────

const ROOT_FREQS: Record<string, number> = {
  C: 65.41, 'C#': 69.30, Db: 69.30,
  D: 73.42, 'D#': 77.78, Eb: 77.78,
  E: 82.41, F: 87.31,
  'F#': 92.50, Gb: 92.50,
  G: 98.00, 'G#': 103.83, Ab: 103.83,
  A: 110.00, 'A#': 116.54, Bb: 116.54,
  B: 123.47,
};

function synthBass(ctx: AudioContext, t: number, chord: string) {
  const root = chord.match(/^([A-G][#b]?)/)?.[1];
  if (!root || !ROOT_FREQS[root]) return;
  const osc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  const env = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(ROOT_FREQS[root], t);
  osc.connect(lp); lp.connect(env); env.connect(ctx.destination);
  env.gain.setValueAtTime(0.38, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc.start(t); osc.stop(t + 0.3);
}

// ─── Patterns (16 steps = une mesure 4/4, X = jouer, . = silence) ─────────────

type Pattern = { k: boolean[]; s: boolean[]; h: boolean[]; b: boolean[] };

function pat(k: string, s: string, h: string, b: string): Pattern {
  const f = (str: string) => [...str].map(c => c === 'X');
  return { k: f(k), s: f(s), h: f(h), b: f(b) };
}

const PATTERNS: Record<string, Pattern> = {
  rock:    pat('X.......X.......', '....X.......X...', 'X.X.X.X.X.X.X.X.', 'X.......X.......'),
  pop:     pat('X...X...X...X...', '....X.......X...', 'X.X.X.X.X.X.X.X.', 'X...............'),
  jazz:    pat('X...............', '....X...X.......', 'X...X.X.X...X.X.', 'X.......X.......'),
  blues:   pat('X.......X.......', '....X.......X...', 'X..X..X.X..X..X.', 'X.......X.......'),
  reggae:  pat('........X.......', '....X.......X...', '.X.X.X.X.X.X.X.X', 'X...............'),
  funk:    pat('X..X....X..X....', '....X..X....X...', 'XXXXXXXXXXXXXXXX', 'X.......X.......'),
  bossa:   pat('X..X....X..X....', '....X.......X...', 'X.X.X.X.X.X.X.X.', 'X.......X.......'),
  country: pat('X.......X.......', '....X.......X...', 'X.X.X.X.X.X.X.X.', 'X.......X.......'),
};

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

function pickPattern(genres: string[]): Pattern {
  for (const g of genres) {
    const k = GENRE_MAP[g];
    if (k && PATTERNS[k]) return PATTERNS[k];
  }
  return PATTERNS.rock;
}

// ─── Séquence d'accords aplatie ───────────────────────────────────────────────

function buildBeats(sections: Section[]): string[] {
  const out: string[] = [];
  for (const sec of sections) {
    for (let r = 0; r < (sec.repeat ?? 1); r++) {
      for (const row of sec.rows) {
        for (const cell of row) {
          const n = Math.round(cell.span * 4);
          for (let i = 0; i < n; i++) out.push(cell.chord ?? '');
        }
      }
    }
  }
  return out.length ? out : [''];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

type Samples = {
  kick: AudioBuffer | null;
  snare: AudioBuffer | null;
  hihat: AudioBuffer | null;
};

export function useGrooveBox({
  enabled,
  bpm,
  beatsPerMeasure,
  genres,
  instrumentId,
  sections,
}: {
  enabled: boolean;
  bpm: number;
  beatsPerMeasure: number;
  genres: string[];
  instrumentId: InstrumentId;
  sections: Section[];
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);
  const nextTimeRef = useRef(0);
  const samplesRef = useRef<Samples | null>(null);

  const beats = useMemo(() => buildBeats(sections), [sections]);

  const bpmRef = useRef(bpm);
  const bpmPerMeasureRef = useRef(beatsPerMeasure);
  const patternRef = useRef(pickPattern(genres));
  const instrumentRef = useRef(instrumentId);
  const beatsRef = useRef(beats);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { bpmPerMeasureRef.current = beatsPerMeasure; }, [beatsPerMeasure]);
  useEffect(() => { patternRef.current = pickPattern(genres); }, [genres]);
  useEffect(() => { instrumentRef.current = instrumentId; }, [instrumentId]);
  useEffect(() => { beatsRef.current = beats; }, [beats]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      samplesRef.current = null;
      return;
    }

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    stepRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.05;

    // Charger les samples en arrière-plan — le scheduler démarre immédiatement
    // avec la synthèse de secours, puis bascule sur les samples dès qu'ils sont prêts
    Promise.all([
      loadSample(ctx, SAMPLE_URLS.kick),
      loadSample(ctx, SAMPLE_URLS.snare),
      loadSample(ctx, SAMPLE_URLS.hihat),
    ]).then(([kick, snare, hihat]) => {
      if (ctxRef.current === ctx) {
        samplesRef.current = { kick, snare, hihat };
      }
    });

    const tick = () => {
      const c = ctxRef.current;
      if (!c) return;
      const s16 = 15 / bpmRef.current;
      const stepsPerMeasure = bpmPerMeasureRef.current * 4;
      const pattern = patternRef.current;
      const seq = beatsRef.current;
      const samples = samplesRef.current;

      while (nextTimeRef.current < c.currentTime + 0.1) {
        const t = nextTimeRef.current;
        const m = stepRef.current % stepsPerMeasure;

        if (pattern.k[m]) {
          samples?.kick ? playSample(c, samples.kick, t, 1.0) : synthKick(c, t);
        }
        if (pattern.s[m]) {
          samples?.snare ? playSample(c, samples.snare, t, 0.8) : synthSnare(c, t);
        }
        if (pattern.h[m]) {
          samples?.hihat ? playSample(c, samples.hihat, t, 0.35) : synthHihat(c, t);
        }
        if (pattern.b[m] && instrumentRef.current !== 'bass') {
          const chord = seq[stepRef.current % seq.length];
          if (chord) synthBass(c, t, chord);
        }

        nextTimeRef.current += s16;
        stepRef.current = (stepRef.current + 1) % (seq.length || 1);
      }
    };

    timerRef.current = setInterval(tick, 25);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ctx.close().catch(() => {});
      ctxRef.current = null;
      samplesRef.current = null;
    };
  }, [enabled]);
}
