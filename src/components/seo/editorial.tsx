import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

/**
 * Primitives des blocs éditoriaux (référencement).
 *
 * Composants **serveur** : le texte part dans le HTML servi, sans une ligne de
 * JavaScript côté client. C'est tout l'intérêt — ces blocs existent pour être lus
 * par un moteur de recherche au premier passage, pas après hydratation.
 *
 * Le balisage n'est écrit qu'ici ; chaque page compose ses sections dans un fichier
 * voisin de son `page.tsx`. On garde ainsi la possibilité de placer des liens
 * **dans** la prose (`t.rich`), ce qui compte davantage pour le maillage qu'un
 * rendu piloté par la donnée.
 *
 * Les styles reprennent ceux de /about, la page éditoriale de référence.
 */

/** Conteneur. Le filet supérieur sépare le bloc de l'outil qui le précède. */
export function Editorial({ children, bordered = true }: { children: ReactNode; bordered?: boolean }) {
  return (
    <section className={`max-w-2xl mx-auto px-4 sm:px-6 py-14 space-y-10 ${bordered ? 'border-t border-[var(--line)] mt-10' : ''}`}>
      {children}
    </section>
  );
}

/** En-tête avec h1 — réservé aux pages autonomes. Un bloc posé sous un outil n'a que des h2. */
export function EditorialHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="space-y-3">
      <h1 className="font-playfair text-4xl font-bold text-[var(--ink)]">{title}</h1>
      {lead && <p className="text-[var(--ink-light)] text-base leading-relaxed">{lead}</p>}
    </header>
  );
}

/** Section de contenu. `id` sert d'ancre pour les liens internes. */
export function EditorialSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} className="space-y-4">
      <h2 className="font-playfair text-lg font-bold text-[var(--ink)]">{title}</h2>
      <div className="space-y-4 text-[var(--ink-light)] text-sm leading-[1.9]">{children}</div>
    </div>
  );
}

/** Sous-titre à l'intérieur d'une section. */
export function EditorialSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[var(--ink)] font-semibold text-sm">{title}</h3>
      {children}
    </div>
  );
}

export function EditorialList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 list-disc pl-5 marker:text-[var(--ink-faint)]">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

/**
 * Tableau sémantique. Indispensable pour les données chiffrées — fréquences
 * d'accordage, équivalences de notation — qui sont le contenu le plus singulier
 * du site. `caption` est lu par les lecteurs d'écran et compris par les moteurs.
 */
export function EditorialTable({
  caption, head, rows,
}: {
  caption?: string;
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        {caption && <caption className="text-left text-xs text-[var(--ink-faint)] mb-2">{caption}</caption>}
        <thead>
          <tr className="border-b border-[var(--line)]">
            {head.map(h => (
              <th key={h} scope="col" className="text-left py-2 pr-4 font-semibold text-[var(--ink)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--line)] last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Encadré « ce que l'outil ne fait pas ». Il existe pour une raison précise :
 * une promesse non tenue coûte plus cher qu'une fonctionnalité absente, en avis
 * comme en taux de rebond.
 */
export function EditorialNote({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <aside className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] px-4 py-3.5 text-sm leading-[1.8] text-[var(--ink-light)]">
      {title && <p className="font-semibold text-[var(--ink)] mb-1">{title}</p>}
      {children}
    </aside>
  );
}

/** Bloc de liens internes en fin de page. Ancres descriptives, jamais « cliquez ici ». */
export function EditorialLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="space-y-3">
      <h2 className="font-playfair text-lg font-bold text-[var(--ink)]">{title}</h2>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {links.map(l => (
          <li key={l.href}>
            <Link href={l.href} className="text-[var(--accent)] hover:underline">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
