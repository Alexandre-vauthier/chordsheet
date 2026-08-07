'use client';

import type { ReactNode } from 'react';

/**
 * La coque d'une rubrique : son titre, son intention, et son contenu.
 *
 * Le contenu est **une seule carte à lignes séparées**, pas une pile de cartes.
 * L'ancienne page empilait onze cartes de cent vingt pixels pour une phrase et un
 * interrupteur chacune : c'est cette respiration inutile qui faisait la longueur,
 * plus que le nombre de réglages.
 */
export function SettingsPanel({
  title,
  intro,
  backLabel,
  onBack,
  children,
}: {
  title: string;
  intro?: string;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      {/* Le retour n'existe que sur petit écran : sur grand, le rail est déjà là. */}
      <button
        type="button"
        onClick={onBack}
        className="md:hidden mb-4 text-sm text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors cursor-pointer"
      >
        ← {backLabel}
      </button>

      <h2 className="font-playfair text-xl font-bold text-[var(--ink)]">{title}</h2>
      {intro && <p className="text-sm text-[var(--ink-light)] mt-1 mb-5 leading-relaxed">{intro}</p>}

      <div className="mt-4 bg-[var(--cell-bg)] rounded-2xl border border-[var(--line)] divide-y divide-[var(--line)] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/** Une ligne de la carte qui n'est pas un interrupteur : champ, bouton, information. */
export function SettingBlock({
  label,
  description,
  children,
}: {
  label?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-5 py-4 sm:px-6">
      {label && <h3 className="text-sm font-semibold text-[var(--ink)]">{label}</h3>}
      {description && (
        <p className="text-xs text-[var(--ink-faint)] mt-1 leading-relaxed">{description}</p>
      )}
      <div className={label || description ? 'mt-3' : ''}>{children}</div>
    </div>
  );
}
