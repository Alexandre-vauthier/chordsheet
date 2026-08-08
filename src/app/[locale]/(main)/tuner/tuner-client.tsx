'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { usePitchDetect } from '@/lib/use-pitch-detect';
import { TUNINGS, GUITAR_TUNINGS, guitarTuning, analyzeFreq, matchString, type TunerInstrument } from '@/lib/tuner-data';
import { InstrumentIcon } from '@/components/chord/instrument-icon';

type Mode = TunerInstrument | 'chromatic';

const MODES: Mode[] = ['guitar', 'bass', 'ukulele', 'mandolin', 'banjo', 'chromatic'];

export function TunerClient() {
  const t = useTranslations('Tuner');
  // Les cinq instruments réutilisent le namespace Instruments, déjà traduit et
  // partagé avec le reste de l'application ; seul « chromatique » lui est propre.
  const tInstrument = useTranslations('Instruments');
  const modeLabel = (m: Mode) => (m === 'chromatic' ? t('chromatic') : tInstrument(m));

  const [mode, setMode] = useState<Mode>('guitar');
  /**
   * Accordage de guitare, seul instrument où l'on en change couramment.
   * Remis au standard dès qu'on quitte la guitare : revenir sur un ukulélé en
   * gardant « open G » en tête n'aurait aucun sens.
   */
  const [accordage, setAccordage] = useState('standard');

  // Plage de détection bornée à l'instrument (±3 demi-tons autour des cordes) : élimine
  // le ronflement secteur (~50 Hz) et les hautes fréquences parasites hors de l'instrument.
  const range = useMemo(() => {
    if (mode === 'chromatic') return { min: 40, max: 1500 };
    const strs = mode === 'guitar' ? guitarTuning(accordage) : TUNINGS[mode];
    const lo = Math.min(...strs.map((s) => s.freq));
    const hi = Math.max(...strs.map((s) => s.freq));
    return { min: lo * Math.pow(2, -3 / 12), max: hi * Math.pow(2, 3 / 12) };
  }, [mode, accordage]);

  const { freq, level, listening, error, start, stop } = usePitchDetect(range.min, range.max);

  const strings = mode === 'chromatic' ? null : mode === 'guitar' ? guitarTuning(accordage) : TUNINGS[mode];
  const info = freq ? analyzeFreq(freq) : null;
  // Mode instrument : on replie la fréquence sur les cordes connues (anti-octave).
  const target = freq && strings ? matchString(strings, freq) : null;

  const cents = mode === 'chromatic' ? (info?.cents ?? null) : (target?.cents ?? null);
  const noteLabel = mode === 'chromatic' ? (info?.note ?? null) : (target?.string.note ?? null);
  const octaveLabel = mode === 'chromatic' ? (info?.octave ?? null) : (target?.string.octave ?? null);
  const inTune = cents != null && Math.abs(cents) <= 5;
  const pos = cents == null ? 50 : Math.max(2, Math.min(98, 50 + cents)); // aiguille (0-100%)

  const status =
    cents == null ? t('statusIdle')
      : inTune ? t('statusInTune')
        : cents < 0 ? t('statusFlat')
          : t('statusSharp');

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mb-1">{t('h1')}</h1>
      <p className="text-sm text-[var(--ink-light)] mb-6">{t('intro')}</p>

      {/* Sélecteur d'instrument */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); if (m !== 'guitar') setAccordage('standard'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              mode === m
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            {/* « Chromatique » n'est pas un instrument : il n'a pas de dessin, et
                lui en inventer un dirait quelque chose de faux. */}
            {m !== 'chromatic' && <InstrumentIcon id={m} className="w-5 h-5" />}
            {modeLabel(m)}
          </button>
        ))}
      </div>

      {/* Accordages alternatifs : proposés pour la seule guitare, où l'on en change
          couramment. Les afficher partout encombrerait pour rien. */}
      {mode === 'guitar' && (
        <div className="flex flex-wrap items-center gap-2 mb-6 -mt-2">
          <span className="text-xs text-[var(--ink-faint)]">{t('tuningLabel')}</span>
          {GUITAR_TUNINGS.map((g) => (
            <button
              key={g.id}
              onClick={() => setAccordage(g.id)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                accordage === g.id
                  ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-medium'
                  : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)]'
              }`}
              title={guitarTuning(g.id).map((c) => c.label).join(' ')}
            >
              {t(`tuning.${g.id}`)}
            </button>
          ))}
        </div>
      )}

      {/* Zone d'affichage */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--cell-bg)] p-6 sm:p-8 text-center">
        {!listening ? (
          <div className="py-6">
            <div className="text-4xl mb-3">🎙️</div>
            <button
              onClick={start}
              className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
            >
              {t('startMic')}
            </button>
            {error === 'denied' && (
              <p className="text-sm text-red-500 mt-3">{t('micDenied')}</p>
            )}
            {error === 'error' && (
              <p className="text-sm text-red-500 mt-3">{t('micUnavailable')}</p>
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
              <span>{t('scaleFlat')}</span><span>{t('scaleTrue')}</span><span>{t('scaleSharp')}</span>
            </div>

            <p className={`mt-4 text-sm font-medium ${inTune ? 'text-green-500' : 'text-[var(--ink-light)]'}`}>{status}</p>

            {/* Jauge d'entrée.
                Quand rien ne se détecte, la seule question utile est de savoir si le
                micro entend quelque chose. Sans elle, on ne distingue pas un micro
                muet d'une note trop floue pour être reconnue — et sur un téléphone,
                où le niveau de capture varie beaucoup d'un appareil à l'autre, c'est
                la première chose à regarder. */}
            <div className="mt-5 mx-auto max-w-xs">
              <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden" role="presentation">
                <div
                  className={`h-full rounded-full transition-[width,background-color] duration-100 ${
                    level > 0.06 ? 'bg-[var(--accent)]' : 'bg-[var(--ink-faint)]'
                  }`}
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--ink-faint)]">
                {level > 0.06 ? t('micHears') : t('micSilent')}
              </p>
            </div>

            <button
              onClick={stop}
              className="mt-4 px-4 py-2 border border-[var(--line)] text-[var(--ink-light)] text-sm rounded-lg hover:border-[var(--ink-faint)] transition-colors"
            >
              {t('stopMic')}
            </button>
          </>
        )}
      </div>

      {/* Cordes cibles (mode instrument) */}
      {strings && (
        <div className="mt-6">
          <p className="text-xs text-[var(--ink-faint)] uppercase tracking-wide mb-2">{t('stringsLabel')}</p>
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
