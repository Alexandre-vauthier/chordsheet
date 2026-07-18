'use client';

import { useTranslations } from 'next-intl';

export default function MentionsLegalesPage() {
  const t = useTranslations('LegalMentions');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--ink)] mb-8">{t('pageTitle')}</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('editorTitle')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('editorIntro')}<br />
          <strong className="text-[var(--ink)]">Alexandre Vauthier</strong><br />
          {t('editorRole')}<br />
          195 rue Beauvoisine<br />
          76000 Rouen, France<br />
          {t('emailLabel')} <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">alex.vauthier@gmail.com</a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('directorTitle')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Alexandre Vauthier
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('hostingTitle')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('hostingIntro')}<br />
          <strong className="text-[var(--ink)]">Google Ireland Limited</strong><br />
          Gordon House, Barrow Street<br />
          Dublin 4, Irlande<br />
          {t('hostingVia')} <strong className="text-[var(--ink)]">Firebase / Google Cloud Platform</strong>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('ipTitle')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('ipBody')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('liabilityTitle')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('liabilityBody')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('lawTitle')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('lawBody')}
        </p>
      </section>

      <p className="text-xs text-[var(--ink-faint)] mt-10">{t('lastUpdate')}</p>
    </div>
  );
}
