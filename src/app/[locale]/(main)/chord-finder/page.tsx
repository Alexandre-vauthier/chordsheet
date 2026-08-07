import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';
import { webApplicationSchema } from '@/lib/seo-schema';
import { ChordFinderClient } from './chord-finder-client';
import { ChordFinderEditorial } from './chord-finder-editorial';

/**
 * Trouver un accord à partir des notes qu'on joue.
 *
 * Le chercheur n'existait que comme fenêtre par-dessus la bibliothèque : il
 * n'avait donc pas d'adresse, rien à indexer ni à partager, et il fallait un
 * paramètre d'URL pour l'ouvrir depuis un menu. Ses deux frères — l'accordeur et
 * l'identification au micro — sont des pages depuis toujours.
 *
 * `/chord-finder` et non `/chords/finder` : ce dernier tomberait dans la route
 * `/chords/[instrument]` et rendrait un 404, « finder » n'étant pas un instrument.
 */
const PATH = '/chord-finder';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.chordFinder' });
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
  const tSeo = await getTranslations({ locale, namespace: 'Seo.pages.chordFinder' });

  return (
    <>
      <ChordFinderClient />
      <ChordFinderEditorial locale={locale} />
      <JsonLd data={webApplicationSchema(locale, {
        name: tSeo('title'),
        description: tSeo('description'),
        path: PATH,
      })} />
    </>
  );
}
