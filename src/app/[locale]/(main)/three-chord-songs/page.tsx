import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { getPublicSheetIndex } from '@/lib/public-sheet-index';
import { troisAccords, versGrilleDeCatalogue } from '@/lib/explore-shelves';
import { SheetGrid } from '@/components/explore/sheet-grid';

const PATH = '/three-chord-songs';

/**
 * Les morceaux à trois accords.
 *
 * Trois accords, c'est le répertoire du premier mois : la tranche mérite sa
 * page plutôt qu'un rayon dans lequel on tombe par hasard, et « chanson 3
 * accords » est une recherche à part entière.
 *
 * Adresse anglaise et unique pour les deux langues, comme les autres pages
 * d'outils du dépôt (`/what-to-play`, `/tuner`, `/chord-detect`).
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.threeChordSongs' });
  const title = t('title');
  const description = t('description');

  return {
    title,
    description,
    alternates: buildAlternates(locale, PATH),
    openGraph: { ...buildOpenGraph(locale, PATH), title, description },
  };
}

/** Une grille publiée entre dans la liste dans l'heure, comme sur `/what-to-play`. */
export const revalidate = 3600;

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'ThreeChordSongs' });

  const grilles = troisAccords(await getPublicSheetIndex()).map(versGrilleDeCatalogue);

  return (
    <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-playfair text-3xl font-bold text-[var(--ink)]">{t('title')}</h1>
        <p className="mt-2 text-[var(--ink-light)]">{t('subtitle')}</p>
        <p className="mt-1 text-sm text-[var(--ink-faint)]">{t('count', { count: grilles.length })}</p>
      </div>
      <SheetGrid sheets={grilles} />
    </div>
  );
}
