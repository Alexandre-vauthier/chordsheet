'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SheetCard } from '@/components/explore/sheet-card';
import type { Sheet } from '@/types';
import { PREMIER_LOT, prochainSeuil } from '@/lib/liste-progressive';

/**
 * Une liste de grilles, dévoilée par lots.
 *
 * Partagée par les pages d'outils qui répondent chacune à une question — « quels
 * morceaux à trois accords ? », « lesquels sans barré ? » — et n'ont donc rien à
 * filtrer : la réponse est déjà calculée par le serveur, il ne reste qu'à la
 * montrer.
 *
 * Par lots, mais des lots larges : ce composant montrait vingt-quatre vignettes
 * quand le catalogue d'Explorer en montrait quarante-huit, si bien que le bouton
 * « Voir les N grilles suivantes » revenait d'autant plus souvent qu'on était sur
 * la page la moins fournie. Le seuil est désormais commun aux trois listes, et il
 * se multiplie au lieu de s'incrémenter — voir `liste-progressive`.
 *
 * Les données sont déjà en mémoire : dévoiler un lot ne demande rien au serveur.
 */

export function SheetGrid({ sheets }: { sheets: Sheet[] }) {
  const t = useTranslations('Explore');
  const [montrees, setMontrees] = useState(PREMIER_LOT);

  if (sheets.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {sheets.slice(0, montrees).map((sheet) => (
          <SheetCard key={sheet.id} sheet={sheet} />
        ))}
      </div>
      {sheets.length > montrees && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setMontrees(prochainSeuil)}
            className="cursor-pointer px-5 py-2.5 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]
              text-sm text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            {t('showMore', { count: sheets.length - montrees })}
          </button>
        </div>
      )}
    </>
  );
}
