import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';
import { faqSchema } from '@/lib/seo-schema';
import { FaqClient } from './faq-client';

const PATH = '/faq';

/** Couples question/réponse affichés par FaqClient, dans le même ordre. */
const FAQ_KEYS = [
  { q: 's1q1', a: 's1a1' }, { q: 's1q2', a: 's1a2' },
  { q: 's2q1', a: 's2a1' }, { q: 's2q2', a: 's2a2' }, { q: 's2q3', a: 's2a3' },
  { q: 's3q1', a: 's3a1' }, { q: 's3q2', a: 's3a2' }, { q: 's3q3', a: 's3a3' },
  { q: 's4q1', a: 's4a1' }, { q: 's4q2', a: 's4a2' }, { q: 's4q3', a: 's4a3' }, { q: 's4q4', a: 's4a4' },
  { q: 's5q1', a: 's5a1' }, { q: 's5q2', a: 's5a2' },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.faq' });
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

  // Les questions balisées sont exactement celles rendues par FaqClient : le
  // balisage ne doit décrire que ce qui est visible.
  const t = await getTranslations({ locale, namespace: 'Faq' });
  const items = FAQ_KEYS.map(({ q, a }) => ({ question: t(q), answer: t(a) }));

  return (
    <>
      <FaqClient />
      <JsonLd data={faqSchema(items)} />
    </>
  );
}
