import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { ShelfScroller } from './shelf-scroller';

/**
 * Un rayon : un titre, ce qu'il contient, et par où le voir en entier.
 *
 * Composant serveur. Il ne devient interactif qu'à l'intérieur, dans
 * `ShelfScroller`, à qui il passe ses tuiles déjà rendues — voir le commentaire
 * de ce fichier-là pour la raison.
 *
 * Le titre est un vrai `h2` et non un `div` mis en forme : c'est ce que lisent
 * les lecteurs d'écran comme les moteurs pour comprendre la structure de la page.
 */
export function Shelf({
  titre,
  compte,
  href,
  libelleTout,
  children,
}: {
  titre: string;
  /** Combien de grilles la tranche contient en tout, si cela dépasse ce qu'on montre. */
  compte?: number;
  href?: string;
  libelleTout: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={titre} className="mb-8">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="font-playfair text-lg font-bold text-[var(--ink)]">
          {titre}
          {compte !== undefined && (
            <span className="ml-2 text-sm font-normal text-[var(--ink-faint)]">{compte}</span>
          )}
        </h2>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-sm text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
          >
            {libelleTout}
          </Link>
        )}
      </div>
      <ShelfScroller etiquette={titre}>{children}</ShelfScroller>
    </section>
  );
}

/** Une tuile dans un rayon : la largeur y est fixe, contrairement à la grille. */
export function ShelfItem({ children }: { children: ReactNode }) {
  return (
    <li className="snap-start shrink-0 w-[45vw] max-w-[168px] sm:w-[160px] lg:w-[176px]">
      {children}
    </li>
  );
}
