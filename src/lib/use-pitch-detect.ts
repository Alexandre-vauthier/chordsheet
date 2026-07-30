'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// Autocorrélation (méthode classique Chris Wilson) : renvoie la fréquence fondamentale
// en Hz, ou -1 si le signal est trop faible / non tonal.
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // pas assez de signal

  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < thres) { r1 = i; break; } }
  for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; } }

  const b = buf.slice(r1, r2);
  const size2 = b.length;
  const c = new Array(size2).fill(0);
  for (let i = 0; i < size2; i++) {
    for (let j = 0; j < size2 - i; j++) c[i] += b[j] * b[j + i];
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < size2; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let t0 = maxpos;
  if (t0 <= 0) return -1;

  // Interpolation parabolique pour affiner.
  const x1 = c[t0 - 1] || 0;
  const x2 = c[t0] || 0;
  const x3 = c[t0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (a) t0 = t0 - bb / (2 * a);

  return sampleRate / t0;
}

export function usePitchDetect() {
  const [freq, setFreq] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<'denied' | 'error' | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    bufRef.current = null;
    setListening(false);
    setFreq(null);
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
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);
      setListening(true);

      const loop = () => {
        const a = analyserRef.current;
        const buf = bufRef.current;
        const c = ctxRef.current;
        if (!a || !buf || !c) return;
        a.getFloatTimeDomainData(buf);
        const f = autoCorrelate(buf, c.sampleRate);
        setFreq(f > 0 ? f : null);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setError((e as { name?: string })?.name === 'NotAllowedError' ? 'denied' : 'error');
      setListening(false);
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { freq, listening, error, start, stop };
}
