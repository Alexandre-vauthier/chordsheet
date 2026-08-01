import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';

const PATH = '/about';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.about' });
  const title = t('title');
  const description = t('description');

  return {
    title,
    description,
    alternates: buildAlternates(locale, PATH),
    openGraph: { ...buildOpenGraph(locale, PATH), title, description },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'About' });

  // Le récit contient des mises en valeur au fil du texte. `t.rich` les porte dans
  // la traduction plutôt que de découper les paragraphes, ce qui rendrait le texte
  // impossible à relire — et impossible à traduire correctement.
  const marks = {
    b: (chunks: ReactNode) => <strong className="text-[var(--ink)] font-semibold">{chunks}</strong>,
    i: (chunks: ReactNode) => <em>{chunks}</em>,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">

      <div className="mb-12">
        <h1 className="font-playfair text-4xl font-bold text-[var(--ink)] mb-3">{t('h1')}</h1>
        <p className="text-[var(--ink-light)] text-base leading-relaxed">{t('lead')}</p>
      </div>

      <div className="space-y-8 text-[var(--ink-light)] text-sm leading-[1.9]">
        {(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] as const).map((key) => (
          <p key={key}>{t.rich(key, marks)}</p>
        ))}
        <p className="text-[var(--ink)] font-medium">{t('closing')}</p>
      </div>

      {/* Signatures */}
      <div className="mt-14 pt-8 border-t border-[var(--line)] flex gap-10">
        <div>
          <div className="font-playfair text-lg font-bold text-[var(--ink)]">Alexandre</div>
          <div className="text-xs text-[var(--ink-faint)] mt-0.5">{t('roleAlexandre')}</div>
        </div>
        <div>
          <div className="font-playfair text-lg font-bold text-[var(--ink)]">
            Julien <span className="text-[var(--ink-faint)] font-normal text-sm">(Piza)</span>
          </div>
          <div className="text-xs text-[var(--ink-faint)] mt-0.5">{t('roleJulien')}</div>
        </div>
      </div>

    </div>
  );
}
