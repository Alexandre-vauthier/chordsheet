'use client';

import { useTranslations } from 'next-intl';
import { useHorsLigne } from '@/lib/use-offline';

/**
 * Bandeau discret quand la connexion tombe.
 *
 * Sans lui, le hors ligne est invisible jusqu'au moment où il déçoit : on cherche
 * une grille jamais ouverte, on tombe sur la page de repli, et on croit à une
 * panne de l'application. Dire la coupure au moment où elle arrive évite ce
 * malentendu, et rassure sur ce qui reste jouable.
 *
 * En bas et non en haut : le haut de l'écran porte déjà la barre de navigation,
 * et sur une grille en cours de lecture on ne veut rien pousser vers le bas.
 */
export function OfflineBanner() {
  const t = useTranslations('Offline');
  const horsLigne = useHorsLigne();

  if (!horsLigne) return null;

  return (
    <div
      role="status"
      className="fixed bottom-0 inset-x-0 z-50 print:hidden pointer-events-none flex justify-center pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className="m-3 px-3 py-2 rounded-full border shadow-lg text-xs flex items-center gap-2"
        style={{ background: 'var(--cell-bg)', borderColor: 'var(--line)', color: 'var(--ink-light)' }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
        {t('banner')}
      </div>
    </div>
  );
}
