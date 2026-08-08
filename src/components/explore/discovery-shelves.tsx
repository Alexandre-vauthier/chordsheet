import { getTranslations } from 'next-intl/server';
import { instantDuRendu } from '@/lib/render-clock';
import type { PublicSheetRef } from '@/lib/public-sheet-index';
import { rayonsDe, versGrilleDeCatalogue } from '@/lib/explore-shelves';
import { SheetCard } from '@/components/explore/sheet-card';
import { Shelf, ShelfItem } from './shelf';

/**
 * Les rayons de la page de découverte.
 *
 * Composant serveur : les tuiles sont dans le HTML servi, ce qui est tout l'objet
 * de la refonte — la page la mieux référencée du site n'en contenait aucune.
 *
 * Quatre rayons et pas davantage. Le catalogue public compte cent trente grilles :
 * mesuré à quatre rayons de douze, cela fait 48 tuiles pour 40 morceaux distincts,
 * soit 1,2 apparition par morceau. Chaque rayon ajouté dégrade ce chiffre, et
 * au-delà de cinq on montrerait trois fois la même chose en changeant le titre.
 * `tests/explore.test.ts` garde cet ordre de grandeur.
 *
 * Ce qu'on ne trouvera pas ici, et pour cause : pas de « mieux notées » (aucune
 * grille n'a trois avis), pas de « tendances » (le compteur de vues est un cumul
 * sans date). Les construire quand même reviendrait à classer du bruit.
 */
export async function DiscoveryShelves({ refs, locale }: { refs: PublicSheetRef[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'Explore' });
  const rayons = rayonsDe(refs, instantDuRendu());
  if (rayons.length === 0) return null;

  return (
    <div className="mb-10">
      {rayons.map((rayon) => (
        <Shelf
          key={rayon.id}
          titre={t(`shelf.${rayon.id}`)}
          compte={rayon.total > rayon.tiles.length ? rayon.total : undefined}
          href={rayon.href}
          libelleTout={t('shelfSeeAll')}
        >
          {rayon.tiles.map((ref) => (
            <ShelfItem key={ref.id}>
              <SheetCard sheet={versGrilleDeCatalogue(ref)} />
            </ShelfItem>
          ))}
        </Shelf>
      ))}
    </div>
  );
}
