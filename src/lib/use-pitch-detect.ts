'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// Détection de hauteur par NSDF (Normalized Square Difference, méthode McLeod) :
// robuste aux erreurs d'octave, avec un score de clarté pour rejeter le bruit.
// Plage de recherche bornée (≈ 38–1400 Hz) pour limiter le coût et éviter les
// fausses détections. Renvoie { freq, clarity } ou null si signal trop faible/flou.
function detectPitch(buf: Float32Array, sampleRate: number, minFreq: number, maxFreq: number): { freq: number; clarity: number } | null {
  const SIZE = buf.length;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  // Seuil très bas : on capte même les sons faibles / la fin d'une note. Ce n'est pas
  // le volume qui décide si c'est une vraie note, mais la CLARTÉ du NSDF (plus bas).
  if (rms < 0.0012) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.min(Math.floor(sampleRate / minFreq), SIZE - 1);

  // NSDF sur la plage de lags utile.
  const nsdf = new Float32Array(maxLag + 2);
  for (let tau = minLag; tau <= maxLag; tau++) {
    let acf = 0;
    let m = 0;
    for (let i = 0; i < SIZE - tau; i++) {
      const a = buf[i];
      const b = buf[i + tau];
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }

  // Pics locaux ; on retient le plus haut, puis le PREMIER pic ≥ 0.9×max
  // (= fondamentale, ce qui évite de sauter à l'octave).
  let maxPeak = 0;
  const peaks: number[] = [];
  for (let tau = minLag + 1; tau < maxLag; tau++) {
    if (nsdf[tau] > nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1] && nsdf[tau] > 0) {
      peaks.push(tau);
      if (nsdf[tau] > maxPeak) maxPeak = nsdf[tau];
    }
  }
  if (peaks.length === 0 || maxPeak < 0.4) return null; // pas assez clair (rejette le bruit)

  const threshold = 0.92 * maxPeak;
  let chosen = peaks[0];
  for (const t of peaks) { if (nsdf[t] >= threshold) { chosen = t; break; } }

  // Correction d'octave-haute : si la période DOUBLE (octave en dessous) correspond au
  // moins aussi bien, c'est la vraie fondamentale — on avait attrapé une harmonique
  // (typique à l'attaque : 160 Hz qui devrait être 80). Sans risque pour un son propre,
  // où le pic à 2×période est nettement plus faible.
  for (let k = 0; k < 2; k++) {
    const lag2 = chosen * 2;
    if (lag2 > maxLag) break;
    const w = Math.max(2, Math.round(chosen * 0.06));
    let best2 = -1;
    let bestVal2 = -1;
    for (let t = Math.max(minLag, lag2 - w); t <= Math.min(maxLag, lag2 + w); t++) {
      if (nsdf[t] > bestVal2) { bestVal2 = nsdf[t]; best2 = t; }
    }
    // Seuil strict (>=) : un son propre a un pic plus faible à 2×période, donc pas de
    // fausse correction ; une vraie fondamentale attrapée en harmonique, elle, matche au moins autant.
    if (best2 > 0 && bestVal2 >= nsdf[chosen]) chosen = best2; else break;
  }

  // Interpolation parabolique autour du pic pour la précision.
  const x1 = nsdf[chosen - 1] ?? 0;
  const x2 = nsdf[chosen] ?? 0;
  const x3 = nsdf[chosen + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  let tauEst = chosen;
  if (a) tauEst = chosen - b / (2 * a);
  if (tauEst <= 0) return null;

  const f = sampleRate / tauEst;
  // Rejet hors de la plage de l'instrument : élimine le ronflement secteur (~50/60 Hz)
  // et les hautes fréquences parasites (harmoniques, sifflements…).
  if (f < minFreq || f > maxFreq) return null;

  return { freq: f, clarity: maxPeak };
}

function median(arr: number[]): number {
  const s = [...arr].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

export function usePitchDetect(minFreq = 38, maxFreq = 1400) {
  const [freq, setFreq] = useState<number | null>(null);
  /**
   * Niveau d'entrée, de 0 à 1.
   *
   * Rendu à l'écran plutôt que gardé pour nous : quand rien ne se détecte, la seule
   * question utile est de savoir si le micro entend quelque chose. Sans cette
   * indication, on ne peut pas distinguer un micro muet d'une note trop floue pour
   * être reconnue — et sur un téléphone, où le niveau de capture varie beaucoup d'un
   * appareil à l'autre, c'est la première chose à vérifier.
   */
  const [level, setLevel] = useState(0);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<'denied' | 'error' | null>(null);

  // Plage de détection (dépend de l'instrument) lue dans la boucle via une ref, pour
  // qu'un changement d'instrument s'applique sans relancer le micro.
  const rangeRef = useRef({ min: minFreq, max: maxFreq });
  useEffect(() => { rangeRef.current = { min: minFreq, max: maxFreq }; }, [minFreq, maxFreq]);

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const historyRef = useRef<number[]>([]);
  const silentRef = useRef(0);
  const lastTickRef = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    bufRef.current = null;
    historyRef.current = [];
    silentRef.current = 0;
    setListening(false);
    setFreq(null);
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const AudioCtxCtor = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? AudioContext;
      const ctx = new AudioCtxCtor();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192; // fenêtre longue (~185 ms) : meilleure tenue sur les graves
      source.connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);
      historyRef.current = [];
      silentRef.current = 0;
      lastTickRef.current = 0;
      setListening(true);

      const loop = (now: number) => {
        rafRef.current = requestAnimationFrame(loop);
        // ~30 analyses/s (le NSDF sur 8192 est coûteux, inutile de le faire à 60 fps).
        if (now - lastTickRef.current < 33) return;
        lastTickRef.current = now;

        const a = analyserRef.current;
        const buf = bufRef.current;
        const c = ctxRef.current;
        if (!a || !buf || !c) return;
        a.getFloatTimeDomainData(buf);

        // Niveau efficace, ramené sur une échelle lisible. La racine étale le bas de
        // la plage, là où se joue la différence entre « rien » et « faible ».
        let somme = 0;
        for (let i = 0; i < buf.length; i++) somme += buf[i] * buf[i];
        const rms = Math.sqrt(somme / buf.length);
        const brut = Math.min(1, Math.sqrt(rms * 12));
        // Lissage : une jauge qui saute à chaque image ne se lit pas.
        setLevel((prev) => prev + (brut - prev) * 0.25);

        const { min, max } = rangeRef.current;
        const d = detectPitch(buf, c.sampleRate, min, max);

        if (d) {
          silentRef.current = 0;
          const h = historyRef.current;
          h.push(d.freq);
          if (h.length > 5) h.shift();
          setFreq(median(h)); // médiane : rejette un saut d'octave isolé
        } else {
          silentRef.current += 1;
          // Maintien plus long (~0.6 s) : ne pas repasser à « joue une note » pendant
          // la fin d'une note qui décline ou un bref creux de clarté.
          if (silentRef.current > 18) { historyRef.current = []; setFreq(null); }
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setError((e as { name?: string })?.name === 'NotAllowedError' ? 'denied' : 'error');
      setListening(false);
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { freq, level, listening, error, start, stop };
}
