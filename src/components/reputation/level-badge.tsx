import type { CreatorLevel } from '@/types';

const LEVEL_STYLES: Record<CreatorLevel, string> = {
  'Découvreur':  'bg-[var(--line)] text-[var(--ink-light)]',
  'Contributeur': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Référence':   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Maître':      'bg-[var(--accent-soft)] text-[var(--accent)]',
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
