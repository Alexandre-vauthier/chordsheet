'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, getDb } from './firebase';
import { useAuth } from './auth-context';
import { useRouter } from '@/i18n/navigation';
import type { LiveSession, NewLiveSession } from '@/types';

const STORAGE_KEY = 'chordsheet:liveSessionCode';
const NICKNAME_KEY = 'chordsheet:liveSessionNickname';
// Charset sans caractères ambigus (0/O, 1/I) pour la saisie manuelle du code
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function sessionFromDoc(id: string, data: Record<string, unknown>): LiveSession {
  return {
    id,
    hostId: (data.hostId as string) || '',
    hostName: (data.hostName as string) || '',
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() || new Date(),
    expiresAt: (data.expiresAt as { toDate: () => Date })?.toDate?.() || new Date(),
    currentSheetId: (data.currentSheetId as string) || null,
    currentSheetTitle: (data.currentSheetTitle as string) || null,
    currentSheetArtist: (data.currentSheetArtist as string) || null,
    pushedBy: (data.pushedBy as string) || null,
    pushedByName: (data.pushedByName as string) || null,
    updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() || new Date(),
  };
}

type SessionStatus = 'idle' | 'loading' | 'found' | 'not-found';

interface LiveSessionContextType {
  sessionCode: string | null;
  session: LiveSession | null;
  sessionStatus: SessionStatus;
  isHost: boolean;
  loading: boolean;
  nickname: string;
  setNickname: (name: string) => void;
  startSession: () => Promise<string>;
  joinSession: (code: string, nickname?: string) => Promise<void>;
  pushSheet: (sheet: { id: string; title: string; artist: string }) => Promise<void>;
  endSession: () => Promise<void>;
  leaveSession: () => void;
}

const LiveSessionContext = createContext<LiveSessionContextType | undefined>(undefined);

export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const { user, firebaseUser } = useAuth();
  const router = useRouter();
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [nickname, setNicknameState] = useState('');
  // Identifie le dernier push déjà traité (évite de re-naviguer si l'utilisateur
  // quitte la grille poussée manuellement ensuite, ou à chaque re-render)
  const lastProcessedPushRef = useRef<number | null>(null);

  // Charger le code + le prénom depuis le stockage local au montage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSessionCode(stored);
    const storedNickname = sessionStorage.getItem(NICKNAME_KEY);
    if (storedNickname) setNicknameState(storedNickname);
  }, []);

  const setNickname = useCallback((name: string) => {
    setNicknameState(name);
    if (typeof window === 'undefined') return;
    if (name.trim()) sessionStorage.setItem(NICKNAME_KEY, name.trim());
    else sessionStorage.removeItem(NICKNAME_KEY);
  }, []);

  // Souscription live au document de session
  useEffect(() => {
    if (!sessionCode) { setSession(null); setSessionStatus('idle'); return; }
    setSessionStatus('loading');
    const db = getDb();
    const unsub = onSnapshot(doc(db, 'liveSessions', sessionCode), (snap) => {
      if (!snap.exists()) {
        setSession(null);
        setSessionStatus('not-found');
        return;
      }
      const data = sessionFromDoc(snap.id, snap.data() as Record<string, unknown>);
      if (data.expiresAt.getTime() < Date.now()) {
        setSession(null);
        setSessionStatus('not-found');
        return;
      }
      setSession(data);
      setSessionStatus('found');
    }, () => {
      setSession(null);
      setSessionStatus('not-found');
    });
    return unsub;
  }, [sessionCode]);

  // Auto-navigation : bascule sur la grille poussée par un autre participant.
  // Ne réagit qu'aux NOUVEAUX push (clé = updatedAt) — ne force pas la navigation
  // si l'utilisateur a ensuite quitté volontairement la grille poussée.
  useEffect(() => {
    if (!session?.currentSheetId || !firebaseUser) return;
    const pushTimestamp = session.updatedAt.getTime();
    if (lastProcessedPushRef.current === pushTimestamp) return;
    lastProcessedPushRef.current = pushTimestamp;
    if (session.pushedBy === firebaseUser.uid) return; // pas d'écho sur soi-même
    router.push(`/sheet/${session.currentSheetId}`);
  }, [session?.currentSheetId, session?.updatedAt, session?.pushedBy, firebaseUser, router]);

  const persistCode = useCallback((code: string | null) => {
    setSessionCode(code);
    if (!code) setSessionStatus('idle');
    if (typeof window === 'undefined') return;
    if (code) localStorage.setItem(STORAGE_KEY, code);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const startSession = useCallback(async (): Promise<string> => {
    if (!user) throw new Error('Non connecté');
    setLoading(true);
    try {
      const db = getDb();
      let code = generateCode();
      // Retry en cas de collision (improbable avec un charset de 32 caractères sur 6 positions)
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await getDoc(doc(db, 'liveSessions', code));
        if (!existing.exists()) break;
        code = generateCode();
      }
      const newSession: NewLiveSession = {
        hostId: user.id,
        hostName: user.displayName,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        currentSheetId: null,
        currentSheetTitle: null,
        currentSheetArtist: null,
        pushedBy: null,
        pushedByName: null,
        updatedAt: new Date(),
      };
      await setDoc(doc(db, 'liveSessions', code), {
        ...newSession,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      persistCode(code);
      return code;
    } finally {
      setLoading(false);
    }
  }, [user, persistCode]);

  const joinSession = useCallback(async (code: string, joinNickname?: string) => {
    if (!firebaseUser) {
      await signInAnonymously(getAuth());
    }
    if (joinNickname) {
      setNickname(joinNickname);
    }
    persistCode(code.toUpperCase());
  }, [firebaseUser, persistCode, setNickname]);

  const pushSheet = useCallback(async (sheet: { id: string; title: string; artist: string }) => {
    if (!sessionCode || !firebaseUser) return;
    const db = getDb();
    const pushedByName = user?.displayName || nickname || 'Invité';
    await updateDoc(doc(db, 'liveSessions', sessionCode), {
      currentSheetId: sheet.id,
      currentSheetTitle: sheet.title,
      currentSheetArtist: sheet.artist,
      pushedBy: firebaseUser.uid,
      pushedByName,
      updatedAt: serverTimestamp(),
    });
  }, [sessionCode, firebaseUser, user, nickname]);

  const endSession = useCallback(async () => {
    if (!sessionCode) return;
    const db = getDb();
    await deleteDoc(doc(db, 'liveSessions', sessionCode));
    persistCode(null);
  }, [sessionCode, persistCode]);

  const leaveSession = useCallback(() => {
    persistCode(null);
  }, [persistCode]);

  const isHost = !!session && !!user && session.hostId === user.id;

  return (
    <LiveSessionContext.Provider value={{ sessionCode, session, sessionStatus, isHost, loading, nickname, setNickname, startSession, joinSession, pushSheet, endSession, leaveSession }}>
      {children}
    </LiveSessionContext.Provider>
  );
}

export function useLiveSession() {
  const context = useContext(LiveSessionContext);
  if (context === undefined) {
    throw new Error('useLiveSession must be used within a LiveSessionProvider');
  }
  return context;
}
