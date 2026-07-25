'use client';

import { useTranslations } from 'next-intl';

const CONTACT_EMAIL = 'alex.vauthier@gmail.com';

export default function ContactPage() {
  const t = useTranslations('Contact');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--ink)] mb-4">{t('pageTitle')}</h1>
      <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-8">
        {t('intro')}
      </p>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-6">
        <h2 className="text-sm font-semibold text-[var(--ink)] mb-2">{t('byEmail')}</h2>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-[var(--accent)] hover:underline font-medium"
        >
          {CONTACT_EMAIL}
        </a>
        <p className="text-xs text-[var(--ink-faint)] mt-3 leading-relaxed">
          {t('reasons')}
        </p>
      </div>
    </div>
  );
}
