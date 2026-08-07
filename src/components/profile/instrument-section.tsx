'use client';

import { useTranslations } from 'next-intl';
import { usePreference } from '@/lib/use-preference';
import { useInstrumentLabel } from '@/lib/use-genre-labels';
import type { InstrumentId } from '@/types';

const INSTRUMENTS: InstrumentId[] = ['guitar', 'ukulele', 'piano', 'mandolin', 'banjo', 'bass', 'voice'];

/**
 * L'instrument de prédilection.
 *
 * Sa propre rubrique parce qu'il commande le reste : il change les diagrammes
 * affichés, les sons de la lecture et la bibliothèque consultée. C'est aussi le
 * premier réglage qu'un nouveau venu cherche.
 */
export function InstrumentSection() {
  const t = useTranslations('Profile');
  const label = useInstrumentLabel();
  const { valeur, definir, echec, reessayer } = usePreference('preferredInstrument');

  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap gap-2">
        {INSTRUMENTS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => void definir(id)}
            aria-pressed={valeur === id}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
              valeur === id
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--ink-faint)]'
            }`}
          >
            {label(id)}
          </button>
        ))}
      </div>
      {echec && (
        <p className="mt-2 text-xs text-red-600">
          {t('saveFailed')}{' '}
          <button type="button" onClick={reessayer} className="underline hover:no-underline cursor-pointer">
            {t('retry')}
          </button>
        </p>
      )}
    </div>
  );
}
