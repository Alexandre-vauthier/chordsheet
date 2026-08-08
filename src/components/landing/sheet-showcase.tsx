'use client';

import { useTranslations } from 'next-intl';
import { ChordDiagram } from '@/components/chord/chord-diagram';
import { useChordVariants } from '@/lib/use-chord-variants';
import { getChordColor } from '@/lib/use-chord-color';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';

/**
 * Une vraie grille, dans le hero.
 *
 * Le premier écran ne montrait que des pochettes d'albums : joli, mais on ne
 * voyait **jamais le produit**. Or ce qu'on vend n'est pas un catalogue de
 * morceaux, c'est une grille qu'on écrit, qu'on transpose et qu'on joue à
 * plusieurs — et rien de tout cela n'était visible avant d'avoir défilé.
 *
 * Sur le principe déjà écrit pour l'aperçu des réglages
 * (`profile/grid-preview.tsx`) : **rien de neuf n'est dessiné**. Les cases
 * reprennent les classes de la vraie cellule, les diagrammes viennent de la
 * bibliothèque par `useChordVariants`, la couleur de `getChordColor`. Une maquette
 * qui se contenterait de ressembler finirait par mentir — et le jour où le
 * diagramme de `Am` changerait, celle-ci le suivrait.
 *
 * Volontairement **non interactif** : c'est une vitrine, et le bac à sable
 * complet, lui, vit dans son propre bloc plus bas. Deux éditeurs sur la même page
 * apprendraient qu'il y a deux façons d'écrire.
 */

/** Une progression que tout le monde reconnaît, et quatre fondamentales distinctes. */
const MESURES: { label: string; accords: string[] }[] = [
  { label: 'A', accords: ['Am', 'F'] },
  { label: 'B', accords: ['C', 'G'] },
];

export function SheetShowcase() {
  const t = useTranslations('Landing.showcase');

  return (
    <div
      /* `aria-hidden` : c'est une illustration du produit, et son contenu — quatre
         noms d'accords hors contexte — n'apprendrait rien à qui l'entend lire. Le
         titre et le texte du hero portent le sens. */
      aria-hidden="true"
      className="rounded-2xl border border-white/10 bg-[var(--nav-bg)]/80 backdrop-blur-sm
        p-4 sm:p-5 shadow-2xl shadow-black/40 select-none"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[var(--nav-text)] text-sm font-semibold">{t('title')}</span>
        <span className="text-[var(--nav-text)]/35 text-xs">{t('artist')}</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-[var(--nav-text)]/50 font-mono">
          {t('key')}
        </span>
      </div>

      <div className="space-y-3">
        {MESURES.map((mesure) => (
          <div key={mesure.label}>
            <p className="text-[10px] uppercase tracking-wider text-[var(--nav-text)]/30 mb-1.5">
              {t(`section${mesure.label}`)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {mesure.accords.map((accord) => (
                <Case key={accord} accord={accord} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Une case, avec les classes de la vraie cellule de grille.
 *
 * `--cell-bg` et `--line` suivent le thème : sur l'accueil, qui est sombre, la case
 * l'est aussi. C'est ce qu'on veut — la vitrine doit ressembler à ce qu'on obtient,
 * et forcer un fond clair ici montrerait une grille que personne n'a.
 */
function Case({ accord }: { accord: string }) {
  const variantes = useChordVariants(accord, 'guitar');
  const forme = variantes[0] ?? null;
  const couleur = getChordColor(accord);
  const cordes = INSTRUMENT_CONFIG.guitar?.strings ?? 6;

  return (
    <div
      style={couleur ? { borderColor: couleur.border, borderLeftWidth: '5px' } : undefined}
      className="rounded-lg border-2 border-[var(--line)] bg-[var(--cell-bg)]
        flex flex-col items-center justify-center gap-1.5 py-3"
    >
      <span className="font-mono text-base font-medium text-[var(--ink)]">{accord}</span>
      {forme && !Array.isArray((forme as { notes?: string[] }).notes) && (
        <ChordDiagram chord={forme as Parameters<typeof ChordDiagram>[0]['chord']} size="xs" numStrings={cordes} />
      )}
    </div>
  );
}
