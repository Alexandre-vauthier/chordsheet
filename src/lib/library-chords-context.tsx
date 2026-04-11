'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  collection, getDocs, setDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { getDb } from './firebase';
import type { StringChord, PianoChord, InstrumentId } from '@/types';

export interface LibraryChord {
  docId: string;
  instrumentId: InstrumentId;
  chord: StringChord | PianoChord;
  /** true = remplace un accord statique existant, false = ajout pur */
  isOverride: boolean;
  createdBy: string;
}

/** Clé de lookup identique au format customChords des grilles */
export function libraryKey(name: string, instrumentId: InstrumentId): string {
  return `${name.trim().toLowerCase()}-${instrumentId}`;
}

interface LibraryChordsCtx {
  /** Map clé → LibraryChord pour les overrides */
  overrides: Map<string, LibraryChord>;
  /** Accords ajoutés (non présents dans la lib statique) */
  additions: LibraryChord[];
  loading: boolean;
  reload: () => Promise<void>;
  saveLibraryChord: (
    chord: StringChord | PianoChord,
    instrumentId: InstrumentId,
    isOverride: boolean,
    createdBy: string,
  ) => Promise<void>;
  deleteLibraryChord: (docId: string) => Promise<void>;
}

const Ctx = createContext<LibraryChordsCtx | undefined>(undefined);

export function LibraryChordsProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Map<string, LibraryChord>>(new Map());
  const [additions, setAdditions] = useState<LibraryChord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const db = getDb();
      const snap = await getDocs(collection(db, 'library_chords'));
      const newOverrides = new Map<string, LibraryChord>();
      const newAdditions: LibraryChord[] = [];

      snap.docs.forEach((d) => {
        const data = d.data() as Omit<LibraryChord, 'docId'>;
        const entry: LibraryChord = { ...data, docId: d.id };
        if (entry.isOverride) {
          newOverrides.set(libraryKey(entry.chord.name, entry.instrumentId), entry);
        } else {
          newAdditions.push(entry);
        }
      });

      setOverrides(newOverrides);
      setAdditions(newAdditions);
    } catch (e) {
      console.error('Error loading library chords:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const saveLibraryChord = useCallback(async (
    chord: StringChord | PianoChord,
    instrumentId: InstrumentId,
    isOverride: boolean,
    createdBy: string,
  ) => {
    const db = getDb();
    const key = libraryKey(chord.name, instrumentId);
    // Pour les overrides, docId = clé pour dédupliquer ; pour les ajouts, timestamp
    const docId = isOverride ? key : `${key}-${Date.now()}`;
    await setDoc(doc(db, 'library_chords', docId), {
      instrumentId,
      chord,
      isOverride,
      createdBy,
      updatedAt: serverTimestamp(),
    });
    await reload();
  }, [reload]);

  const deleteLibraryChord = useCallback(async (docId: string) => {
    const db = getDb();
    await deleteDoc(doc(db, 'library_chords', docId));
    await reload();
  }, [reload]);

  return (
    <Ctx.Provider value={{ overrides, additions, loading, reload, saveLibraryChord, deleteLibraryChord }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLibraryChords() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLibraryChords must be used within LibraryChordsProvider');
  return ctx;
}
