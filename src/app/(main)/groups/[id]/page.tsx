'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useAuth } from '@/lib/auth-context';
import { useGroups } from '@/lib/use-groups';
import type { Group, GroupRole, Sheet } from '@/types';

interface MemberInfo {
  id: string;
  displayName: string;
  email: string;
  role: GroupRole;
}

function groupFromDoc(id: string, data: Record<string, unknown>): Group {
  return {
    id,
    name: (data.name as string) || '',
    description: (data.description as string) || undefined,
    ownerId: (data.ownerId as string) || '',
    memberIds: (data.memberIds as string[]) || [],
    roles: (data.roles as Record<string, GroupRole>) || {},
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() || new Date(),
    updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() || new Date(),
  };
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const { user } = useAuth();
  const { generateInviteToken, leaveGroup, removeMember, deleteGroup } = useGroups();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [actionError, setActionError] = useState('');

  const isLeader = user && group ? group.roles[user.id] === 'leader' : false;
  const isOwner = user && group ? group.ownerId === user.id : false;

  useEffect(() => {
    if (!groupId) return;
    const db = getDb();
    getDoc(doc(db, 'groups', groupId)).then(async (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const g = groupFromDoc(snap.id, snap.data() as Record<string, unknown>);
      setGroup(g);

      // Charger les infos des membres
      const memberProfiles = await Promise.all(
        g.memberIds.map(async (uid) => {
          const userSnap = await getDoc(doc(db, 'users', uid));
          const data = userSnap.data() as Record<string, unknown> | undefined;
          return {
            id: uid,
            displayName: (data?.displayName as string) || (data?.email as string) || uid,
            email: (data?.email as string) || '',
            role: g.roles[uid] || 'member',
          };
        })
      );
      setMembers(memberProfiles);

      // Charger les grilles du groupe
      try {
        const sheetsSnap = await getDocs(
          query(collection(db, 'sheets'), where('groupId', '==', snap.id), orderBy('updatedAt', 'desc'))
        );
        setSheets(sheetsSnap.docs.map(d => fromFirestore(d.id, d.data() as Record<string, unknown>)));
      } catch {
        // Index manquant : fallback sans tri
        const sheetsSnap = await getDocs(
          query(collection(db, 'sheets'), where('groupId', '==', snap.id))
        );
        setSheets(sheetsSnap.docs.map(d => fromFirestore(d.id, d.data() as Record<string, unknown>)));
      }

      setLoading(false);
    });
  }, [groupId]);

  const handleGenerateInvite = async () => {
    if (!group) return;
    setInviteLoading(true);
    try {
      const token = await generateInviteToken(group.id!, group.name);
      const link = `${window.location.origin}/join/${token}`;
      setInviteLink(link);
    } catch {
      setActionError('Erreur lors de la génération du lien.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const handleLeave = async () => {
    if (!confirm('Quitter ce groupe ?')) return;
    try {
      await leaveGroup(groupId);
      router.push('/groups');
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Retirer ${memberName} du groupe ?`)) return;
    try {
      await removeMember(groupId, memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer le groupe "${group?.name}" ? Cette action est irréversible.`)) return;
    try {
      await deleteGroup(groupId);
      router.push('/groups');
    } catch {
      setActionError('Erreur lors de la suppression.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-48 bg-[var(--cell-bg)] rounded animate-pulse" />
        <div className="h-32 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-[var(--ink-light)]">Groupe introuvable.</p>
        <Link href="/groups" className="mt-4 inline-block text-sm text-[var(--accent)]">← Mes groupes</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* En-tête */}
      <div>
        <Link href="/groups" className="text-sm text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors">
          ← Mes groupes
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-playfair text-2xl font-bold text-[var(--ink)]">{group.name}</h1>
            {group.description && (
              <p className="text-[var(--ink-light)] mt-1">{group.description}</p>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{actionError}</p>
      )}

      {/* Membres */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--ink-light)] uppercase tracking-wide mb-3">
          Membres ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map(member => (
            <div
              key={member.id}
              className="flex items-center justify-between px-4 py-3 bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold">
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--ink)]">{member.displayName}</div>
                  {member.email && member.email !== member.displayName && (
                    <div className="text-xs text-[var(--ink-faint)]">{member.email}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  member.role === 'leader'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/20'
                    : 'bg-[var(--paper)] text-[var(--ink-faint)] border-[var(--line)]'
                }`}>
                  {member.role === 'leader' ? 'Leader' : 'Membre'}
                </span>
                {isLeader && member.id !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.id, member.displayName)}
                    className="text-xs text-[var(--ink-faint)] hover:text-red-500 transition-colors px-1.5 py-0.5 rounded"
                  >
                    Retirer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Grilles du groupe */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--ink-light)] uppercase tracking-wide">
            Grilles ({sheets.length})
          </h2>
          <Link
            href={`/sheet/new?groupId=${groupId}`}
            className="text-xs px-3 py-1.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors"
          >
            + Nouvelle grille
          </Link>
        </div>
        {sheets.length === 0 ? (
          <p className="text-sm text-[var(--ink-faint)] py-4 text-center">
            Aucune grille pour l&apos;instant. Créez la première grille du groupe !
          </p>
        ) : (
          <div className="space-y-2">
            {sheets.map(sheet => (
              <Link
                key={sheet.id}
                href={`/sheet/${sheet.id}`}
                className="flex items-center justify-between px-4 py-3 bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg hover:border-[var(--accent)] transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--ink)] truncate">{sheet.title}</div>
                  <div className="text-xs text-[var(--ink-faint)] truncate">{sheet.artist}</div>
                </div>
                {sheet.key && (
                  <span className="shrink-0 text-xs text-[var(--ink-faint)] bg-[var(--paper)] border border-[var(--line)] px-2 py-0.5 rounded-full ml-3">
                    {sheet.key}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Invitation */}
      {isLeader && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--ink-light)] uppercase tracking-wide mb-3">
            Inviter des membres
          </h2>
          <div className="p-4 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl space-y-3">
            <p className="text-sm text-[var(--ink-light)]">
              Génère un lien d&apos;invitation valable 7 jours et partage-le avec tes musiciens.
            </p>
            {inviteLink ? (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3 py-2 text-sm border border-[var(--line)] rounded-lg bg-[var(--paper)] text-[var(--ink)] focus:outline-none"
                />
                <button
                  onClick={handleCopyInvite}
                  className="px-3 py-2 text-sm border border-[var(--line)] rounded-lg bg-[var(--paper)] hover:border-[var(--accent)] transition-colors text-[var(--ink)]"
                >
                  {inviteCopied ? '✓ Copié' : 'Copier'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateInvite}
                disabled={inviteLoading}
                className="px-4 py-2 text-sm bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-light)] transition-colors disabled:opacity-50"
              >
                {inviteLoading ? 'Génération…' : 'Générer un lien'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="border-t border-[var(--line)] pt-4 flex gap-3">
        {!isOwner && (
          <button
            onClick={handleLeave}
            className="px-4 py-2 text-sm border border-[var(--line)] text-[var(--ink-light)] rounded-lg hover:border-red-300 hover:text-red-500 transition-colors"
          >
            Quitter le groupe
          </button>
        )}
        {isOwner && (
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
          >
            Supprimer le groupe
          </button>
        )}
      </section>
    </div>
  );
}
