'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, deleteField, serverTimestamp, limit,
  addDoc, deleteDoc,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useAuth } from '@/lib/auth-context';
import { useGroups } from '@/lib/use-groups';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import type { Group, GroupRole, Sheet, Set, InstrumentId } from '@/types';

interface MemberInfo {
  id: string;
  displayName: string;
  email: string;
  role: GroupRole;
  preferredInstrument?: InstrumentId;
}

function groupFromDoc(id: string, data: Record<string, unknown>): Group {
  return {
    id,
    name: (data.name as string) || '',
    description: (data.description as string) || undefined,
    ownerId: (data.ownerId as string) || '',
    memberIds: (data.memberIds as string[]) || [],
    roles: (data.roles as Record<string, GroupRole>) || {},
    linkedSheetIds: (data.linkedSheetIds as string[]) || [],
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() || new Date(),
    updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() || new Date(),
  };
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const { user } = useAuth();
  const { generateInviteToken, leaveGroup, removeMember, deleteGroup, linkSheet, unlinkSheet } = useGroups();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [ownedSheets, setOwnedSheets] = useState<Sheet[]>([]);
  const [linkedSheets, setLinkedSheets] = useState<Sheet[]>([]);
  const [groupSets, setGroupSets] = useState<Set[]>([]);
  const [loading, setLoading] = useState(true);

  // Création de set
  const [newSetName, setNewSetName] = useState('');
  const [isCreatingSet, setIsCreatingSet] = useState(false);

  // Invitation
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Panneau de rattachement
  const [showAttach, setShowAttach] = useState(false);
  const [attachSearch, setAttachSearch] = useState('');
  const [attachPool, setAttachPool] = useState<Sheet[]>([]);
  const [attachListLoading, setAttachListLoading] = useState(false);
  const [attachLoading, setAttachLoading] = useState<string | null>(null);

  const [actionError, setActionError] = useState('');

  const isLeader = user && group ? group.roles[user.id] === 'leader' : false;
  const isOwner = user && group ? group.ownerId === user.id : false;
  const isMember = user && group ? group.memberIds.includes(user.id) : false;

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
            preferredInstrument: (data?.preferredInstrument as InstrumentId) || undefined,
          };
        })
      );
      setMembers(memberProfiles);

      try {
        const s2 = await getDocs(query(collection(db, 'sheets'), where('groupId', '==', snap.id), orderBy('updatedAt', 'desc')));
        setOwnedSheets(s2.docs.map(d => fromFirestore(d.id, d.data() as Record<string, unknown>)));
      } catch {
        const s2 = await getDocs(query(collection(db, 'sheets'), where('groupId', '==', snap.id)));
        setOwnedSheets(s2.docs.map(d => fromFirestore(d.id, d.data() as Record<string, unknown>)));
      }

      if (g.linkedSheetIds.length > 0) {
        const linked = await Promise.all(
          g.linkedSheetIds.map(async (sid) => {
            const s = await getDoc(doc(db, 'sheets', sid));
            return s.exists() ? fromFirestore(s.id, s.data() as Record<string, unknown>) : null;
          })
        );
        setLinkedSheets(linked.filter(Boolean) as Sheet[]);
      }

      // Sets du groupe
      try {
        const setsSnap = await getDocs(query(collection(db, 'sets'), where('groupId', '==', snap.id), orderBy('updatedAt', 'desc')));
        setGroupSets(setsSnap.docs.map(d => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name: (data.name as string) || '',
            description: (data.description as string) || undefined,
            ownerId: (data.ownerId as string) || '',
            ownerName: (data.ownerName as string) || '',
            sheetIds: (data.sheetIds as string[]) || [],
            isPublic: (data.isPublic as boolean) || false,
            groupId: snap.id,
            createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() || new Date(),
            updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() || new Date(),
          } as Set;
        }));
      } catch {
        const setsSnap = await getDocs(query(collection(db, 'sets'), where('groupId', '==', snap.id)));
        setGroupSets(setsSnap.docs.map(d => {
          const data = d.data() as Record<string, unknown>;
          return { id: d.id, name: (data.name as string) || '', description: undefined, ownerId: (data.ownerId as string) || '', ownerName: (data.ownerName as string) || '', sheetIds: (data.sheetIds as string[]) || [], isPublic: false, groupId: snap.id, createdAt: new Date(), updatedAt: new Date() } as Set;
        }));
      }

      setLoading(false);
    });
  }, [groupId]);

  // Charge toutes les grilles disponibles : mes grilles + grilles publiques, fusionnées et dédupliquées
  const loadAttachPool = async () => {
    if (!user) return;
    setAttachListLoading(true);
    const db = getDb();
    const excludeIds = new Set([
      ...ownedSheets.map(s => s.id!),
      ...(group?.linkedSheetIds ?? []),
    ]);

    try {
      const [mineSnap, publicSnap] = await Promise.all([
        getDocs(query(collection(db, 'sheets'), where('ownerId', '==', user.id), orderBy('updatedAt', 'desc'))).catch(() =>
          getDocs(query(collection(db, 'sheets'), where('ownerId', '==', user.id)))
        ),
        getDocs(query(collection(db, 'sheets'), where('isPublic', '==', true), orderBy('updatedAt', 'desc'), limit(300))).catch(() =>
          getDocs(query(collection(db, 'sheets'), where('isPublic', '==', true), limit(300)))
        ),
      ]);

      const seen = new Set<string>();
      const merged: Sheet[] = [];
      for (const snap of [mineSnap, publicSnap]) {
        for (const d of snap.docs) {
          if (!seen.has(d.id) && !excludeIds.has(d.id)) {
            seen.add(d.id);
            merged.push(fromFirestore(d.id, d.data() as Record<string, unknown>));
          }
        }
      }
      setAttachPool(merged);
    } finally {
      setAttachListLoading(false);
    }
  };

  const handleOpenAttach = () => {
    setShowAttach(true);
    setAttachSearch('');
    loadAttachPool();
  };

  // Rattacher : groupId si c'est ma grille, linkedSheetIds sinon
  const handleAttach = async (sheet: Sheet) => {
    if (!sheet.id) return;
    setAttachLoading(sheet.id);
    try {
      if (sheet.ownerId === user?.id) {
        const db = getDb();
        await updateDoc(doc(db, 'sheets', sheet.id), { groupId, updatedAt: serverTimestamp() });
        setOwnedSheets(prev => [{ ...sheet, groupId }, ...prev]);
      } else {
        await linkSheet(groupId, sheet.id);
        setLinkedSheets(prev => [sheet, ...prev]);
        setGroup(prev => prev ? { ...prev, linkedSheetIds: [...prev.linkedSheetIds, sheet.id!] } : prev);
      }
      setAttachPool(prev => prev.filter(s => s.id !== sheet.id));
    } catch {
      setActionError('Erreur lors du rattachement.');
    } finally {
      setAttachLoading(null);
    }
  };

  const handleDetachOwned = async (sheet: Sheet) => {
    if (!sheet.id || !confirm(`Retirer "${sheet.title}" du groupe ?`)) return;
    try {
      const db = getDb();
      await updateDoc(doc(db, 'sheets', sheet.id), { groupId: deleteField(), updatedAt: serverTimestamp() });
      setOwnedSheets(prev => prev.filter(s => s.id !== sheet.id));
    } catch {
      setActionError('Erreur lors du retrait.');
    }
  };

  const handleUnlink = async (sheet: Sheet) => {
    if (!sheet.id || !confirm(`Retirer "${sheet.title}" de la liste du groupe ?`)) return;
    try {
      await unlinkSheet(groupId, sheet.id);
      setLinkedSheets(prev => prev.filter(s => s.id !== sheet.id));
      setGroup(prev => prev ? { ...prev, linkedSheetIds: prev.linkedSheetIds.filter(id => id !== sheet.id) } : prev);
    } catch {
      setActionError('Erreur lors du retrait.');
    }
  };

  const handleCreateSet = async () => {
    if (!user || !newSetName.trim()) return;
    setIsCreatingSet(true);
    try {
      const db = getDb();
      const ref = await addDoc(collection(db, 'sets'), {
        name: newSetName.trim(),
        description: '',
        ownerId: user.id,
        ownerName: user.displayName,
        sheetIds: [],
        isPublic: false,
        groupId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setGroupSets(prev => [{ id: ref.id, name: newSetName.trim(), description: undefined, ownerId: user.id, ownerName: user.displayName, sheetIds: [], isPublic: false, groupId, createdAt: new Date(), updatedAt: new Date() }, ...prev]);
      setNewSetName('');
    } catch {
      setActionError('Erreur lors de la création du set.');
    } finally {
      setIsCreatingSet(false);
    }
  };

  const handleDeleteSet = async (setId: string, setName: string) => {
    if (!confirm(`Supprimer le set "${setName}" ?`)) return;
    try {
      const db = getDb();
      await deleteDoc(doc(db, 'sets', setId));
      setGroupSets(prev => prev.filter(s => s.id !== setId));
    } catch {
      setActionError('Erreur lors de la suppression du set.');
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
    try { await leaveGroup(groupId); router.push('/groups'); }
    catch (e) { setActionError((e as Error).message); }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Retirer ${memberName} du groupe ?`)) return;
    try {
      await removeMember(groupId, memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (e) { setActionError((e as Error).message); }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer le groupe "${group?.name}" ? Cette action est irréversible.`)) return;
    try { await deleteGroup(groupId); router.push('/groups'); }
    catch { setActionError('Erreur lors de la suppression.'); }
  };

  const filteredPool = attachSearch
    ? attachPool.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(attachSearch.toLowerCase()))
    : attachPool;

  const linkedIds = new Set(linkedSheets.map(s => s.id));
  const allSheets = [
    ...ownedSheets.filter(s => !linkedIds.has(s.id)).map(s => ({ sheet: s, type: 'owned' as const })),
    ...linkedSheets.map(s => ({ sheet: s, type: 'linked' as const })),
  ];

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
      <div>
        <Link href="/groups" className="text-sm text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors">
          ← Mes groupes
        </Link>
        <div className="mt-2">
          <h1 className="font-playfair text-2xl font-bold text-[var(--ink)]">{group.name}</h1>
          {group.description && <p className="text-[var(--ink-light)] mt-1">{group.description}</p>}
        </div>
      </div>

      {actionError && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{actionError}</p>
      )}

      {/* Sets */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--ink-light)] uppercase tracking-wide mb-3">
          Sets ({groupSets.length})
        </h2>

        {isMember && (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newSetName}
              onChange={e => setNewSetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateSet()}
              placeholder="Nom du set (ex: Concert du 15 juin)…"
              className="flex-1 px-3 py-2 text-sm border border-[var(--line)] rounded-lg bg-[var(--cell-bg)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button
              onClick={handleCreateSet}
              disabled={!newSetName.trim() || isCreatingSet}
              className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors disabled:opacity-50">
              {isCreatingSet ? '…' : '+ Créer'}
            </button>
          </div>
        )}

        {groupSets.length === 0 ? (
          <p className="text-sm text-[var(--ink-faint)] py-3 text-center">Aucun set pour l&apos;instant.</p>
        ) : (
          <div className="space-y-2">
            {groupSets.map(set => (
              <div key={set.id} className="flex items-center justify-between px-4 py-3 bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg">
                <Link href={`/sets/${set.id}`} className="flex-1 min-w-0 hover:opacity-75 transition-opacity">
                  <div className="text-sm font-medium text-[var(--ink)] truncate">{set.name}</div>
                  <div className="text-xs text-[var(--ink-faint)]">
                    {set.sheetIds.length} grille{set.sheetIds.length !== 1 ? 's' : ''}
                    {set.isPublic && <span className="ml-2 text-green-600">· public</span>}
                  </div>
                </Link>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  {set.sheetIds.length > 0 && (
                    <Link href={`/sets/${set.id}/play`}
                      className="text-xs text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors">
                      Lancer
                    </Link>
                  )}
                  {(isLeader || set.ownerId === user?.id) && (
                    <button onClick={() => handleDeleteSet(set.id!, set.name)}
                      className="text-xs text-[var(--ink-faint)] hover:text-red-500 transition-colors">
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Grilles */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--ink-light)] uppercase tracking-wide">
            Grilles ({allSheets.length})
          </h2>
          <div className="flex gap-2">
            {isMember && (
              <button onClick={handleOpenAttach}
                className="text-xs px-3 py-1.5 border border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] rounded-lg transition-colors">
                Rattacher une grille
              </button>
            )}
            <Link href={`/sheet/new?groupId=${groupId}`}
              className="text-xs px-3 py-1.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors">
              + Nouvelle grille
            </Link>
          </div>
        </div>

        {/* Panneau de rattachement */}
        {showAttach && (
          <div className="mb-4 p-4 bg-[var(--paper)] border border-[var(--accent)]/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--ink)]">Rattacher une grille</p>
              <button onClick={() => setShowAttach(false)} className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-lg leading-none">×</button>
            </div>

            <input
              type="text"
              value={attachSearch}
              onChange={e => setAttachSearch(e.target.value)}
              placeholder="Rechercher par titre ou artiste…"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-[var(--line)] rounded-lg bg-[var(--cell-bg)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />

            {attachListLoading ? (
              <div className="text-sm text-[var(--ink-faint)] text-center py-3">Chargement…</div>
            ) : filteredPool.length === 0 ? (
              <p className="text-sm text-[var(--ink-faint)] text-center py-3">Aucun résultat.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filteredPool.map(sheet => (
                  <div key={sheet.id} className="flex items-center justify-between px-3 py-2.5 bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--ink)] truncate">{sheet.title}</div>
                      <div className="text-xs text-[var(--ink-faint)] truncate">
                        {sheet.artist}
                        {sheet.ownerId !== user?.id && (
                          <span className="ml-2 opacity-60">· par {sheet.ownerName}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAttach(sheet)}
                      disabled={attachLoading === sheet.id}
                      className="shrink-0 ml-3 text-xs px-3 py-1 bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors disabled:opacity-50">
                      {attachLoading === sheet.id ? '…' : 'Rattacher'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {allSheets.length === 0 ? (
          <p className="text-sm text-[var(--ink-faint)] py-4 text-center">Aucune grille pour l&apos;instant.</p>
        ) : (
          <div className="space-y-2">
            {allSheets.map(({ sheet, type }) => (
              <div key={sheet.id} className="flex items-center justify-between px-4 py-3 bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg">
                <Link href={`/sheet/${sheet.id}`} className="flex-1 min-w-0 hover:opacity-75 transition-opacity">
                  <div className="text-sm font-medium text-[var(--ink)] truncate">{sheet.title}</div>
                  <div className="text-xs text-[var(--ink-faint)] truncate">{sheet.artist}</div>
                </Link>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {type === 'linked' && (
                    <span className="text-xs text-[var(--ink-faint)] bg-[var(--paper)] border border-[var(--line)] px-2 py-0.5 rounded-full">
                      référence
                    </span>
                  )}
                  {sheet.key && (
                    <span className="text-xs text-[var(--ink-faint)] bg-[var(--paper)] border border-[var(--line)] px-2 py-0.5 rounded-full">
                      {sheet.key}
                    </span>
                  )}
                  {type === 'owned' && (isLeader || sheet.ownerId === user?.id) && (
                    <button onClick={() => handleDetachOwned(sheet)}
                      className="text-xs text-[var(--ink-faint)] hover:text-red-500 transition-colors">
                      Retirer
                    </button>
                  )}
                  {type === 'linked' && isMember && (
                    <button onClick={() => handleUnlink(sheet)}
                      className="text-xs text-[var(--ink-faint)] hover:text-red-500 transition-colors">
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Membres */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--ink-light)] uppercase tracking-wide mb-3">
          Membres ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map(member => (
            <div key={member.id} className="flex items-center justify-between px-4 py-3 bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold">
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--ink)]">{member.displayName}</div>
                  {member.preferredInstrument && (
                    <div className="text-xs text-[var(--ink-faint)]">
                      {INSTRUMENT_CONFIG[member.preferredInstrument]?.label ?? member.preferredInstrument}
                    </div>
                  )}
                </div>
              </div>
              {isLeader && member.id !== user?.id && (
                <button onClick={() => handleRemoveMember(member.id, member.displayName)}
                  className="text-xs text-[var(--ink-faint)] hover:text-red-500 transition-colors px-1.5 py-0.5 rounded">
                  Retirer
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Invitation — accessible à tous les membres */}
      {isMember && (
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
                <input readOnly value={inviteLink}
                  className="flex-1 px-3 py-2 text-sm border border-[var(--line)] rounded-lg bg-[var(--cell-bg)] text-[var(--ink)] focus:outline-none" />
                <button onClick={handleCopyInvite}
                  className="px-3 py-2 text-sm border border-[var(--line)] rounded-lg bg-[var(--cell-bg)] hover:border-[var(--accent)] transition-colors text-[var(--ink)]">
                  {inviteCopied ? '✓ Copié' : 'Copier'}
                </button>
              </div>
            ) : (
              <button onClick={handleGenerateInvite} disabled={inviteLoading}
                className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors disabled:opacity-50">
                {inviteLoading ? 'Génération…' : 'Générer un lien'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="border-t border-[var(--line)] pt-4 flex gap-3">
        {!isOwner && (
          <button onClick={handleLeave}
            className="px-4 py-2 text-sm border border-[var(--line)] text-[var(--ink-light)] rounded-lg hover:border-red-300 hover:text-red-500 transition-colors">
            Quitter le groupe
          </button>
        )}
        {isOwner && (
          <button onClick={handleDelete}
            className="px-4 py-2 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
            Supprimer le groupe
          </button>
        )}
      </section>
    </div>
  );
}
