'use client';

import { useTranslations } from 'next-intl';
import { parseSocialLink } from '@/lib/social-links';

/**
 * Les liens d'un créateur, sur son profil public.
 *
 * `rel="nofollow ugc"` sur chaque lien : ce sont des adresses saisies librement par
 * un utilisateur, elles ne doivent transmettre aucun signal de référencement, sans
 * quoi la page devient une cible à spam. `noopener noreferrer` va avec `target`.
 */
export function SocialLinks({ links, className = '' }: { links: { url: string }[]; className?: string }) {
  const t = useTranslations('SocialPlatforms');

  const reconnus = links
    .map((l) => parseSocialLink(l.url))
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (reconnus.length === 0) return null;

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {reconnus.map((lien) => (
        <li key={lien.url}>
          <a
            href={lien.url}
            target="_blank"
            rel="nofollow ugc noopener noreferrer"
            title={lien.display}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--line)]
              bg-[var(--cell-bg)] text-xs text-[var(--ink-light)] hover:border-[var(--accent)]
              hover:text-[var(--accent)] transition-colors"
          >
            {t(lien.platform)}
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18v4.5M17.5 6.5L10 14M15 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h4" />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
