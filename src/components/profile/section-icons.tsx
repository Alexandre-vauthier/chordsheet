import type { ReactNode } from 'react';
import type { SectionId } from './sections';

/**
 * Une icône par rubrique de réglages.
 *
 * Écrites à la main : le dépôt n'embarque aucune bibliothèque d'icônes, et en
 * ajouter une pour sept dessins coûterait plus que les sept dessins. Hissées en
 * constantes plutôt que recopiées dans le rendu, sur le seul précédent propre du
 * dépôt (`playback-menus.tsx`).
 *
 * Même gabarit partout : trait de 1,8, pas de remplissage, couleur héritée.
 */
const traits = {
  className: 'w-[18px] h-[18px] shrink-0',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
};

export const SECTION_ICON: Record<SectionId, ReactNode> = {
  // Silhouette : le compte, c'est la personne.
  compte: (
    <svg {...traits} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  ),
  // Globe : ce que voient les autres.
  public: (
    <svg {...traits} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5Z" />
    </svg>
  ),
  // Manche et cordes.
  instrument: (
    <svg {...traits} aria-hidden="true">
      <path d="M6 3v18M18 3v18M6 8h12M6 13h12" />
      <circle cx="12" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Une grille de mesures : ce qu'on voit en ouvrant une grille.
  affichage: (
    <svg {...traits} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 12h18M9 5v14M15 5v14" />
    </svg>
  ),
  // Onde sonore.
  lecture: (
    <svg {...traits} aria-hidden="true">
      <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
    </svg>
  ),
  // Imprimante.
  impression: (
    <svg {...traits} aria-hidden="true">
      <path d="M7 8V4h10v4" />
      <rect x="4" y="8" width="16" height="7" rx="2" />
      <path d="M7 13h10v7H7z" />
    </svg>
  ),
  // Carte de paiement.
  abonnement: (
    <svg {...traits} aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
};
