'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { getDb } from './firebase';
import { useAuth } from './auth-context';

export interface AppNotification {
  id: string;
  fromName: string;
  sheetId: string;
  sheetTitle: string;
  kind: 'comment' | 'rating' | 'unknownChord';
  rating?: number;
  /** Accords concernés, pour `unknownChord`. */
  chords?: string[];
  /**
   * Destination du clic, quand elle ne se déduit pas de `sheetId`.
   *
   * Une notification d'administration mène à un écran d'administration, pas à la
   * grille : c'est le tableau qu'on veut ouvrir, pas le morceau où l'accord a été
   * repéré. Le chemin est porté par la notification plutôt que déduit de son type,
   * pour ne pas avoir à toucher la cloche à chaque nouvelle destination.
   */
  link?: string;
  createdAt: Date | null;
  read: boolean;
}

// Notifications in-app de l'utilisateur (commentaires reçus sur ses grilles /
// réponses reçues sur ses fils). Tri côté client pour éviter un index composite.
export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    const db = getDb();
    const q = query(collection(db, 'notifications'), where('userId', '==', user.id));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          fromName: (data.fromName as string) || 'Quelqu’un',
          sheetId: (data.sheetId as string) || '',
          sheetTitle: (data.sheetTitle as string) || '',
          kind: (data.kind as AppNotification['kind']) || 'comment',
          rating: typeof data.rating === 'number' ? data.rating : undefined,
          chords: Array.isArray(data.chords) ? (data.chords as string[]) : undefined,
          link: typeof data.link === 'string' ? data.link : undefined,
          createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? null,
          read: !!data.read,
        } as AppNotification;
      });
      list.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      setItems(list.slice(0, 30));
    }, () => setItems([]));
    return unsub;
  }, [user]);

  const unreadCount = items.filter((n) => !n.read).length;

  const markRead = useCallback(async (id: string) => {
    const db = getDb();
    await updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const db = getDb();
    const unread = items.filter((n) => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    for (const n of unread) batch.update(doc(db, 'notifications', n.id), { read: true });
    await batch.commit().catch(() => {});
  }, [user, items]);

  return { items, unreadCount, markRead, markAllRead };
}
