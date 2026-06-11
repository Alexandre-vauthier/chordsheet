'use client';

import Link from 'next/link';
import { useGroups } from '@/lib/use-groups';
import { useSets } from '@/lib/use-sets';
import { useAuth } from '@/lib/auth-context';
import type { Group } from '@/types';

const AVATAR_COLORS = [
  '#c84b2f', '#2563eb', '#16a34a', '#9333ea',
  '#ea580c', '#0891b2', '#be185d', '#ca8a04',
];

function groupColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function groupInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function GroupCard({ group, setsCount }: { group: Group; setsCount: number }) {
  const color = groupColor(group.id || group.name);
  const initials = groupInitials(group.name);
  const sheetCount = group.linkedSheetIds.length;

  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex items-center gap-4 p-4 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl hover:border-[var(--accent)] hover:shadow-sm transition-all group"
    >
      {/* Avatar initiales */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-sm select-none"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-[var(--ink)] truncate group-hover:text-[var(--accent)] transition-colors">
          {group.name}
        </h2>
        {group.description && (
          <p className="text-sm text-[var(--ink-light)] mt-0.5 truncate">{group.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--ink-faint)]">
          <span>{group.memberIds.length} membre{group.memberIds.length > 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{sheetCount} grille{sheetCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{setsCount} set{setsCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Chevron */}
      <svg className="w-4 h-4 text-[var(--ink-faint)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
      </svg>
    </Link>
  );
}

export default function GroupsPage() {
  const { user } = useAuth();
  const { groups, loading } = useGroups();
  const { sets } = useSets(user?.id);

  // Compte les sets par groupId côté client (pas de requête supplémentaire)
  const setsCountByGroup = sets.reduce<Record<string, number>>((acc, s) => {
    if (s.groupId) acc[s.groupId] = (acc[s.groupId] || 0) + 1;
    return acc;
  }, {});

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
          <div className="w-16 h-16 rounded-full bg-[var(--accent-soft)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
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
            <GroupCard
              key={group.id}
              group={group}
              setsCount={setsCountByGroup[group.id!] || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
