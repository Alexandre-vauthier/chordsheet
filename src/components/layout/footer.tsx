'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Pied de page : c'est le principal outil de maillage interne du site. Il est rendu
 * partout, y compris sur la page d'accueil, qui reçoit les liens externes et doit
 * donc redistribuer vers les pages de contenu.
 *
 * Les libellés sont des ancres descriptives : ce texte est ce que les moteurs
 * retiennent de la page de destination.
 */
export function Footer() {
  const t = useTranslations('Footer');

  const columns: { heading: string; links: { href: string; label: string }[] }[] = [
    {
      heading: t('colBrowse'),
      links: [
        { href: '/explore', label: t('linkExplore') },
        { href: '/artists', label: t('linkArtists') },
      ],
    },
    {
      heading: t('colChords'),
      links: [
        { href: '/chords', label: t('linkChords') },
        { href: '/chord-detect', label: t('linkChordDetect') },
      ],
    },
    {
      heading: t('colTools'),
      links: [
        { href: '/tuner', label: t('linkTuner') },
        { href: '/sheet/new', label: t('linkNewSheet') },
      ],
    },
    {
      heading: t('colAbout'),
      links: [
        { href: '/about', label: t('about') },
        { href: '/faq', label: t('faq') },
        { href: '/pricing', label: t('linkPricing') },
        { href: '/contact', label: t('contact') },
        { href: '/credits', label: t('credits') },
      ],
    },
    {
      heading: t('colLegal'),
      links: [
        { href: '/legal/mentions-legales', label: t('legalNotice') },
        { href: '/legal/cgu', label: t('terms') },
        { href: '/legal/cgv', label: t('salesTerms') },
        { href: '/legal/confidentialite', label: t('privacy') },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-[var(--cell-bg)] print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-8">
          {columns.map(col => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-light)] mb-3">
                {col.heading}
              </h2>
              <ul className="space-y-1.5">
                {col.links.map(l => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-xs text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 pt-5 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[var(--ink-faint)]">
            {t('copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-1">
            <a
              href="https://discord.gg/vn3xVCCKFD"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors"
            >
              {t('discord')}
            </a>
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
        </div>

      </div>
    </footer>
  );
}
