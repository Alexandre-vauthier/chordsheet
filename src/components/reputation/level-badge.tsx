'use client';

import { useTranslations } from 'next-intl';
import type { CreatorLevel } from '@/types';

const LEVEL_STYLES: Record<CreatorLevel, string> = {
  'Découvreur':  'bg-[var(--line)] text-[var(--ink-faint)]',
  'Contributeur': 'bg-[var(--line)] text-[var(--ink-light)]',
  'Référence':   'bg-[var(--accent-soft)] text-[var(--accent)]',
  'Maître':      'bg-[var(--accent)] text-white',
};

interface LevelBadgeProps {
  level: CreatorLevel;
  size?: 'sm' | 'md';
}

export function LevelBadge({ level, size = 'sm' }: LevelBadgeProps) {
  // Les niveaux servent d'identifiant en base : on traduit ce qu'on affiche, pas la
  // clé, sinon les documents existants ne correspondraient plus.
  const t = useTranslations('CreatorLevels');
  const sizeClass = size === 'md' ? 'text-sm px-2.5 py-1 font-semibold' : 'text-xs px-2 py-0.5 font-medium';
  return (
    <span className={`inline-flex items-center rounded-full ${sizeClass} ${LEVEL_STYLES[level]}`}>
      {t(level)}
    </span>
  );
}
