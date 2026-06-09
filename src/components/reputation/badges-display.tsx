import type { BadgeId } from '@/types';
import { BADGE_DEFINITIONS } from '@/lib/creator-reputation';

interface BadgesDisplayProps {
  earned: BadgeId[];
  showAll?: boolean; // affiche aussi les badges non débloqués (grisés)
}

const ALL_BADGE_IDS: BadgeId[] = [
  'first_bookmark', 'bookmark_10', 'bookmark_50', 'bookmark_200',
  'first_rating', 'rating_10', 'high_quality',
  'prolific', 'top_rated_sheet',
];

export function BadgesDisplay({ earned, showAll = false }: BadgesDisplayProps) {
  const toShow = showAll ? ALL_BADGE_IDS : earned;
  if (toShow.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {toShow.map((id) => {
        const def = BADGE_DEFINITIONS[id];
        const isEarned = earned.includes(id);
        return (
          <span
            key={id}
            title={`${def.label} — ${def.description}`}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-opacity
              ${isEarned
                ? 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink)]'
                : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-faint)] opacity-40'
              }`}
          >
            <span>{def.icon}</span>
            <span>{def.label}</span>
          </span>
        );
      })}
    </div>
  );
}
