'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { Sheet } from '@/types';
import { AddToCollectionModal } from '@/components/sheet/add-to-collection-modal';

type Tab = 'set' | 'group';

interface AddToCollectionContextValue {
  openAddTo: (sheet: Sheet, tab?: Tab) => void;
}

const AddToCollectionContext = createContext<AddToCollectionContextValue | null>(null);

export function useAddToCollection() {
  const ctx = useContext(AddToCollectionContext);
  if (!ctx) throw new Error('useAddToCollection must be used within AddToCollectionProvider');
  return ctx;
}

export function AddToCollectionProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<Sheet | null>(null);
  const [tab, setTab] = useState<Tab>('set');

  const openAddTo = useCallback((sheet: Sheet, initialTab: Tab = 'set') => {
    setTab(initialTab);
    setTarget(sheet);
  }, []);

  const close = useCallback(() => setTarget(null), []);

  return (
    <AddToCollectionContext.Provider value={{ openAddTo }}>
      {children}
      {/* La modale (et ses abonnements Firestore sets/groupes) n'existe que
          pendant qu'elle est ouverte : aucun listener tant qu'on ne clique pas. */}
      {target && (
        <AddToCollectionModal sheet={target} initialTab={tab} onClose={close} />
      )}
    </AddToCollectionContext.Provider>
  );
}
