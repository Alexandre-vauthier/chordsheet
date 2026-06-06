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
} from 'firebase/firestore';
import { getDb } from './firebase';
import { useAuth } from './auth-context';
import type { Group, GroupInvite, GroupRole, NewGroup } from '@/types';

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
      description: description?.trim() || undefined,
      ownerId: user.id,
      memberIds: [user.id],
      roles: { [user.id]: 'leader' },
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

  const joinGroup = useCallback(async (token: string): Promise<Group> => {
    if (!user) throw new Error('Non connecté');
    const db = getDb();

    const inviteRef = doc(db, 'groupInvites', token);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) throw new Error('Lien invalide ou expiré');

    const invite = inviteSnap.data() as Record<string, unknown>;
    const expiresAt = (invite.expiresAt as { toDate: () => Date }).toDate();
    if (expiresAt < new Date()) throw new Error('Lien expiré');
    if (invite.maxUses !== null && (invite.useCount as number) >= (invite.maxUses as number)) {
      throw new Error('Lien épuisé');
    }

    const groupRef = doc(db, 'groups', invite.groupId as string);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) throw new Error('Groupe introuvable');

    const groupData = groupSnap.data() as Record<string, unknown>;
    if ((groupData.memberIds as string[]).includes(user.id)) {
      return groupFromDoc(groupSnap.id, groupData);
    }

    await updateDoc(groupRef, {
      memberIds: arrayUnion(user.id),
      [`roles.${user.id}`]: 'member' as GroupRole,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(inviteRef, { useCount: (invite.useCount as number) + 1 });

    return groupFromDoc(groupSnap.id, {
      ...groupData,
      memberIds: [...(groupData.memberIds as string[]), user.id],
      roles: { ...(groupData.roles as Record<string, GroupRole>), [user.id]: 'member' },
    });
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

  return { groups, loading, createGroup, generateInviteToken, joinGroup, leaveGroup, removeMember, deleteGroup };
}
