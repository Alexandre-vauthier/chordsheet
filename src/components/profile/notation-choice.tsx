'use client';

import { useTranslations } from 'next-intl';
import { usePreference } from '@/lib/use-preference';
import type { NotationPreference } from '@/types';

/**
 * Notation américaine ou française.
 *
 * Les deux boutons montrent le même accord dans chaque écriture : c'est
 * l'illustration la plus claire de toute la page, elle existait déjà et elle est
 * reprise telle quelle.
 *
 * Ils ne se désactivent plus pendant l'enregistrement : une seconde de réseau lent
 * empêchait de corriger un clic erroné. C'est le dernier clic qui gagne.
 */
export function NotationChoice() {
  const t = useTranslations('Profile');
  const { valeur, definir, echec, reessayer } = usePreference('notationPreference');

  const choix: { id: NotationPreference; exemple: string; libelle: string }[] = [
    { id: 'american', exemple: 'Am · F#m7', libelle: t('notationEnglish') },
    { id: 'french', exemple: 'Lam · Fa#m7', libelle: t('notationFrench') },
  ];

  return (
    <div className="px-5 py-4 sm:px-6">
      <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">{t('notationTitle')}</h3>
      <div className="flex gap-3">
        {choix.map(({ id, exemple, libelle }) => (
          <button
            key={id}
            type="button"
            onClick={() => void definir(id)}
            aria-pressed={valeur === id}
            className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors cursor-pointer ${
              valeur === id
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--ink-faint)]'
            }`}
          >
            <div className="font-mono text-lg mb-1">{exemple}</div>
            <div>{libelle}</div>
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
