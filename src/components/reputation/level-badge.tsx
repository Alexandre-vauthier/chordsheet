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
  const sizeClass = size === 'md' ? 'text-sm px-2.5 py-1 font-semibold' : 'text-xs px-2 py-0.5 font-medium';
  return (
    <span className={`inline-flex items-center rounded-full ${sizeClass} ${LEVEL_STYLES[level]}`}>
      {level}
    </span>
  );
}
