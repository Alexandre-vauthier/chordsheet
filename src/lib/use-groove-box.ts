'use client';

import { useEffect, useRef } from 'react';
import { DrumMachine } from 'smplr';
import { getAudioContext } from './chord-audio';
import { chargerKit, echantillon, kitParDefaut, restaurerKit } from './drum-kits';

// ─── Voix disponibles (kit LM-2 "LinnDrum") ──────────────────────────────────
// Le LinnDrum a été le premier échantillonneur de batterie du marché : ses sons
// sont de vrais fûts enregistrés, pas une synthèse analogique (contrairement au
// kit CR-78 utilisé auparavant) — c'est ce qui rend la boîte à rythme réaliste.

export type Voice =
  | 'kick' | 'snare' | 'snareGhost' | 'hihatClosed' | 'hihatOpen' | 'ride'
  | 'rimshot' | 'clap' | 'cowbell' | 'tomHigh' | 'tomLow' | 'congaHigh'
  | 'congaLow' | 'crash' | 'tambourine';

const VOICE_SAMPLE: Record<Voice, { group: string; velocity: number }> = {
  kick:        { group: 'kick',       velocity: 115 },
  // snare-h (vélocité "hard") est un échantillon nettement plus court/fin que
  // les variantes snare-m/snare-l dans ce kit — rendu clinquant. snare-m sonne
  // plus plein pour le coup de caisse claire principal.
  snare:       { group: 'snare-m',    velocity: 100 },
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

// ─── Patterns (32 pas = 2 mesures en 4/4 ; pas 0-15 = mesure 1, 16-31 = mesure 2) ───
// Grooves écrits sur 2 mesures : la 2e varie (turnaround, ghosts, clave) pour éviter
// la boucle d'1 mesure. En 3/4, seul le début du motif est lu (approximation).

type Pattern = Partial<Record<Voice, number[]>>;

interface PatternDef {
  id: string;
  label: string;
  category: string;
  pattern: Pattern;
}

// Repères de pas sur 2 mesures (4/4)
const BEATS = [0, 4, 8, 12, 16, 20, 24, 28];                                  // les 8 temps
const BACKBEAT = [4, 12, 20, 28];                                             // temps 2 et 4
const OFFBEATS = [2, 6, 10, 14, 18, 22, 26, 30];                              // contretemps (croches off)
const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];  // croches
const EIGHTHS_NO_LAST = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
const SIXTEENTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
const SHUFFLE = [0, 3, 4, 7, 8, 11, 12, 15, 16, 19, 20, 23, 24, 27, 28, 31];  // feel ternaire (1 · a)

export const PATTERN_DEFS: PatternDef[] = [
  // ── Rock / Pop ──
  { id: 'rock', label: 'Rock', category: 'Rock / Pop',
    pattern: { kick: [0, 8, 16, 24, 30], snare: BACKBEAT, hihatClosed: EIGHTHS_NO_LAST, hihatOpen: [30] } },
  { id: 'rockDriving', label: 'Rock (dynamique)', category: 'Rock / Pop',
    pattern: { kick: [0, 3, 8, 11, 16, 19, 24, 27], snare: BACKBEAT, hihatClosed: EIGHTHS, crash: [0] } },
  { id: 'pop', label: 'Pop', category: 'Rock / Pop',
    pattern: { kick: BEATS, snare: BACKBEAT, clap: BACKBEAT, hihatClosed: EIGHTHS_NO_LAST, hihatOpen: [30] } },
  { id: 'popBallad', label: 'Pop (ballade)', category: 'Rock / Pop',
    pattern: { kick: [0, 8, 16, 24], rimshot: BACKBEAT, hihatClosed: OFFBEATS } },

  // ── Jazz / Blues ──
  { id: 'jazz', label: 'Jazz (swing)', category: 'Jazz / Blues',
    pattern: { ride: [0, 4, 6, 8, 12, 14, 16, 20, 22, 24, 28, 30], hihatClosed: BACKBEAT, kick: [0, 8, 16, 24], snareGhost: [10, 26] } },
  { id: 'jazzBrush', label: 'Jazz (balais)', category: 'Jazz / Blues',
    pattern: { ride: [0, 8, 16, 24], snareGhost: [2, 6, 10, 14, 18, 22, 26, 30], kick: [0, 16] } },
  { id: 'blues', label: 'Blues (shuffle)', category: 'Jazz / Blues',
    pattern: { kick: [0, 8, 16, 24], snare: BACKBEAT, hihatClosed: SHUFFLE } },
  { id: 'bluesShuffle', label: 'Blues (shuffle appuyé)', category: 'Jazz / Blues',
    pattern: { kick: [0, 3, 8, 11, 16, 19, 24, 27], snare: BACKBEAT, hihatClosed: SHUFFLE } },

  // ── Reggae / Latin ──
  { id: 'reggae', label: 'Reggae (one drop)', category: 'Reggae / Latin',
    pattern: { kick: [8, 24], snare: [8, 24], hihatClosed: EIGHTHS } },
  { id: 'reggaeSkank', label: 'Reggae (steppers)', category: 'Reggae / Latin',
    pattern: { kick: BEATS, rimshot: [8, 24], hihatClosed: OFFBEATS } },
  { id: 'bossa', label: 'Bossa nova', category: 'Reggae / Latin',
    pattern: { kick: [0, 6, 8, 14, 16, 22, 24, 30], rimshot: [0, 6, 12, 20, 26], hihatClosed: EIGHTHS } },
  { id: 'samba', label: 'Samba', category: 'Reggae / Latin',
    pattern: { kick: [0, 4, 12, 16, 20, 28], congaHigh: EIGHTHS, congaLow: [3, 7, 11, 15, 19, 23, 27, 31], cowbell: [0, 3, 6, 10, 13, 16, 19, 22, 26, 29] } },

  // ── Funk / Soul ──
  { id: 'funk', label: 'Funk', category: 'Funk / Soul',
    pattern: { kick: [0, 6, 10, 16, 22, 26], snare: BACKBEAT, snareGhost: [2, 9, 14, 18, 25, 30], hihatClosed: SIXTEENTHS } },
  { id: 'funkGhost', label: 'Funk (ghost notes)', category: 'Funk / Soul',
    pattern: { kick: [0, 3, 6, 10, 16, 19, 22, 26], snare: BACKBEAT, snareGhost: [1, 5, 7, 9, 13, 17, 21, 23, 25, 29], hihatClosed: EIGHTHS, hihatOpen: [15, 31], cowbell: OFFBEATS } },

  // ── Hip Hop / Urban ──
  { id: 'hiphop', label: 'Hip Hop (boom bap)', category: 'Hip Hop / Urban',
    pattern: { kick: [0, 6, 16, 22], snare: BACKBEAT, snareGhost: [10, 26], hihatClosed: EIGHTHS } },
  { id: 'trap', label: 'Trap', category: 'Hip Hop / Urban',
    pattern: { kick: [0, 3, 11, 16, 22], clap: [8, 24], hihatClosed: SIXTEENTHS } },

  // ── Country / Folk ──
  { id: 'country', label: 'Country', category: 'Country / Folk',
    pattern: { kick: [0, 8, 16, 24], rimshot: BACKBEAT, hihatClosed: EIGHTHS } },
  { id: 'countryTrain', label: 'Country (train beat)', category: 'Country / Folk',
    pattern: { kick: [0, 8, 16, 24], snare: BACKBEAT, snareGhost: [0, 2, 6, 8, 10, 14, 16, 18, 22, 24, 26, 30] } },
];

const PATTERNS: Record<string, Pattern> = Object.fromEntries(PATTERN_DEFS.map((p) => [p.id, p.pattern]));

const GENRE_MAP: Record<string, string> = {
  'Rock': 'rock', 'Metal': 'rock', 'Punk': 'rock',
  'Pop': 'pop', 'Chanson française': 'pop', 'Films': 'pop', 'Jeux vidéo': 'pop',
  'Jazz': 'jazz', 'Classique': 'jazz',
  'Blues': 'blues',
  'Reggae': 'reggae',
  'Funk': 'funk', 'Soul': 'funk', 'R&B': 'funk',
  'Hip Hop / Rap': 'hiphop',
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
    // Réglages plus doux qu'avant : la compression d'origine visait à donner du
    // corps à la synthèse de secours (signal faible) ; sur de vrais échantillons,
    // elle écrasait les transitoires (attaque de caisse claire notamment).
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 6;
    comp.ratio.value = 3;
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
  // Un kit local, s'il couvre cette voix, passe avant le LM-2. Voix par voix :
  // un kit incomplet n'oblige pas à renoncer au reste.
  const local = echantillon(voice);
  if (local) {
    const src = ctx.createBufferSource();
    src.buffer = local;
    const gain = ctx.createGain();
    // Même dosage que pour le LM-2 : la vélocité de la voix fait le niveau, donc
    // l'équilibre du kit se conserve d'un jeu d'échantillons à l'autre.
    gain.gain.value = VOICE_SAMPLE[voice].velocity / 127;
    src.connect(gain);
    gain.connect(dest);
    src.start(t);
    return;
  }

  if (drumReady && drumInstance) {
    const { group, velocity } = VOICE_SAMPLE[voice];
    drumInstance.start({ note: group, time: t, velocity });
    return;
  }
  playVoiceFallback(ctx, dest, voice, t);
}

/** Ce que chaque voix va chercher dans le kit : échantillon et vélocité. */
export const VOICE_INFO: Record<Voice, { group: string; velocity: number }> = VOICE_SAMPLE;
export const VOICES = ALL_VOICES;

/**
 * Frappe une voix seule, tout de suite.
 *
 * Même chemin que la boîte à rythme — mêmes échantillons, même compresseur, même
 * repli sur la synthèse tant que le kit charge : ce qu'on entend au pad est
 * exactement ce qu'on entendra dans un motif.
 */
export function frapperVoix(voice: Voice): void {
  const ctx = getAudioContext();
  const dest = ensureAudioGraph(ctx);
  playVoice(ctx, dest, voice, ctx.currentTime);
}

/** Les échantillons du kit sont-ils chargés, ou la synthèse de secours joue-t-elle ? */
export function kitCharge(): boolean {
  return drumReady;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGrooveBox({
  enabled,
  muted,
  bpm,
  beatsPerMeasure,
  genres,
  groovePattern,
  kitDefaut,
}: {
  enabled: boolean;  // lifecycle : suit isPlaying
  muted: boolean;    // mute/unmute sans relancer la programmation
  bpm: number;
  beatsPerMeasure: number;
  genres: string[];
  groovePattern?: string; // id explicite (voir PATTERN_DEFS) ; sinon déduit des genres
  /**
   * Kit à employer si personne n'en a choisi. Ne s'inscrit pas dans le navigateur.
   *
   * Sert au visiteur non connecté, à qui on veut faire entendre une vraie
   * batterie plutôt que la boîte à rythmes de synthèse.
   */
  kitDefaut?: string;
}) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);
  const nextTimeRef = useRef(0);

  const bpmRef = useRef(bpm);
  const bpmPerMeasureRef = useRef(beatsPerMeasure);
  const patternRef = useRef(resolvePattern(groovePattern, genres));
  const mutedRef = useRef(muted);

  /**
   * Rendre au kit choisi sa place, sur toute page qui joue un rythme.
   *
   * Le choix vivait en mémoire de module et dans `localStorage`, mais seule la
   * page d'essai le relisait : sur une grille rechargée, la boîte à rythme
   * repartait du LM-2 sans rien dire. Il se restaure donc ici, au point de
   * passage commun.
   *
   * Le chargement démarre au montage et non au premier temps : les échantillons
   * sont là avant qu'on appuie sur lecture, sinon la première mesure sonnerait
   * avec l'autre kit.
   */
  useEffect(() => {
    const choisi = restaurerKit();
    if (choisi) { void chargerKit(choisi, ALL_VOICES); return; }
    if (!kitDefaut || !kitParDefaut(kitDefaut)) return;

    // Un kit pèse quelques mégaoctets. Choisi, on le télécharge tout de suite :
    // c'est une décision, il doit être prêt. Simple défaut, on attend que le
    // navigateur soit tranquille — la page doit s'afficher d'abord, et il reste
    // le temps du clic sur Lecture avant que le premier temps ne tombe.
    const lancer = () => { void chargerKit(kitDefaut, ALL_VOICES); };
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) {
      const id = ric(lancer, { timeout: 4000 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const id = setTimeout(lancer, 1500);
    return () => clearTimeout(id);
  }, [kitDefaut]);

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

      const cycle = stepsPerMeasure * 2; // phrase de 2 mesures (le motif est écrit sur 2 mesures)
      while (nextTimeRef.current < ctx.currentTime + 0.1) {
        const t = nextTimeRef.current;
        const step = stepRef.current;

        if (!mutedRef.current) {
          for (const voice of ALL_VOICES) {
            if (pattern[voice]?.includes(step)) {
              playVoice(ctx, dest, voice, t);
            }
          }
        }

        nextTimeRef.current += s16;
        stepRef.current = (stepRef.current + 1) % cycle;
      }
    };

    timerRef.current = setInterval(tick, 25);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled]);
}
