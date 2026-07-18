'use client';

import { useTranslations } from 'next-intl';

const SECTIONS = [
  { key: 's1', itemCount: 2 },
  { key: 's2', itemCount: 3 },
  { key: 's3', itemCount: 3 },
  { key: 's4', itemCount: 4 },
  { key: 's5', itemCount: 2 },
] as const;

export default function FaqPage() {
  const t = useTranslations('Faq');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <h1 className="font-playfair text-3xl font-bold text-[var(--ink)] mb-2">{t('pageTitle')}</h1>
        <p className="text-[var(--ink-light)] text-sm">{t('pageSubtitle')}</p>
      </div>

      <div className="space-y-10">
        {SECTIONS.map((section) => (
          <div key={section.key}>
            <h2 className="font-playfair text-lg font-bold text-[var(--ink)] mb-3 pb-2 border-b border-[var(--line)]">
              {t(`${section.key}Title`)}
            </h2>
            <div className="space-y-1">
              {Array.from({ length: section.itemCount }, (_, i) => i + 1).map((n) => (
                <FaqItem
                  key={n}
                  question={t(`${section.key}q${n}`)}
                  answer={t(`${section.key}a${n}`)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-[var(--line)] text-center">
        <p className="text-sm text-[var(--ink-light)]">
          {t('noAnswerText')}{' '}
          <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">
            {t('contactLink')}
          </a>
        </p>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group border border-[var(--line)] rounded-xl bg-[var(--cell-bg)] overflow-hidden">
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none
        hover:bg-[var(--accent-soft)] transition-colors">
        <span className="font-medium text-[var(--ink)] pr-4">{question}</span>
        <span className="flex-shrink-0 text-[var(--ink-faint)] transition-transform duration-200 group-open:rotate-45 text-xl leading-none">
          +
        </span>
      </summary>
      <div className="px-5 pb-4 pt-1 text-sm text-[var(--ink-light)] leading-relaxed border-t border-[var(--line)]">
        {answer}
      </div>
    </details>
  );
}
