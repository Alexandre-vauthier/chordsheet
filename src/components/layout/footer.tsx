'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function Footer() {
  const t = useTranslations('Footer');
  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-[var(--cell-bg)] print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <p className="text-xs text-[var(--ink-faint)]">
              {t('copyright', { year: new Date().getFullYear() })}
            </p>
            {/* Backlink requis par GetSongBPM (source tempo & tonalité). Lien suivi
                (pas de nofollow), présent sur tout le site via le footer. */}
            <a
              href="https://getsongbpm.com"
              target="_blank"
              rel="noopener"
              className="text-[11px] text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors"
            >
              Tempo &amp; tonalité : GetSongBPM
            </a>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            <Link href="/credits" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              {t('credits')}
            </Link>
            <Link href="/about" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              {t('about')}
            </Link>
            <Link href="/faq" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              {t('faq')}
            </Link>
            <Link href="/legal/mentions-legales" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              {t('legalNotice')}
            </Link>
            <Link href="/legal/cgu" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              {t('terms')}
            </Link>
            <Link href="/legal/confidentialite" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              {t('privacy')}
            </Link>
            <Link href="/legal/cgv" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              {t('salesTerms')}
            </Link>
            <Link href="/contact" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              {t('contact')}
            </Link>
            <a href="https://discord.gg/vn3xVCCKFD" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              {t('discord')}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
