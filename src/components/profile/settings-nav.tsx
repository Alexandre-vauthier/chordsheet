'use client';

import type { ReactNode } from 'react';
import { SECTION_ICON } from './section-icons';
import { SECTION_IDS, type SectionId } from './sections';

/**
 * Le rail des rubriques.
 *
 * Une liste verticale plutôt que des onglets en pilules : sept intitulés français
 * ne tiennent pas sur une ligne, et des onglets ne raccourciraient pas la page —
 * tout le contenu resterait sur un seul défilement, c'est-à-dire exactement le
 * défaut qu'on corrige.
 *
 * Sur petit écran, ce rail **est** l'écran d'arrivée : la page ne montre que lui
 * tant qu'aucune rubrique n'est choisie.
 */
export function SettingsNav({
  active,
  labels,
  badges,
  onSelect,
}: {
  active: SectionId;
  labels: Record<SectionId, string>;
  /** Complément à droite d'une ligne, par exemple la pastille Pro de l'abonnement. */
  badges?: Partial<Record<SectionId, ReactNode>>;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {SECTION_IDS.map((id) => {
        const courante = id === active;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              aria-current={courante ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left
                border-l-2 transition-colors cursor-pointer
                ${courante
                  ? 'border-[var(--accent)] bg-[var(--cell-bg)] text-[var(--ink)] font-medium'
                  : 'border-transparent text-[var(--ink-light)] hover:bg-[var(--cell-hover)] hover:text-[var(--ink)]'
                }`}
            >
              <span className={courante ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]'}>
                {SECTION_ICON[id]}
              </span>
              <span className="flex-1 min-w-0 truncate">{labels[id]}</span>
              {badges?.[id]}
              {/* Le chevron ne sert qu'au petit écran, où la ligne mène ailleurs. */}
              <span className="md:hidden text-[var(--ink-faint)]" aria-hidden="true">›</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
