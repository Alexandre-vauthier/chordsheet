'use client';

/**
 * Une opération d'administration, en tuile.
 *
 * Elles étaient empilées en pleine largeur : six blocs identiques, chacun occupant
 * une ligne entière, et il fallait dérouler pour savoir ce qui existe. En grille, on
 * embrasse l'ensemble d'un coup d'œil.
 *
 * Le compte-rendu s'affiche sous le bouton et non à côté : il peut être long
 * (« 47 grilles nettoyées »), et le placer en ligne faisait sauter la mise en page
 * d'une tuile à l'autre.
 */
export function AdminTile({
  title,
  description,
  action,
  running,
  runningLabel,
  result,
  onRun,
  danger = false,
}: {
  title: string;
  description: string;
  action: string;
  running: boolean;
  runningLabel: string;
  result?: string;
  onRun: () => void;
  /** Opération irréversible : le bouton le dit. */
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col p-4 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl">
      <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
      <p className="text-xs text-[var(--ink-faint)] mt-1 leading-relaxed flex-1">{description}</p>

      <button
        onClick={onRun}
        disabled={running}
        className={`mt-4 w-full px-4 py-2 text-sm rounded-lg text-white transition-colors
          disabled:opacity-50 cursor-pointer disabled:cursor-default
          ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--accent)] hover:bg-[#a83d25]'}`}
      >
        {running ? runningLabel : action}
      </button>

      {result && <p className="mt-2 text-xs text-[var(--ink-light)] leading-relaxed">{result}</p>}
    </div>
  );
}
