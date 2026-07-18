'use client';

import { useTranslations } from 'next-intl';

export default function CguPage() {
  const t = useTranslations('LegalCgu');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--ink)] mb-2">{t('pageTitle')}</h1>
      <p className="text-sm text-[var(--ink-faint)] mb-8">{t('effectiveDate')}</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s1Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s1Body')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s2Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s2Body')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s3Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s3Body')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s4Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-3">
          {t.rich('s4Body1', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}
        </p>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s4Body2')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s5Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-2">{t('s5Intro')}</p>
        <ul className="text-sm text-[var(--ink-light)] leading-relaxed list-disc list-inside space-y-1">
          <li>{t('s5Item1')}</li>
          <li>{t('s5Item2')}</li>
          <li>{t('s5Item3')}</li>
          <li>{t('s5Item4')}</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s6Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s6Body')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s7Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s7Body')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s8Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s8Body')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s9Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-3">
          {t.rich('s9Intro', { email: (chunks) => <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">{chunks}</a> })}
        </p>
        <ul className="text-sm text-[var(--ink-light)] leading-relaxed list-disc list-inside space-y-1 mb-3">
          <li>{t('s9Item1')}</li>
          <li>{t('s9Item2')}</li>
          <li>{t('s9Item3')}</li>
        </ul>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s9Body2')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s10Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s10Body')}
        </p>
      </section>

      <p className="text-xs text-[var(--ink-faint)] mt-10">{t('lastUpdate')}</p>
    </div>
  );
}
