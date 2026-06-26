'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import type { Sheet } from '@/types';

export default function PendingPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) { router.replace('/dashboard'); return; }

    async function load() {
      try {
        const db = getDb();
        const snap = await getDocs(
          query(
            collection(db, 'sheets'),
            where('pendingValidation', '==', true),
            orderBy('updatedAt', 'desc')
          )
        );
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sheet));
        setSheets(data);
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [user, isAdmin, loading, router]);

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[var(--ink)]">À valider</h1>
          <p className="text-[var(--ink-faint)] text-sm mt-0.5">{sheets.length} grille{sheets.length !== 1 ? 's' : ''} en attente</p>
        </div>
      </div>

      {sheets.length === 0 ? (
        <div className="text-center py-20 text-[var(--ink-faint)]">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Aucune grille à valider.
        </div>
      ) : (
        <div className="space-y-2">
          {sheets.map(sheet => (
            <div key={sheet.id} className="flex items-center gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 hover:bg-amber-500/8 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--ink)] truncate">{sheet.title || '—'}</p>
                <p className="text-sm text-[var(--ink-faint)] truncate">{sheet.artist || '—'} · par {sheet.ownerName || '—'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/sheet/${sheet.id}`}
                  className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  Consulter
                </Link>
                <Link
                  href={`/sheet/${sheet.id}/edit`}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-400 transition-colors"
                >
                  Éditer
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
