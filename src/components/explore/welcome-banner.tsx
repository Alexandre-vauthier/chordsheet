'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
const LS_KEY = 'chordsheet_welcome_dismissed';
const LS_NEW = 'chordsheet_show_welcome';

export function WelcomeBanner() {
  const t = useTranslations('WelcomeBanner');
  const [visible, setVisible] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(LS_KEY);
    const showWelcome = localStorage.getItem(LS_NEW);
    if (!dismissed) {
      setVisible(true);
      if (showWelcome) {
        setIsNew(true);
        localStorage.removeItem(LS_NEW);
      }
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(LS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  const pillars = [
    { icon: '📖', label: t('pillar1Label'), desc: t('pillar1Desc') },
    { icon: '🎵', label: t('pillar2Label'), desc: t('pillar2Desc') },
    { icon: '🤝', label: t('pillar3Label'), desc: t('pillar3Desc') },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--cell-bg)] shadow-2xl overflow-hidden">
        {/* Fermer */}
        <button
          onClick={dismiss}
          className="cursor-pointer absolute top-4 right-4 p-1.5 rounded-lg text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--line)] transition-colors"
          title={t('close')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Corps */}
        <div className="px-8 pt-8 pb-6">
          {/* Logo / icône */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] text-2xl">
              ♪
            </div>
            <div>
              {isNew ? (
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">{t('welcomeBadge')}</p>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">{t('brand')}</p>
              )}
              <h2 className="text-lg font-bold text-[var(--ink)] font-playfair leading-tight">
                {t('title')}
              </h2>
            </div>
          </div>

          <p className="text-sm text-[var(--ink-light)] leading-relaxed">
            {t.rich('body1', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}
          </p>
          <p className="text-sm text-[var(--ink-light)] leading-relaxed mt-3">
            {t.rich('body2', { strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}
          </p>

          {/* Trois piliers */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            {pillars.map(({ icon, label, desc }) => (
              <div key={label} className="rounded-xl bg-[var(--cream)] border border-[var(--line)] px-3 py-3 text-center">
                <div className="text-xl mb-1">{icon}</div>
                <div className="text-xs font-semibold text-[var(--ink)]">{label}</div>
                <div className="text-[10px] text-[var(--ink-faint)] mt-0.5 leading-tight">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-[var(--line)] px-8 py-4 flex flex-col sm:flex-row gap-2">
          <Link
            href="/sheet/new"
            onClick={dismiss}
            className="flex-1 text-center px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[#a83d25] transition-colors"
          >
            {t('createFirst')}
          </Link>
          <button
            onClick={dismiss}
            className="cursor-pointer flex-1 px-4 py-2.5 rounded-xl border border-[var(--line)] text-sm text-[var(--ink-light)] hover:border-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
          >
            {t('explore')}
          </button>
        </div>
      </div>
    </div>
  );
}
