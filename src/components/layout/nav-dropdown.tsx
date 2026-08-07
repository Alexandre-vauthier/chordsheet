'use client';

import { useState, type ReactNode } from 'react';
import { useClickOutside } from '@/lib/use-click-outside';

/**
 * Un menu déroulant de la barre de navigation.
 *
 * Sert au menu « Outils » comme au menu de compte : deux panneaux qui n'ont aucune
 * raison d'avoir deux comportements. Les garde-fous viennent des menus de lecture,
 * seul endroit du dépôt qui avait déjà traité le petit écran — largeur bornée à la
 * fenêtre, hauteur bornée à l'écran, et ancrage inversé selon la largeur pour qu'un
 * panneau ouvert près du bord ne sorte pas de la page.
 *
 * La fermeture au clic extérieur et à la touche Échap vient du hook partagé.
 */
export function NavDropdown({
  label,
  icon,
  actif = false,
  align = 'left',
  children,
}: {
  label: ReactNode;
  icon?: ReactNode;
  actif?: boolean;
  align?: 'left' | 'right';
  /** Reçoit une fonction de fermeture : chaque entrée referme le menu en partant. */
  children: (fermer: () => void) => ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOuvert(false), ouvert);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        className={`flex items-center gap-1.5 text-sm transition-colors cursor-pointer whitespace-nowrap
          ${actif || ouvert ? 'text-[var(--nav-text)]' : 'text-[var(--nav-text)]/70 hover:text-[var(--nav-text)]'}`}
      >
        {icon}
        {label}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${ouvert ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {ouvert && (
        <div
          role="menu"
          className={`absolute top-full mt-2 z-[60] w-64 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto
            rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] shadow-xl py-1.5
            ${align === 'right' ? 'right-0' : 'left-0 sm:left-auto sm:right-0'}`}
        >
          {children(() => setOuvert(false))}
        </div>
      )}
    </div>
  );
}

/** Un titre de section à l'intérieur d'un menu. */
export function NavDropdownSection({ label }: { label: string }) {
  return (
    <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">{label}</p>
  );
}

/** Le trait qui sépare deux blocs d'un menu. */
export function NavDropdownSeparator() {
  return <div className="mx-3 my-1 h-px bg-[var(--line)]" />;
}
