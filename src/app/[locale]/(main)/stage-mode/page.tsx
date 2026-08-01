import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { Editorial, EditorialHeader, EditorialSection, EditorialLinks } from '@/components/seo/editorial';

const PATH = '/stage-mode';
const NS = 'Editorial.stageMode';

/** Sections dans l'ordre de lecture. Chaque entrée attend une clé `h2` et une clé `body`. */
const SECTIONS = ['setlist', 'sync', 'accompaniment', 'groove', 'live'] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.stageMode' });
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
  const t = await getTranslations({ locale, namespace: NS });

  return (
    <Editorial bordered={false}>
      <EditorialHeader title={t('h1')} lead={t('lead')} />

      {SECTIONS.map((key) => (
        <EditorialSection key={key} title={t(`${key}.h2`)} id={key}>
          <p>{t(`${key}.body`)}</p>
        </EditorialSection>
      ))}

      <EditorialLinks
        title={t('links.h2')}
        links={[
          { href: '/bands', label: t('links.bands') },
          { href: '/pricing', label: t('links.pricing') },
          { href: '/explore', label: t('links.explore') },
          { href: '/faq', label: t('links.faq') },
        ]}
      />
    </Editorial>
  );
}
