'use client';

import { useTranslations } from 'next-intl';

/**
 * Barre d'état de la dictée au micro.
 *
 * Elle existe surtout pour rendre l'attente lisible : sans retour visuel, on ne sait
 * pas si le micro n'entend rien, s'il entend sans reconnaître, ou s'il a reconnu et
 * attend le silence. Ces trois situations se corrigent différemment.
 */
export function DictationBar({
  pending,
  audible,
  error,
  canUndo,
  onUndo,
  onStop,
}: {
  pending: string;
  audible: boolean;
  error: string | null;
  canUndo: boolean;
  onUndo: () => void;
  onStop: () => void;
}) {
  const t = useTranslations('Editor.dictation');

  const status = error
    ? { label: error, tone: 'error' as const }
    : pending
      ? { label: t('statusReady', { chord: pending }), tone: 'ready' as const }
      : audible
        ? { label: t('statusHearing'), tone: 'hearing' as const }
        : { label: t('statusWaiting'), tone: 'waiting' as const };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 print:hidden w-[min(34rem,calc(100vw-2rem))]">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-lg">

        {/* Témoin d'écoute : il bat quand le micro reçoit du son. */}
        <span className="relative flex w-3 h-3 flex-shrink-0" aria-hidden>
          {audible && !error && (
            <span className="absolute inline-flex w-full h-full rounded-full bg-[var(--accent)] opacity-60 animate-ping" />
          )}
          <span
            className={`relative inline-flex w-3 h-3 rounded-full ${
              error ? 'bg-red-500' : audible ? 'bg-[var(--accent)]' : 'bg-[var(--ink-faint)]'
            }`}
          />
        </span>

        <div className="flex-1 min-w-0">
          <p className={`text-sm ${status.tone === 'error' ? 'text-red-600' : 'text-[var(--ink)]'}`}>
            {status.tone === 'ready' ? (
              <span className="font-semibold">{pending}</span>
            ) : null}
            {status.tone === 'ready' ? <span className="text-[var(--ink-light)]"> — {t('releaseToWrite')}</span> : status.label}
          </p>
          {!error && (
            <p className="text-xs text-[var(--ink-faint)] mt-0.5 truncate">{t('hint')}</p>
          )}
        </div>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-medium
            text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors
            disabled:opacity-40 disabled:hover:border-[var(--line)] disabled:hover:text-[var(--ink-light)] cursor-pointer disabled:cursor-default"
        >
          {t('undo')}
        </button>

        <button
          onClick={onStop}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium
            hover:bg-[#a83d25] transition-colors cursor-pointer"
        >
          {t('stopButton')}
        </button>

      </div>
    </div>
  );
}
