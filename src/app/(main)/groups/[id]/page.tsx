'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, deleteField, serverTimestamp,
} from 'firebase/firestore';
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

  // Invitation
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Rattachement de grille existante
  const [showAttach, setShowAttach] = useState(false);
  const [attachSearch, setAttachSearch] = useState('');
  const [mySheets, setMySheets] = useState<Sheet[]>([]);
  const [mySheetLoading, setMySheetLoading] = useState(false);
  const [attachLoading, setAttachLoading] = useState<string | null>(null);

  const [actionError, setActionError] = useState('');

  const isLeader = user && group ? group.roles[user.id] === 'leader' : false;
  const isOwner = user && group ? group.ownerId === user.id : false;
  const isMember = user && group ? group.memberIds.includes(user.id) : false;

  // Chargement initial
  useEffect(() => {
    if (!groupId) return;
    const db = getDb();
    getDoc(doc(db, 'groups', groupId)).then(async (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const g = groupFromDoc(snap.id, snap.data() as Record<string, unknown>);
      setGroup(g);

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

      try {
        const sheetsSnap = await getDocs(
          query(collection(db, 'sheets'), where('groupId', '==', snap.id), orderBy('updatedAt', 'desc'))
        );
        setSheets(sheetsSnap.docs.map(d => fromFirestore(d.id, d.data() as Record<string, unknown>)));
      } catch {
        const sheetsSnap = await getDocs(
          query(collection(db, 'sheets'), where('groupId', '==', snap.id))
        );
        setSheets(sheetsSnap.docs.map(d => fromFirestore(d.id, d.data() as Record<string, unknown>)));
      }

      setLoading(false);
    });
  }, [groupId]);

  // Charger les grilles de l'utilisateur (pour le panneau de rattachement)
  const loadMySheets = async () => {
    if (!user) return;
    setMySheetLoading(true);
    const db = getDb();
    try {
      const snap = await getDocs(
        query(collection(db, 'sheets'), where('ownerId', '==', user.id), orderBy('updatedAt', 'desc'))
      );
      const all = snap.docs.map(d => fromFirestore(d.id, d.data() as Record<string, unknown>));
      // Exclure celles déjà dans ce groupe
      setMySheets(all.filter(s => s.groupId !== groupId));
    } catch {
      const snap = await getDocs(
        query(collection(db, 'sheets'), where('ownerId', '==', user.id))
      );
      const all = snap.docs.map(d => fromFirestore(d.id, d.data() as Record<string, unknown>));
      setMySheets(all.filter(s => s.groupId !== groupId));
    } finally {
      setMySheetLoading(false);
    }
  };

  const handleOpenAttach = () => {
    setShowAttach(true);
    setAttachSearch('');
    loadMySheets();
  };

  const handleAttach = async (sheet: Sheet) => {
    if (!sheet.id) return;
    setAttachLoading(sheet.id);
    try {
      const db = getDb();
      await updateDoc(doc(db, 'sheets', sheet.id), {
        groupId,
        updatedAt: serverTimestamp(),
      });
      const updated = { ...sheet, groupId };
      setSheets(prev => [updated, ...prev]);
      setMySheets(prev => prev.filter(s => s.id !== sheet.id));
    } catch {
      setActionError('Erreur lors du rattachement.');
    } finally {
      setAttachLoading(null);
    }
  };

  const handleDetach = async (sheet: Sheet) => {
    if (!sheet.id) return;
    if (!confirm(`Retirer "${sheet.title}" du groupe ?`)) return;
    try {
      const db = getDb();
      await updateDoc(doc(db, 'sheets', sheet.id), {
        groupId: deleteField(),
        updatedAt: serverTimestamp(),
      });
      setSheets(prev => prev.filter(s => s.id !== sheet.id));
    } catch {
      setActionError('Erreur lors du retrait.');
    }
  };

  const handleGenerateInvite = async () => {
    if (!group) return;
    setInviteLoading(true);
    try {
      const token = await generateInviteToken(group.id!, group.name);
      setInviteLink(`${window.location.origin}/join/${token}`);
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

  const filteredMySheets = mySheets.filter(s =>
    !attachSearch || `${s.title} ${s.artist}`.toLowerCase().includes(attachSearch.toLowerCase())
  );

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
        <div className="mt-2">
          <h1 className="font-playfair text-2xl font-bold text-[var(--ink)]">{group.name}</h1>
          {group.description && (
            <p className="text-[var(--ink-light)] mt-1">{group.description}</p>
          )}
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
          <div className="flex gap-2">
            {isMember && (
              <button
                onClick={handleOpenAttach}
                className="text-xs px-3 py-1.5 border border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] rounded-lg transition-colors"
              >
                Rattacher une grille
              </button>
            )}
            <Link
              href={`/sheet/new?groupId=${groupId}`}
              className="text-xs px-3 py-1.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors"
            >
              + Nouvelle grille
            </Link>
          </div>
        </div>

        {/* Panneau de rattachement */}
        {showAttach && (
          <div className="mb-4 p-4 bg-[var(--paper)] border border-[var(--accent)]/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--ink)]">Rattacher une de tes grilles</p>
              <button onClick={() => setShowAttach(false)} className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-lg leading-none">×</button>
            </div>
            <input
              type="text"
              value={attachSearch}
              onChange={e => setAttachSearch(e.target.value)}
              placeholder="Rechercher par titre ou artiste…"
              className="w-full px-3 py-2 text-sm border border-[var(--line)] rounded-lg bg-[var(--cell-bg)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            {mySheetLoading ? (
              <div className="text-sm text-[var(--ink-faint)] text-center py-3">Chargement…</div>
            ) : filteredMySheets.length === 0 ? (
              <p className="text-sm text-[var(--ink-faint)] text-center py-3">
                {mySheets.length === 0 ? 'Toutes tes grilles sont déjà dans ce groupe.' : 'Aucun résultat.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filteredMySheets.map(sheet => (
                  <div
                    key={sheet.id}
                    className="flex items-center justify-between px-3 py-2.5 bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--ink)] truncate">{sheet.title}</div>
                      <div className="text-xs text-[var(--ink-faint)] truncate">{sheet.artist}</div>
                    </div>
                    <button
                      onClick={() => handleAttach(sheet)}
                      disabled={attachLoading === sheet.id}
                      className="shrink-0 ml-3 text-xs px-3 py-1 bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {attachLoading === sheet.id ? '…' : 'Rattacher'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {sheets.length === 0 ? (
          <p className="text-sm text-[var(--ink-faint)] py-4 text-center">
            Aucune grille pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-2">
            {sheets.map(sheet => (
              <div
                key={sheet.id}
                className="flex items-center justify-between px-4 py-3 bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg"
              >
                <Link href={`/sheet/${sheet.id}`} className="flex-1 min-w-0 hover:opacity-75 transition-opacity">
                  <div className="text-sm font-medium text-[var(--ink)] truncate">{sheet.title}</div>
                  <div className="text-xs text-[var(--ink-faint)] truncate">{sheet.artist}</div>
                </Link>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {sheet.key && (
                    <span className="text-xs text-[var(--ink-faint)] bg-[var(--paper)] border border-[var(--line)] px-2 py-0.5 rounded-full">
                      {sheet.key}
                    </span>
                  )}
                  {(isLeader || sheet.ownerId === user?.id) && (
                    <button
                      onClick={() => handleDetach(sheet)}
                      className="text-xs text-[var(--ink-faint)] hover:text-red-500 transition-colors"
                    >
                      Retirer
                    </button>
                  )}
                </div>
              </div>
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
