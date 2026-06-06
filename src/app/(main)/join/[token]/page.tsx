'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { useGroups } from '@/lib/use-groups';

export default function JoinGroupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { joinGroup } = useGroups();

  const [groupName, setGroupName] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'joining' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) return;
    const db = getDb();
    getDoc(doc(db, 'groupInvites', token)).then((snap) => {
      if (!snap.exists()) { setStatus('invalid'); return; }
      const data = snap.data() as Record<string, unknown>;
      const expiresAt = (data.expiresAt as { toDate: () => Date }).toDate();
      if (expiresAt < new Date()) { setStatus('invalid'); return; }
      setGroupName(data.groupName as string);
      setStatus('ready');
    }).catch(() => setStatus('invalid'));
  }, [token]);

  const handleJoin = async () => {
    setStatus('joining');
    try {
      const group = await joinGroup(token);
      router.push(`/groups/${group.id}`);
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      {status === 'loading' && (
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent mx-auto" />
      )}

      {status === 'invalid' && (
        <div className="space-y-3">
          <div className="text-4xl">⚠️</div>
          <h1 className="font-playfair text-xl font-bold text-[var(--ink)]">Lien invalide ou expiré</h1>
          <p className="text-sm text-[var(--ink-light)]">Ce lien d&apos;invitation n&apos;est plus valide. Demande un nouveau lien à ton groupe.</p>
        </div>
      )}

      {(status === 'ready' || status === 'joining') && (
        <div className="space-y-4">
          <div className="text-4xl">🎸</div>
          <h1 className="font-playfair text-xl font-bold text-[var(--ink)]">
            Rejoindre <span className="text-[var(--accent)]">{groupName}</span>
          </h1>
          <p className="text-sm text-[var(--ink-light)]">Tu as été invité à rejoindre ce groupe.</p>
          <button
            onClick={handleJoin}
            disabled={status === 'joining'}
            className="px-6 py-3 bg-[var(--accent)] hover:bg-[#a83d25] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {status === 'joining' ? 'Rejoindre…' : 'Rejoindre le groupe'}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3">
          <div className="text-4xl">⚠️</div>
          <h1 className="font-playfair text-xl font-bold text-[var(--ink)]">Erreur</h1>
          <p className="text-sm text-[var(--ink-light)]">{errorMsg}</p>
          <button
            onClick={() => setStatus('ready')}
            className="text-sm text-[var(--accent)] underline"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
