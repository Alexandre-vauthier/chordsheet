'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { jouablesAvec, prochainAccord } from '@/lib/explore-shelves';
import { useChordNotation } from '@/lib/use-chord-notation';
import { SheetCard } from '@/components/explore/sheet-card';
import { ArtworkWall, type CouvertureMini } from '@/components/explore/artwork-wall';
import type { Sheet } from '@/types';

/**
 * « Que puis-je jouer avec mes accords ? »
 *
 * L'outil part de ce qu'on sait faire, et non de ce qui est populaire : c'est la
 * seule porte d'entrée qu'un service de musique ne pourrait pas avoir, puisqu'il
 * ignore ce que ses auditeurs savent jouer.
 *
 * Il a d'abord occupé le haut d'`/explore`. Mal placé : une page qui s'appelle
 * « Explorer » doit s'ouvrir, pas demander de cocher quelque chose avant de
 * laisser regarder. Ici la question est le sujet de la page, et elle est donc à
 * sa place.
 *
 * Rien n'est demandé à la base. Chaque grille porte déjà ses accords, à plat et
 * en minuscules ; le navigateur reçoit cette seule colonne et répond sans
 * aller-retour à chaque pastille.
 */
export function WhatCanIPlayClient({
  accordsProposes,
  accordsInitiaux,
  grilles,
  couvertures,
}: {
  /** Les accords les plus employés du catalogue, dans cet ordre. */
  accordsProposes: string[];
  /** Ceux qui sont cochés à l'ouverture, pour que la page réponde tout de suite. */
  accordsInitiaux: string[];
  grilles: Sheet[];
  couvertures: CouvertureMini[];
}) {
  const t = useTranslations('WhatCanIPlay');
  const traduire = useChordNotation();
  const [connus, setConnus] = useState<string[]>(accordsInitiaux);
  const [montrees, setMontrees] = useState(24);

  const { jouables, suivant } = useMemo(() => ({
    jouables: jouablesAvec(grilles, connus),
    suivant: prochainAccord(grilles, connus),
  }), [grilles, connus]);

  const basculer = (accord: string) => {
    setMontrees(24);
    setConnus((actuels) =>
      actuels.includes(accord) ? actuels.filter((a) => a !== accord) : [...actuels, accord],
    );
  };

  /** L'affichage suit la notation choisie ; la donnée reste en minuscules. */
  const nom = (accord: string) => {
    const propre = accord.charAt(0).toUpperCase() + accord.slice(1);
    return traduire(propre) || propre;
  };

  return (
    <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-8">
      <section className="relative -mx-4 sm:-mx-6 mb-10 overflow-hidden rounded-none sm:rounded-3xl">
        <div className="relative min-h-[340px] sm:min-h-[380px] flex items-center justify-center">
          <ArtworkWall sheets={couvertures} />
          {/* Le voile : sans lui les pochettes emportent le texte. */}
          <div className="absolute inset-0 bg-[var(--nav-bg)]/[0.88]" aria-hidden="true" />

          <div className="relative z-10 w-full max-w-2xl px-5 py-10 text-center">
            <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[var(--nav-text)]">
              {t('title')}
            </h1>
            <p className="mt-2 text-sm text-[var(--nav-text)]/70">{t('subtitle')}</p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {accordsProposes.map((accord) => {
                const actif = connus.includes(accord);
                return (
                  <button
                    key={accord}
                    type="button"
                    onClick={() => basculer(accord)}
                    aria-pressed={actif}
                    className={`cursor-pointer px-3.5 py-1.5 rounded-full text-sm font-mono font-medium border transition-colors
                      ${actif
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                        : 'bg-white/[0.06] border-white/20 text-[var(--nav-text)]/80 hover:border-[var(--nav-text)]/50'}`}
                  >
                    {nom(accord)}
                  </button>
                );
              })}
            </div>

            <p className="mt-6 text-lg text-[var(--nav-text)]" aria-live="polite">
              {connus.length === 0
                ? t('pickOne')
                : t('playable', { count: jouables.length, chords: connus.length })}
            </p>

            {suivant && (
              <p className="mt-1.5 text-sm text-[var(--nav-text)]/70">
                {t('next', { chord: nom(suivant.accord), count: suivant.debloque })}
              </p>
            )}
          </div>
        </div>
      </section>

      {jouables.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {jouables.slice(0, montrees).map((sheet) => (
              <SheetCard key={sheet.id} sheet={sheet} />
            ))}
          </div>
          {jouables.length > montrees && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setMontrees((n) => n + 24)}
                className="cursor-pointer px-5 py-2.5 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]
                  text-sm text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {t('showMore', { count: jouables.length - montrees })}
              </button>
            </div>
          )}
        </>
      ) : (
        /* Une réponse vide reste une réponse : on dit quoi apprendre, et on
           laisse une sortie vers le catalogue plutôt qu'un cul-de-sac. */
        <div className="text-center py-12">
          <p className="text-[var(--ink-light)]">{t('empty')}</p>
          <Link
            href="/explore"
            className="inline-block mt-4 text-sm text-[var(--accent)] hover:underline"
          >
            {t('browseAll')}
          </Link>
        </div>
      )}
    </div>
  );
}
