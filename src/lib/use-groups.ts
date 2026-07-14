'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import { getDb, getAuth } from './firebase';
import { useAuth } from './auth-context';
import type { ActiveConcert, Group, GroupInvite, GroupRole, NewGroup } from '@/types';

function groupFromDoc(id: string, data: Record<string, unknown>): Group {
  const ac = data.activeConcert as Record<string, string> | undefined;
  return {
    id,
    name: (data.name as string) || '',
    description: (data.description as string) || undefined,
    ownerId: (data.ownerId as string) || '',
    memberIds: (data.memberIds as string[]) || [],
    roles: (data.roles as Record<string, GroupRole>) || {},
    linkedSheetIds: (data.linkedSheetIds as string[]) || [],
    activeConcert: ac ? { setId: ac.setId, setName: ac.setName, startedBy: ac.startedBy, startedByName: ac.startedByName } : undefined,
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() || new Date(),
    updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() || new Date(),
  };
}

export function useGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const db = getDb();
    const q = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.id)
    );

    const unsub = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map(d => groupFromDoc(d.id, d.data() as Record<string, unknown>)));
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return unsub;
  }, [user]);

  const createGroup = useCallback(async (name: string, description?: string): Promise<string> => {
    if (!user) throw new Error('Non connecté');
    const db = getDb();
    const newGroup: NewGroup = {
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: user.id,
      memberIds: [user.id],
      roles: { [user.id]: 'leader' },
      linkedSheetIds: [],
    };
    const ref = await addDoc(collection(db, 'groups'), {
      ...newGroup,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, [user]);

  // Génère un token d'invitation (document ID = token)
  const generateInviteToken = useCallback(async (groupId: string, groupName: string): Promise<string> => {
    if (!user) throw new Error('Non connecté');
    const db = getDb();
    const token = crypto.randomUUID().replace(/-/g, '');
    const invite: Omit<GroupInvite, 'id'> = {
      groupId,
      groupName,
      createdBy: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxUses: null,
      useCount: 0,
    };
    await setDoc(doc(db, 'groupInvites', token), {
      ...invite,
      expiresAt: invite.expiresAt,
    });
    return token;
  }, [user]);

  // Rejoindre un groupe via un token d'invitation - passe par une route serveur qui
  // valide l'invitation (existence, expiration, quota d'usages) avec des credentials admin,
  // pour éviter qu'un client puisse rejoindre un groupe sans invitation valide.
  const joinGroup = useCallback(async (token: string): Promise<string> => {
    if (!user) throw new Error('Non connecté');
    const idToken = await getAuth().currentUser?.getIdToken();
    if (!idToken) throw new Error('Non connecté');

    const res = await fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la tentative de rejoindre le groupe.');
    return data.groupId as string;
  }, [user]);

  const leaveGroup = useCallback(async (groupId: string) => {
    if (!user) throw new Error('Non connecté');
    const db = getDb();
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) return;
    const data = groupSnap.data() as Record<string, unknown>;
    if (data.ownerId === user.id) throw new Error('Le créateur ne peut pas quitter le groupe');

    const newRoles = { ...(data.roles as Record<string, GroupRole>) };
    delete newRoles[user.id];
    await updateDoc(groupRef, {
      memberIds: arrayRemove(user.id),
      roles: newRoles,
      updatedAt: serverTimestamp(),
    });
  }, [user]);

  const removeMember = useCallback(async (groupId: string, memberId: string) => {
    if (!user) throw new Error('Non connecté');
    const db = getDb();
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) return;
    const data = groupSnap.data() as Record<string, unknown>;
    if ((data.roles as Record<string, GroupRole>)[user.id] !== 'leader') throw new Error('Accès refusé');

    const newRoles = { ...(data.roles as Record<string, GroupRole>) };
    delete newRoles[memberId];
    await updateDoc(groupRef, {
      memberIds: arrayRemove(memberId),
      roles: newRoles,
      updatedAt: serverTimestamp(),
    });
  }, [user]);

  const deleteGroup = useCallback(async (groupId: string) => {
    if (!user) throw new Error('Non connecté');
    const db = getDb();
    await deleteDoc(doc(db, 'groups', groupId));
  }, [user]);

  const linkSheet = useCallback(async (groupId: string, sheetId: string) => {
    if (!user) throw new Error('Non connecté');
    const db = getDb();
    await Promise.all([
      updateDoc(doc(db, 'groups', groupId), {
        linkedSheetIds: arrayUnion(sheetId),
        updatedAt: serverTimestamp(),
      }),
      // Écrire groupId sur la grille pour que les membres puissent la lire (règle Firestore)
      updateDoc(doc(db, 'sheets', sheetId), { groupId }),
    ]);
  }, [user]);

  const unlinkSheet = useCallback(async (groupId: string, sheetId: string) => {
    if (!user) throw new Error('Non connecté');
    const db = getDb();
    const sheetSnap = await getDoc(doc(db, 'sheets', sheetId));
    const updates: Promise<void>[] = [
      updateDoc(doc(db, 'groups', groupId), {
        linkedSheetIds: arrayRemove(sheetId),
        updatedAt: serverTimestamp(),
      }),
    ];
    // Retirer groupId de la grille seulement si c'est bien ce groupe
    if (sheetSnap.exists() && sheetSnap.data().groupId === groupId) {
      updates.push(updateDoc(doc(db, 'sheets', sheetId), { groupId: null }));
    }
    await Promise.all(updates);
  }, [user]);

  const launchConcert = useCallback(async (groupId: string, setId: string, setName: string) => {
    if (!user) throw new Error('Non connecté');
    const db = getDb();
    const concert: ActiveConcert = { setId, setName, startedBy: user.id, startedByName: user.displayName };
    await updateDoc(doc(db, 'groups', groupId), {
      activeConcert: concert,
      updatedAt: serverTimestamp(),
    });
  }, [user]);

  const endConcert = useCallback(async (groupId: string) => {
    if (!user) throw new Error('Non connecté');
    const db = getDb();
    await updateDoc(doc(db, 'groups', groupId), {
      activeConcert: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }, [user]);

  return { groups, loading, createGroup, generateInviteToken, joinGroup, leaveGroup, removeMember, deleteGroup, linkSheet, unlinkSheet, launchConcert, endConcert };
}
