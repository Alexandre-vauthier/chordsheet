'use client';

import { useTranslations } from 'next-intl';

const CONTACT_EMAIL = 'alex.vauthier@gmail.com';
const DISCORD_URL = 'https://discord.gg/vn3xVCCKFD';

export function ContactClient() {
  const t = useTranslations('Contact');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--ink)] mb-4">{t('pageTitle')}</h1>
      <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-8">
        {t('intro')}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-6">
          <h2 className="text-sm font-semibold text-[var(--ink)] mb-2">{t('byEmail')}</h2>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-[var(--accent)] hover:underline font-medium break-all"
          >
            {CONTACT_EMAIL}
          </a>
          <p className="text-xs text-[var(--ink-faint)] mt-3 leading-relaxed">
            {t('reasons')}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-6 flex flex-col">
          <h2 className="text-sm font-semibold text-[var(--ink)] mb-2">{t('onDiscord')}</h2>
          <p className="text-xs text-[var(--ink-faint)] leading-relaxed mb-4">
            {t('discordDesc')}
          </p>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#5865F2] text-white text-sm font-medium hover:bg-[#4752c4] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.369a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 00-5.487 0 12.6 12.6 0 00-.617-1.25.077.077 0 00-.079-.036A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.009c.12.099.246.198.373.292a.077.077 0 01-.006.127c-.598.35-1.22.645-1.873.893a.077.077 0 00-.041.106c.36.699.772 1.363 1.225 1.993a.076.076 0 00.084.029 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.056c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z" />
            </svg>
            {t('joinDiscord')}
          </a>
        </div>
      </div>
    </div>
  );
}
