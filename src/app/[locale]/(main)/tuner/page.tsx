'use client';

import { useState, useMemo } from 'react';
import { usePitchDetect } from '@/lib/use-pitch-detect';
import { TUNINGS, analyzeFreq, matchString, type TunerInstrument } from '@/lib/tuner-data';

type Mode = TunerInstrument | 'chromatic';

const MODES: { id: Mode; label: string }[] = [
  { id: 'guitar', label: 'Guitare' },
  { id: 'bass', label: 'Basse' },
  { id: 'ukulele', label: 'Ukulélé' },
  { id: 'mandolin', label: 'Mandoline' },
  { id: 'banjo', label: 'Banjo' },
  { id: 'chromatic', label: 'Chromatique' },
];

export default function TunerPage() {
  const [mode, setMode] = useState<Mode>('guitar');

  // Plage de détection bornée à l'instrument (±3 demi-tons autour des cordes) : élimine
  // le ronflement secteur (~50 Hz) et les hautes fréquences parasites hors de l'instrument.
  const range = useMemo(() => {
    if (mode === 'chromatic') return { min: 40, max: 1500 };
    const strs = TUNINGS[mode];
    const lo = Math.min(...strs.map((s) => s.freq));
    const hi = Math.max(...strs.map((s) => s.freq));
    return { min: lo * Math.pow(2, -3 / 12), max: hi * Math.pow(2, 3 / 12) };
  }, [mode]);

  const { freq, listening, error, start, stop } = usePitchDetect(range.min, range.max);

  const strings = mode === 'chromatic' ? null : TUNINGS[mode];
  const info = freq ? analyzeFreq(freq) : null;
  // Mode instrument : on replie la fréquence sur les cordes connues (anti-octave).
  const target = freq && strings ? matchString(strings, freq) : null;

  const cents = mode === 'chromatic' ? (info?.cents ?? null) : (target?.cents ?? null);
  const noteLabel = mode === 'chromatic' ? (info?.note ?? null) : (target?.string.note ?? null);
  const octaveLabel = mode === 'chromatic' ? (info?.octave ?? null) : (target?.string.octave ?? null);
  const inTune = cents != null && Math.abs(cents) <= 5;
  const pos = cents == null ? 50 : Math.max(2, Math.min(98, 50 + cents)); // aiguille (0-100%)

  const status =
    cents == null ? 'Joue une corde…'
      : inTune ? 'Juste ✓'
        : cents < 0 ? 'Trop grave — serre la corde'
          : 'Trop aigu — desserre la corde';

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mb-1">Accordeur</h1>
      <p className="text-sm text-[var(--ink-light)] mb-6">Choisis ton instrument, active le micro et joue une corde à vide.</p>

      {/* Sélecteur d'instrument */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              mode === m.id
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Zone d'affichage */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--cell-bg)] p-6 sm:p-8 text-center">
        {!listening ? (
          <div className="py-6">
            <div className="text-4xl mb-3">🎙️</div>
            <button
              onClick={start}
              className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
            >
              Activer le micro
            </button>
            {error === 'denied' && (
              <p className="text-sm text-red-500 mt-3">Micro refusé. Autorise l&apos;accès au micro dans ton navigateur puis réessaie.</p>
            )}
            {error === 'error' && (
              <p className="text-sm text-red-500 mt-3">Micro indisponible sur cet appareil / navigateur.</p>
            )}
          </div>
        ) : (
          <>
            {/* Note détectée */}
            <div className={`font-playfair font-bold leading-none transition-colors ${inTune ? 'text-green-500' : 'text-[var(--ink)]'}`}>
              <span className="text-6xl">{noteLabel ?? '—'}</span>
              {octaveLabel != null && <span className="text-2xl align-top ml-1 text-[var(--ink-faint)]">{octaveLabel}</span>}
            </div>
            <p className="text-xs text-[var(--ink-faint)] mt-1 h-4">
              {freq ? `${freq.toFixed(1)} Hz` : ''}{cents != null ? ` · ${cents > 0 ? '+' : ''}${cents} cents` : ''}
            </p>

            {/* Aiguille */}
            <div className="relative h-14 mt-4 mb-2">
              {/* graduations */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-[var(--line)]" />
              {/* zone juste (centre) */}
              <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-green-500/30" />
              {/* repère central */}
              <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-[var(--ink-faint)]" />
              {/* aiguille */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-8 rounded-full transition-[left] duration-100 ${inTune ? 'bg-green-500' : 'bg-[var(--accent)]'}`}
                style={{ left: `${pos}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--ink-faint)] px-1">
              <span>♭ grave</span><span>juste</span><span>aigu ♯</span>
            </div>

            <p className={`mt-4 text-sm font-medium ${inTune ? 'text-green-500' : 'text-[var(--ink-light)]'}`}>{status}</p>

            <button
              onClick={stop}
              className="mt-5 px-4 py-2 border border-[var(--line)] text-[var(--ink-light)] text-sm rounded-lg hover:border-[var(--ink-faint)] transition-colors"
            >
              Arrêter le micro
            </button>
          </>
        )}
      </div>

      {/* Cordes cibles (mode instrument) */}
      {strings && (
        <div className="mt-6">
          <p className="text-xs text-[var(--ink-faint)] uppercase tracking-wide mb-2">Cordes (grave → aigu)</p>
          <div className="flex flex-wrap gap-2">
            {strings.map((str, i) => {
              const active = listening && target?.index === i;
              return (
                <div
                  key={i}
                  className={`px-3 py-2 rounded-lg border text-sm font-mono transition-colors ${
                    active
                      ? (inTune ? 'border-green-500 bg-green-500/10 text-green-600' : 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]')
                      : 'border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink-light)]'
                  }`}
                >
                  {str.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
