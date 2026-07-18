'use client';

import { useTranslations } from 'next-intl';

export default function ConfidentialitePage() {
  const t = useTranslations('LegalConfidentialite');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--ink)] mb-2">{t('pageTitle')}</h1>
      <p className="text-sm text-[var(--ink-faint)] mb-8">{t('effectiveDate')}</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s1Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s1Intro')}<br />
          <strong className="text-[var(--ink)]">Alexandre Vauthier</strong> — {t('s1Role')}<br />
          195 rue Beauvoisine, 76000 Rouen<br />
          {t('emailLabel')} <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">alex.vauthier@gmail.com</a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s2Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-3">
          {t('s2Intro')}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left py-2 pr-4 font-medium text-[var(--ink)]">{t('colData')}</th>
                <th className="text-left py-2 pr-4 font-medium text-[var(--ink)]">{t('colPurpose')}</th>
                <th className="text-left py-2 font-medium text-[var(--ink)]">{t('colLegalBasis')}</th>
              </tr>
            </thead>
            <tbody className="text-[var(--ink-light)]">
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-4">{t('row1Data')}</td>
                <td className="py-2 pr-4">{t('row1Purpose')}</td>
                <td className="py-2">{t('contractBasis')}</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-4">{t('row2Data')}</td>
                <td className="py-2 pr-4">{t('row2Purpose')}</td>
                <td className="py-2">{t('contractBasis')}</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-4">{t('row3Data')}</td>
                <td className="py-2 pr-4">{t('row3Purpose')}</td>
                <td className="py-2">{t('contractBasis')}</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-4">{t('row4Data')}</td>
                <td className="py-2 pr-4">{t('row4Purpose')}</td>
                <td className="py-2">{t('row4LegalBasis')}</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-4">{t('row5Data')}</td>
                <td className="py-2 pr-4">{t('row5Purpose')}</td>
                <td className="py-2">{t('contractBasis')}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">{t('row6Data')}</td>
                <td className="py-2 pr-4">{t('row6Purpose')}</td>
                <td className="py-2">{t('contractBasis')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s3Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t.rich('s3Body', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s4Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s4Body')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s5Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s5Body')}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s6Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-3">
          {t('s6Intro')}
        </p>
        <ul className="text-sm text-[var(--ink-light)] leading-relaxed list-disc list-inside space-y-1 mb-3">
          <li>{t.rich('s6Item1', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}</li>
          <li>{t.rich('s6Item2', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}</li>
          <li>{t.rich('s6Item3', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}</li>
          <li>{t.rich('s6Item4', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}</li>
          <li>{t.rich('s6Item5', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}</li>
        </ul>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t.rich('s6Body', {
            email: (chunks) => <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">{chunks}</a>,
            strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong>,
            cnil: (chunks) => <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">{chunks}</a>,
          })}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">{t('s7Title')}</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t('s7Body')}
        </p>
      </section>

      <p className="text-xs text-[var(--ink-faint)] mt-10">{t('lastUpdate')}</p>
    </div>
  );
}
