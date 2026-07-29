'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from './firebase';
import { useAuth } from './auth-context';

// Message d'un fil de commentaires privé. Un « fil » = tous les messages partageant
// le même (sheetId, commenterId) : une conversation privée entre l'auteur de la
// grille (ownerId) et une personne qui commente (commenterId). Personne d'autre n'y
// a accès (voir les règles Firestore de la collection sheetComments).
export interface SheetCommentMessage {
  id: string;
  sheetId: string;
  ownerId: string;
  commenterId: string;
  commenterName: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Date | null;
}

export interface CommentThread {
  commenterId: string;
  commenterName: string;
  messages: SheetCommentMessage[];
}

export interface UseSheetCommentsResult {
  isOwner: boolean;
  threads: CommentThread[];
  loading: boolean;
  send: (text: string, targetCommenterId?: string, targetCommenterName?: string) => Promise<void>;
  canComment: boolean;
  // L'utilisateur courant a-t-il déjà posté au moins un message sur cette grille ?
  hasCommented: boolean;
}

export function useSheetComments(sheetId: string | undefined, ownerId: string | undefined, sheetTitle?: string): UseSheetCommentsResult {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SheetCommentMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwner = !!user && !!ownerId && user.id === ownerId;

  useEffect(() => {
    if (!sheetId || !ownerId || !user) { setMessages([]); setLoading(false); return; }
    const db = getDb();
    // Auteur : tous les fils de sa grille. Commentateur : uniquement le sien.
    const q = isOwner
      ? query(collection(db, 'sheetComments'), where('sheetId', '==', sheetId), where('ownerId', '==', user.id))
      : query(collection(db, 'sheetComments'), where('sheetId', '==', sheetId), where('commenterId', '==', user.id));
    setLoading(true);
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          sheetId: data.sheetId as string,
          ownerId: data.ownerId as string,
          commenterId: data.commenterId as string,
          commenterName: (data.commenterName as string) || 'Utilisateur',
          senderId: data.senderId as string,
          senderName: (data.senderName as string) || '',
          text: (data.text as string) || '',
          createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? null,
        } as SheetCommentMessage;
      });
      msgs.sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
      setMessages(msgs);
      setLoading(false);
    }, () => { setMessages([]); setLoading(false); });
    return unsub;
  }, [sheetId, ownerId, user, isOwner]);

  const send = useCallback(async (text: string, targetCommenterId?: string, targetCommenterName?: string) => {
    if (!user || !sheetId || !ownerId || !text.trim()) return;
    // Commentateur → son propre fil. Auteur → répond dans le fil ciblé.
    const commenterId = isOwner ? targetCommenterId : user.id;
    const commenterName = isOwner ? (targetCommenterName || 'Utilisateur') : (user.displayName || 'Utilisateur');
    if (!commenterId || commenterId === ownerId) return; // pas de fil avec soi-même
    const db = getDb();
    await addDoc(collection(db, 'sheetComments'), {
      sheetId,
      ownerId,
      commenterId,
      commenterName,
      senderId: user.id,
      senderName: user.displayName || 'Utilisateur',
      text: text.trim(),
      createdAt: serverTimestamp(),
    });
    // Notification pour le destinataire du message (l'auteur si c'est un visiteur qui
    // écrit ; le visiteur du fil si c'est l'auteur qui répond). Jamais pour soi-même.
    const recipientId = isOwner ? commenterId : ownerId;
    if (recipientId && recipientId !== user.id) {
      await addDoc(collection(db, 'notifications'), {
        userId: recipientId,
        fromId: user.id,
        fromName: user.displayName || 'Utilisateur',
        sheetId,
        sheetTitle: sheetTitle || '',
        createdAt: serverTimestamp(),
        read: false,
      }).catch(() => {});
    }
  }, [user, sheetId, ownerId, isOwner, sheetTitle]);

  const threads: CommentThread[] = useMemo(() => {
    const map = new Map<string, CommentThread>();
    for (const m of messages) {
      let th = map.get(m.commenterId);
      if (!th) { th = { commenterId: m.commenterId, commenterName: m.commenterName, messages: [] }; map.set(m.commenterId, th); }
      th.messages.push(m);
      // Nom du commentateur = celui porté par SES propres messages (le plus fiable).
      if (m.senderId === m.commenterId && m.commenterName) th.commenterName = m.commenterName;
    }
    // Fils les plus récemment actifs en premier.
    return Array.from(map.values()).sort((a, b) => {
      const la = a.messages[a.messages.length - 1]?.createdAt?.getTime() ?? 0;
      const lb = b.messages[b.messages.length - 1]?.createdAt?.getTime() ?? 0;
      return lb - la;
    });
  }, [messages]);

  const hasCommented = !!user && messages.some((m) => m.senderId === user.id);

  return { isOwner, threads, loading, send, canComment: !!user, hasCommented };
}
