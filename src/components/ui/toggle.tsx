'use client';

import type { ReactNode } from 'react';

/**
 * L'interrupteur de l'application, et la ligne de réglage qui l'entoure.
 *
 * Le même bloc était recopié quatorze fois : onze dans la page de profil, deux
 * dans l'éditeur de grille, un dans la page des tarifs. Treize de ces copies
 * n'avaient ni `role="switch"`, ni `aria-checked`, ni `aria-label` : pour un
 * lecteur d'écran, c'était un bouton sans nom ni état. Et la quatorzième, la seule
 * accessible, était aussi la seule dont le curseur était correctement calé.
 *
 * C'est donc celle-là qu'on garde, commentaire compris.
 */

export function Switch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  ton = 'accent',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Ce que dit un lecteur d'écran. Obligatoire : un interrupteur sans nom ne se comprend pas. */
  ariaLabel: string;
  disabled?: boolean;
  /**
   * Couleur de l'état allumé.
   *
   * `ambre` sert au seul cas qui ne relève pas de l'accent : « à valider », dans
   * l'éditeur, où le libellé est déjà en ambre. Deux tons, pas davantage — au-delà
   * ce ne serait plus un interrupteur mais une palette.
   */
  ton?: 'accent' | 'ambre';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer
        disabled:opacity-50 disabled:cursor-default
        ${checked ? (ton === 'ambre' ? 'bg-amber-500' : 'bg-[var(--accent)]') : 'bg-[var(--line)]'}`}
    >
      {/* `left-1` explicite : sans lui le curseur se cale sur sa position statique,
          que les navigateurs centrent (les <button> ont text-align: center par
          défaut), et le translate s'ajoute par-dessus — il sortait de la piste.
          Piste 44 - curseur 16 - 4 de marge de chaque côté = 20 de course. */}
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform
          ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

/**
 * Une ligne de réglage : ce qu'il fait à gauche, l'interrupteur à droite.
 *
 * `illustration` reçoit ce qui montre l'effet du réglage plutôt que de le décrire
 * — les sept pastilles du code couleur, par exemple. C'est optionnel parce que
 * tous les réglages ne gagnent pas à être illustrés : une image qui n'apprend rien
 * encombre.
 *
 * `echec` dit que l'enregistrement n'a pas eu lieu, **là où le geste a eu lieu**.
 * Un bandeau en haut de page pousserait le contenu vers le bas et, pour un réglage
 * situé en bas d'une rubrique, apparaîtrait hors de l'écran. Son texte vient de
 * l'appelant : l'application est bilingue, ce composant ne connaît pas les
 * traductions.
 */
export function SettingRow({
  label,
  description,
  checked,
  onChange,
  illustration,
  echec,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  illustration?: ReactNode;
  echec?: { message: string; retryLabel: string; onRetry: () => void };
  disabled?: boolean;
}) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--ink)]">{label}</h3>
          {description && (
            <p className="text-xs text-[var(--ink-faint)] mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        <Switch checked={checked} onChange={onChange} ariaLabel={label} disabled={disabled} />
      </div>

      {illustration && <div className="mt-3">{illustration}</div>}

      {echec && (
        <p className="mt-2 text-xs text-red-600">
          {echec.message}{' '}
          <button
            type="button"
            onClick={echec.onRetry}
            className="underline hover:no-underline cursor-pointer"
          >
            {echec.retryLabel}
          </button>
        </p>
      )}
    </div>
  );
}
