import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';
import { webApplicationSchema } from '@/lib/seo-schema';
import { TunerClient } from './tuner-client';
import { TunerEditorial } from './tuner-editorial';

const PATH = '/tuner';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.tuner' });
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
  const tSeo = await getTranslations({ locale, namespace: 'Seo.pages.tuner' });

  return (
    <>
      <TunerClient />
      <TunerEditorial locale={locale} />
      <JsonLd data={webApplicationSchema(locale, {
        name: tSeo('title'),
        description: tSeo('description'),
        path: PATH,
      })} />
    </>
  );
}
