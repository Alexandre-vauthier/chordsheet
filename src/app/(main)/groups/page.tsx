'use client';

import Link from 'next/link';
import { useGroups } from '@/lib/use-groups';
import type { Group } from '@/types';

function GroupCard({ group }: { group: Group }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="block p-5 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl hover:border-[var(--accent)] hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-[var(--ink)] truncate">{group.name}</h2>
          {group.description && (
            <p className="text-sm text-[var(--ink-light)] mt-0.5 line-clamp-2">{group.description}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-[var(--ink-faint)] bg-[var(--paper)] border border-[var(--line)] px-2 py-1 rounded-full">
          {group.memberIds.length} membre{group.memberIds.length > 1 ? 's' : ''}
        </span>
      </div>
    </Link>
  );
}

export default function GroupsPage() {
  const { groups, loading } = useGroups();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-playfair text-2xl font-bold text-[var(--ink)]">Mes groupes</h1>
        <Link
          href="/groups/new"
          className="px-4 py-2 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Nouveau groupe
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-[var(--ink-faint)]">
          <div className="text-4xl mb-3">🎸</div>
          <p className="font-medium text-[var(--ink-light)]">Aucun groupe pour l&apos;instant</p>
          <p className="text-sm mt-1">Crée un groupe ou rejoins-en un via un lien d&apos;invitation.</p>
          <Link
            href="/groups/new"
            className="inline-block mt-4 px-4 py-2 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
          >
            Créer mon premier groupe
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
