import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { ExploreClient } from './explore-client';

const PATH = '/explore';

// Rendu à la requête plutôt que prérendu : ExploreClient lit les paramètres d'URL
// (q, genre, difficulté, tri) via useSearchParams, ce qui exige un <Suspense> lors
// d'un prérendu statique. Or un Suspense englobant ne mettrait qu'un spinner dans
// le HTML servi, et cette page doit rester indexable. La donnée étant de toute
// façon chargée côté client, on ne perd aucun cache utile.
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

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ExploreClient />;
}
