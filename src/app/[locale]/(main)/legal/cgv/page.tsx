'use client';

import { useTranslations } from 'next-intl';

export default function CgvPage() {
  const t = useTranslations('LegalCgv');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10 text-sm text-[var(--ink-light)] leading-relaxed">

      <div>
        <h1 className="font-playfair text-3xl font-bold text-[var(--ink)] mb-2">
          {t('pageTitle')}
        </h1>
        <p className="text-xs text-[var(--ink-faint)]">{t('lastUpdate')}</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">{t('s1Title')}</h2>
        <p>
          {t('s1Body')}<br />
          {t('contactLabel')} <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">alex.vauthier@gmail.com</a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">{t('s2Title')}</h2>
        <p>
          {t.rich('s2Body', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">{t('s3Title')}</h2>
        <p>{t('s3Intro')}</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{t.rich('s3Item1', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}</li>
          <li>{t.rich('s3Item2', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}</li>
        </ul>
        <p>
          {t('s3Body1')}
        </p>
        <p>{t('s3Body2')}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">{t('s4Title')}</h2>
        <p>{t('s4Intro')}</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{t('s4Item1')}</li>
          <li>{t('s4Item2')}</li>
          <li>{t('s4Item3')}</li>
          <li>{t('s4Item4')}</li>
          <li>{t('s4Item5')}</li>
        </ul>
        <p>
          {t('s4Body')}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">{t('s5Title')}</h2>
        <p>
          {t.rich('s5Body1', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}
        </p>
        <p>
          {t('s5Body2')}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">{t('s6Title')}</h2>
        <p>
          {t('s6Body1')}
        </p>
        <p>
          {t.rich('s6Body2', { email: (chunks) => <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">{chunks}</a> })}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">{t('s7Title')}</h2>
        <p>
          {t('s7Body')}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">{t('s8Title')}</h2>
        <p>
          {t('s8Body')}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">{t('s9Title')}</h2>
        <p>
          {t('s9Body1')}
        </p>
        <p>
          {t('s9Body2')} <a href="https://ec.europa.eu/consumers/odr" className="text-[var(--accent)] hover:underline" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.
        </p>
      </section>

    </div>
  );
}
