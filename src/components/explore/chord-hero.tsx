'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { jouablesAvec, prochainAccord, type GrilleAccords } from '@/lib/explore-shelves';
import { useChordNotation } from '@/lib/use-chord-notation';
import { ArtworkWall, type CouvertureMini } from './artwork-wall';

/**
 * « Que savez-vous jouer ? »
 *
 * La porte d'entrée de la page, et la seule qu'un service de musique ne pourrait
 * pas avoir : elle part de ce qu'on sait faire, pas de ce qui est populaire.
 *
 * Elle ne demande rien à la base. Chaque grille porte déjà ses accords, à plat et
 * en minuscules ; le navigateur reçoit cette seule colonne — quelques kilo-octets
 * pour tout le catalogue — et répond sans aller-retour à chaque pastille.
 *
 * Le second message est le ressort : « apprenez F, neuf grilles de plus ». Il
 * transforme une liste en progression, et il se calcule avec la même donnée. Les
 * chiffres sont réels, pas décoratifs : mesuré sur le catalogue, cinq accords en
 * ouvrent huit, et le fa en ajoute neuf.
 */
export function ChordHero({
  accordsProposes,
  accordsInitiaux,
  index,
  couvertures,
}: {
  /** Les accords les plus employés du catalogue, dans cet ordre. */
  accordsProposes: string[];
  /** Ceux qui sont cochés à l'ouverture, pour que la page réponde tout de suite. */
  accordsInitiaux: string[];
  /** Le catalogue réduit à ses accords. */
  index: GrilleAccords[];
  couvertures: CouvertureMini[];
}) {
  const t = useTranslations('Explore');
  const router = useRouter();
  const traduire = useChordNotation();
  const [connus, setConnus] = useState<string[]>(accordsInitiaux);

  const { jouables, suivant } = useMemo(() => ({
    jouables: jouablesAvec(index, connus).length,
    suivant: prochainAccord(index, connus),
  }), [index, connus]);

  const basculer = (accord: string) =>
    setConnus((actuels) =>
      actuels.includes(accord) ? actuels.filter((a) => a !== accord) : [...actuels, accord],
    );

  /** L'affichage suit la notation choisie ; la donnée reste en minuscules. */
  const nom = (accord: string) => {
    const propre = accord.charAt(0).toUpperCase() + accord.slice(1);
    return traduire(propre) || propre;
  };

  const voirLesGrilles = () => {
    if (connus.length === 0) return;
    router.push(`/explore?chords=${encodeURIComponent(connus.join(','))}`);
  };

  return (
    <section className="relative -mx-4 sm:-mx-6 mb-10 overflow-hidden rounded-none sm:rounded-3xl">
      <div className="relative min-h-[380px] sm:min-h-[420px] flex items-center justify-center">
        <ArtworkWall sheets={couvertures} />
        {/* Le voile : sans lui les pochettes emportent le texte. */}
        <div className="absolute inset-0 bg-[var(--nav-bg)]/[0.88]" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-2xl px-5 py-12 text-center">
          <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[var(--nav-text)]">
            {t('heroTitle')}
          </h1>
          <p className="mt-2 text-sm text-[var(--nav-text)]/70">{t('heroSubtitle')}</p>

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
              ? t('heroPickOne')
              : t('heroPlayable', { count: jouables, chords: connus.length })}
          </p>

          {suivant && (
            <p className="mt-1.5 text-sm text-[var(--nav-text)]/70">
              {t('heroNext', { chord: nom(suivant.accord), count: suivant.debloque })}
            </p>
          )}

          {jouables > 0 && (
            <button
              type="button"
              onClick={voirLesGrilles}
              className="mt-6 px-5 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium transition-colors cursor-pointer"
            >
              {t('heroSee', { count: jouables })}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
