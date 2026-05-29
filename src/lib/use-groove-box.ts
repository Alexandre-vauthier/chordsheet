'use client';

import { useEffect, useRef, useMemo } from 'react';
import type { Section, InstrumentId } from '@/types';

// ─── Samples audio (Tone.js CDN — kit CR78) ──────────────────────────────────

const SAMPLE_URLS = {
  kick:  'https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3',
  snare: 'https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3',
  hihat: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3',
};

// Cache des bytes bruts — indépendant du contexte audio
const rawCache = new Map<string, ArrayBuffer>();

async function loadSample(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    let raw = rawCache.get(url);
    if (!raw) {
      const res = await fetch(url);
      if (!res.ok) return null;
      raw = await res.arrayBuffer();
      rawCache.set(url, raw);
    }
    // slice() obligatoire : decodeAudioData peut transférer (détacher) le buffer
    return await ctx.decodeAudioData(raw.slice(0));
  } catch {
    return null;
  }
}

function playSample(ctx: AudioContext, buf: AudioBuffer, dest: AudioNode, t: number, vol = 1) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(gain);
  gain.connect(dest);
  src.start(t);
}

// ─── Synthèse de secours / kick 808 ──────────────────────────────────────────

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

  // Click d'attaque
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

// ─── Basse ────────────────────────────────────────────────────────────────────

const ROOT_FREQS: Record<string, number> = {
  C: 65.41, 'C#': 69.30, Db: 69.30,
  D: 73.42, 'D#': 77.78, Eb: 77.78,
  E: 82.41, F: 87.31,
  'F#': 92.50, Gb: 92.50,
  G: 98.00, 'G#': 103.83, Ab: 103.83,
  A: 110.00, 'A#': 116.54, Bb: 116.54,
  B: 123.47,
};

function synthBass(ctx: AudioContext, dest: AudioNode, t: number, chord: string) {
  const root = chord.match(/^([A-G][#b]?)/)?.[1];
  if (!root || !ROOT_FREQS[root]) return;
  const osc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  const env = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(ROOT_FREQS[root], t);
  osc.connect(lp); lp.connect(env); env.connect(dest);
  env.gain.setValueAtTime(0.38, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc.start(t); osc.stop(t + 0.3);
}

// ─── Patterns ─────────────────────────────────────────────────────────────────

type Pattern = { k: boolean[]; s: boolean[]; h: boolean[] };

function pat(k: string, s: string, h: string): Pattern {
  const f = (str: string) => [...str].map(c => c === 'X');
  return { k: f(k), s: f(s), h: f(h) };
}

const PATTERNS: Record<string, Pattern> = {
  rock:    pat('X.......X.......', '....X.......X...', 'X.X.X.X.X.X.X.X.'),
  pop:     pat('X...X...X...X...', '....X.......X...', 'X.X.X.X.X.X.X.X.'),
  jazz:    pat('X...............', '....X...X.......', 'X...X.X.X...X.X.'),
  blues:   pat('X.......X.......', '....X.......X...', 'X..X..X.X..X..X.'),
  reggae:  pat('........X.......', '....X.......X...', '.X.X.X.X.X.X.X.X'),
  funk:    pat('X..X....X..X....', '....X..X....X...', 'XXXXXXXXXXXXXXXX'),
  bossa:   pat('X..X....X..X....', '....X.......X...', 'X.X.X.X.X.X.X.X.'),
  country: pat('X.......X.......', '....X.......X...', 'X.X.X.X.X.X.X.X.'),
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

// ─── Séquence d'accords ───────────────────────────────────────────────────────

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

type Samples = { kick: AudioBuffer | null; snare: AudioBuffer | null; hihat: AudioBuffer | null };

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
  const destRef = useRef<AudioNode | null>(null); // compresseur → destination
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
      destRef.current = null;
      samplesRef.current = null;
      return;
    }

    const ctx = new AudioContext();

    // Compresseur master — évite le clipping quand plusieurs sons jouent en même temps
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;
    comp.connect(ctx.destination);

    ctxRef.current = ctx;
    destRef.current = comp;
    stepRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.05;

    // Charger les samples en arrière-plan ; la synthèse joue immédiatement en secours
    Promise.all([
      loadSample(ctx, SAMPLE_URLS.kick),
      loadSample(ctx, SAMPLE_URLS.snare),
      loadSample(ctx, SAMPLE_URLS.hihat),
    ]).then(([kick, snare, hihat]) => {
      if (ctxRef.current === ctx) samplesRef.current = { kick, snare, hihat };
    });

    const tick = () => {
      const c = ctxRef.current;
      const d = destRef.current;
      if (!c || !d) return;
      const s16 = 15 / bpmRef.current;
      const stepsPerMeasure = bpmPerMeasureRef.current * 4;
      const pattern = patternRef.current;
      const seq = beatsRef.current;
      const samples = samplesRef.current;

      while (nextTimeRef.current < c.currentTime + 0.1) {
        const t = nextTimeRef.current;
        const m = stepRef.current % stepsPerMeasure;

        if (pattern.k[m]) {
          samples?.kick ? playSample(c, samples.kick, d, t, 1.0) : synthKick(c, d, t);
        }
        if (pattern.s[m]) {
          samples?.snare ? playSample(c, samples.snare, d, t, 0.9) : synthSnare(c, d, t);
        }
        if (pattern.h[m]) {
          samples?.hihat ? playSample(c, samples.hihat, d, t, 0.4) : synthHihat(c, d, t);
        }

        // Basse : joue la fondamentale à chaque changement d'accord
        if (instrumentRef.current !== 'bass') {
          const seqLen = seq.length || 1;
          const cur = stepRef.current % seqLen;
          const prev = (stepRef.current - 1 + seqLen) % seqLen;
          const chord = seq[cur];
          if (chord && chord !== seq[prev]) {
            synthBass(c, d, t, chord);
          }
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
      destRef.current = null;
      samplesRef.current = null;
    };
  }, [enabled]);
}
