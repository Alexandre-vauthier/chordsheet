import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';
import { webApplicationSchema } from '@/lib/seo-schema';
import { ChordDetectClient } from './chord-detect-client';
import { ChordDetectEditorial } from './chord-detect-editorial';

const PATH = '/chord-detect';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.chordDetect' });
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
  const tSeo = await getTranslations({ locale, namespace: 'Seo.pages.chordDetect' });

  return (
    <>
      <ChordDetectClient />
      <ChordDetectEditorial locale={locale} />
      <JsonLd data={webApplicationSchema(locale, {
        name: tSeo('title'),
        description: tSeo('description'),
        path: PATH,
      })} />
    </>
  );
}
