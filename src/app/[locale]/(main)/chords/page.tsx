import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { ChordsClient } from './chords-client';
import { ChordsEditorial } from './chords-editorial';

const PATH = '/chords';

// Même raison que /explore : ChordsClient lit les paramètres d'URL (instrument,
// catégorie) et s'enveloppe d'un <Suspense>. En prérendu statique, ce Suspense ne
// laissait qu'un spinner dans le HTML — 387 caractères et aucun titre. Rendue à la
// requête, la bibliothèque entière est servie au premier chargement.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.chords' });
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
  return (
    <>
      <ChordsClient />
      <ChordsEditorial locale={locale} />
    </>
  );
}
