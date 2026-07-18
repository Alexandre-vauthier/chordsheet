'use client';

import { useGroups } from '@/lib/use-groups';
import { useAuth } from '@/lib/auth-context';
import { Link, useRouter } from '@/i18n/navigation';

export function ConcertBanner() {
  const { groups, endConcert } = useGroups();
  const { user } = useAuth();
  const router = useRouter();

  const active = groups.filter(g => g.activeConcert);
  if (active.length === 0) return null;

  return (
    <div className="bg-red-600 text-white print:hidden">
      {active.map(group => (
        <div key={group.id} className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
          <span className="text-sm font-medium flex-1 truncate">
            <span className="opacity-75">{group.name} · </span>
            {group.activeConcert!.setName}
            {group.activeConcert!.startedBy !== user?.id && (
              <span className="opacity-60 ml-2 text-xs">lancé par {group.activeConcert!.startedByName}</span>
            )}
          </span>
          <Link
            href={`/sets/${group.activeConcert!.setId}/play`}
            className="shrink-0 px-3 py-1 bg-white text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
          >
            Rejoindre
          </Link>
          <button
            onClick={() => endConcert(group.id!).catch(() => {})}
            className="shrink-0 text-white/60 hover:text-white text-lg leading-none transition-colors"
            title="Terminer le concert"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
