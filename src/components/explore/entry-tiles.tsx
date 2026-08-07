import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { PublicSheetRef } from '@/lib/public-sheet-index';
import { artistesDe, portesDe, type EntryTile } from '@/lib/explore-shelves';
import { CoverMosaic } from './cover-mosaic';

/**
 * Les portes d'entrée thématiques : décennie, genre, niveau, tonalité, artistes.
 *
 * Ce sont des **tuiles de navigation**, pas des listes de morceaux, et c'est tout
 * l'intérêt : avec cent trente grilles publiques, un cinquième et un sixième rayon
 * remontreraient les mêmes chansons sous un autre titre. Une tuile, elle, ne
 * montre rien — elle annonce une tranche et son compte, puis ouvre le catalogue
 * déjà filtré.
 *
 * Ce qui se voit vient du serveur : libellé, compte, adresse. Seules les pochettes
 * du fond sont chargées par le navigateur.
 *
 * Les tranches trop maigres n'ont pas de tuile (`SEUIL_PORTE`) : promettre un
 * rayon « Jazz » et livrer une grille dessert la page plus qu'un genre absent.
 */

/** Une tuile : un libellé, un compte, une mosaïque, une destination. */
function Tuile({ tuile, libelle }: { tuile: EntryTile; libelle: string }) {
  return (
    <Link
      href={tuile.href}
      className="group relative block aspect-[4/3] sm:aspect-[3/2] rounded-xl overflow-hidden
        border border-[var(--line)] hover:border-[var(--accent)] transition-colors"
    >
      <CoverMosaic sheets={tuile.sample} />
      {/* Le voile : sans lui, un libellé clair sur une pochette claire disparaît. */}
      <div className="absolute inset-0 bg-black/60 group-hover:bg-black/45 transition-colors" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="font-playfair text-base sm:text-lg font-bold text-white leading-tight">
          {libelle}
        </span>
        <span className="mt-0.5 text-[11px] text-white/70">{tuile.count}</span>
      </div>
    </Link>
  );
}

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section aria-label={titre} className="mb-8">
      <h2 className="font-playfair text-lg font-bold text-[var(--ink)] mb-3">{titre}</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">{children}</div>
    </section>
  );
}

export async function EntryTiles({ refs, locale }: { refs: PublicSheetRef[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'Explore' });
  const tGenre = await getTranslations({ locale, namespace: 'Genres' });
  const tNiveau = await getTranslations({ locale, namespace: 'Difficulty' });

  const groupes = portesDe(refs);
  // Douze : de quoi montrer les artistes fournis sans transformer la page en
  // annuaire. Les cent six autres sont sur `/artists`, qui est fait pour ça.
  const artistes = artistesDe(refs, 12);
  if (groupes.length === 0 && artistes.length === 0) return null;

  /**
   * Le libellé d'une tuile.
   *
   * Les genres et les niveaux sont **stockés en français canonique** et traduits
   * seulement à l'affichage : c'est la convention du dépôt, et la contourner ici
   * ferait entrer de l'anglais dans la base au premier filtre posé depuis `/en`.
   * Les décennies et les tonalités, elles, se lisent pareil dans les deux langues.
   */
  const libelleDe = (groupeId: string, tuile: EntryTile) => {
    if (groupeId === 'genres') return tGenre(tuile.label);
    if (groupeId === 'levels') return tNiveau(tuile.label);
    return tuile.label;
  };

  return (
    <div className="mb-10">
      {groupes.map((groupe) => (
        <Groupe key={groupe.id} titre={t(`entries.${groupe.id}`)}>
          {groupe.tiles.map((tuile) => (
            <Tuile key={tuile.id} tuile={tuile} libelle={libelleDe(groupe.id, tuile)} />
          ))}
        </Groupe>
      ))}

      {artistes.length > 0 && (
        <section aria-label={t('entries.artists')} className="mb-8">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h2 className="font-playfair text-lg font-bold text-[var(--ink)]">
              {t('entries.artists')}
            </h2>
            <Link
              href="/artists"
              className="shrink-0 text-sm text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
            >
              {t('shelfSeeAll')}
            </Link>
          </div>
          {/*
            Des pastilles et non des tuiles à pochette : cent six artistes dont
            dix-neuf seulement ont plus d'une grille, cela se parcourt du regard.
            Une pochette par artiste coûterait douze requêtes de plus pour dire ce
            qu'un nom dit déjà.
          */}
          <ul className="flex flex-wrap gap-2">
            {artistes.map((a) => (
              <li key={a.name}>
                <Link
                  href={`/artist/${encodeURIComponent(a.name)}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                    bg-[var(--cell-bg)] border border-[var(--line)] text-[var(--ink)]
                    hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {a.name}
                  <span className="text-[var(--ink-faint)] text-xs">{a.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
