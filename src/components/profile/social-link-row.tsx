'use client';

import { useTranslations } from 'next-intl';
import { parseSocialLink } from '@/lib/social-links';

/** Une ligne de lien, avec le nom de la plateforme déduit du domaine. */
export function SocialLinkRow({ url, onRemove, removeLabel }: { url: string; onRemove: () => void; removeLabel: string }) {
  const t = useTranslations('SocialPlatforms');
  const lien = parseSocialLink(url);
  if (!lien) return null;

  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]">
      <span className="text-xs font-medium text-[var(--ink)] w-24 shrink-0">{t(lien.platform)}</span>
      <span className="flex-1 min-w-0 truncate text-xs text-[var(--ink-light)]">{lien.display}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="shrink-0 text-[var(--ink-faint)] hover:text-red-500 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}
