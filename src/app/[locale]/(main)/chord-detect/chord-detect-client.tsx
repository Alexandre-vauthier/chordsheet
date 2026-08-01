'use client';

import { useTranslations } from 'next-intl';

// Identification d'un accord au micro (accessible depuis la bibliothèque d'accords).
// Micro → chromagramme → comparaison aux templates (cf. use-chord-listener).

import { useChordListener } from '@/lib/use-chord-listener';
import { Link } from '@/i18n/navigation';

const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function ChordDetectClient() {
  const t = useTranslations('ChordDetect');
  const { listening, chord, confidence, chroma, candidates, error, start, stop } = useChordListener();

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Link
        href="/chords"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t('backToLibrary')}
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">{t('h1')}</h1>
        <p className="text-sm text-[var(--ink-light)] mt-1">
          {t('intro')}
        </p>
      </div>

      {/* Bouton REC */}
      <div className="flex justify-center mb-8">
        <button
          onClick={listening ? stop : start}
          className={`flex items-center gap-2.5 px-6 py-3 rounded-full font-semibold text-white transition-colors ${
            listening ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--accent)] hover:bg-[#a83d25]'
          }`}
        >
          <span className={`w-3 h-3 rounded-full bg-white ${listening ? 'animate-pulse' : ''}`} />
          {listening ? t('stop') : t('start')}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 text-center mb-6">
          {t('micUnavailable', { error })}
        </p>
      )}

      {/* Accord détecté */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--cell-bg)] p-8 text-center mb-6">
        <p className="text-xs uppercase tracking-wide text-[var(--ink-faint)] mb-2">{t('detected')}</p>
        <div className="text-6xl font-bold text-[var(--ink)] min-h-[4.5rem] flex items-center justify-center">
          {chord || (listening ? '…' : '—')}
        </div>
        {listening && (
          <div className="mt-4">
            <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-[width] duration-100"
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </div>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              {t('confidence', { percent: Math.round(confidence * 100) })}
            </p>
          </div>
        )}
      </div>

      {/* Top 3 candidats — pour juger les hésitations */}
      {listening && candidates.length > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-4 mb-6">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-faint)] mb-2">{t('candidates')}</p>
          <div className="space-y-1.5">
            {candidates.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-sm">
                <span className={`w-10 font-mono ${i === 0 ? 'text-[var(--accent)] font-bold' : 'text-[var(--ink-light)]'}`}>
                  {c.name}
                </span>
                <div className="flex-1 h-2 rounded-full bg-[var(--line)] overflow-hidden">
                  <div
                    className={i === 0 ? 'h-full bg-[var(--accent)]' : 'h-full bg-[var(--ink-faint)]'}
                    style={{ width: `${Math.round(Math.max(0, c.score) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs text-[var(--ink-faint)]">
                  {Math.round(c.score * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chromagramme — énergie par note */}
      {listening && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-faint)] mb-3">{t('chromagram')}</p>
          <div className="flex items-end gap-1.5 h-28">
            {chroma.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  className="w-full rounded-t bg-[var(--accent)] transition-[height] duration-100"
                  style={{ height: `${Math.round(v * 100)}%`, opacity: 0.35 + v * 0.65 }}
                />
                <span className="text-[10px] text-[var(--ink-faint)]">{NOTE_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--ink-faint)] mt-8 text-center">
        {t('footnote')}
      </p>
    </div>
  );
}
