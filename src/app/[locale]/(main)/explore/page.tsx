import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { getPublicSheetIndex } from '@/lib/public-sheet-index';
import { filtreActif, versGrilleDeCatalogue } from '@/lib/explore-shelves';
import { DiscoveryShelves } from '@/components/explore/discovery-shelves';
import { EntryTiles } from '@/components/explore/entry-tiles';
import { ExploreClient } from './explore-client';
import { ExploreEditorial } from './explore-editorial';

const PATH = '/explore';

/**
 * Rendu à la requête.
 *
 * `ExploreClient` lit les paramètres d'URL (q, genre, difficulté, tri) via
 * `useSearchParams`, ce qui exigerait un `<Suspense>` en prérendu statique — et un
 * Suspense englobant ne mettrait qu'un repli dans le HTML servi, alors que cette
 * page doit rester indexable.
 *
 * Ce qui change avec le rendu serveur du catalogue : `useSearchParams` est
 * disponible **pendant** le rendu dynamique, si bien que la grille est rendue
 * côté serveur **déjà filtrée** pour l'URL demandée. `/explore?genre=Rock` sert
 * donc du Rock aux moteurs, là où la page ne servait aucune grille du tout.
 *
 * Le coût : une lecture d'index par requête, mémoïsée par `cache()` pour la durée
 * du rendu. C'est déjà moins que les 200 documents complets que chaque visiteur
 * téléchargeait. Le jour où le trafic le justifie, c'est ici qu'un cache de
 * données partagé entre requêtes viendra se poser.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.explore' });
  const title = t('title');
  const description = t('description');

  return {
    title,
    description,
    alternates: buildAlternates(locale, PATH),
    openGraph: { ...buildOpenGraph(locale, PATH), title, description },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  /**
   * Le catalogue entier, dans sa version allégée.
   *
   * L'ordre par défaut est la date de création décroissante : c'est celui qu'un
   * visiteur voit sans rien demander, et c'est celui que la page prétendait déjà
   * appliquer. Le client retrie selon le bouton choisi, mais il retrie désormais
   * **tout** le catalogue et non deux cents documents tirés au hasard.
   */
  const refs = await getPublicSheetIndex();

  /*
   * Les rayons ne sont construits que s'ils seront montrés. Le client les efface
   * dès qu'un filtre est actif ; les rendre quand même ferait faire au serveur
   * quarante-huit vignettes pour rien, et les ferait voyager dans la charge utile.
   */
  const sp = await searchParams;
  const flane = !filtreActif(sp);


  const initialSheets = [...refs]
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .map(versGrilleDeCatalogue);

  return (
    <>
      <ExploreClient
        initialSheets={initialSheets}
        decouverte={flane ? (
          <>
            <DiscoveryShelves refs={refs} locale={locale} />
            <EntryTiles refs={refs} locale={locale} />
          </>
        ) : null}
      />
      <ExploreEditorial locale={locale} />
    </>
  );
}
