'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { NotationPreference } from '@/types';

interface UserStats {
  sheetsCount: number;
  publicSheetsCount: number;
  setsCount: number;
  bookmarksCount: number;
}

export default function ProfilePage() {
  const { user, loading, updateUser, signOut, deleteAccount } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [notation, setNotation] = useState<NotationPreference>('american');
  const [colorCoding, setColorCoding] = useState(false);
  const [inlineDiagram, setInlineDiagram] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingNotation, setIsSavingNotation] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  // Charger le nom initial
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      if (user.notationPreference) setNotation(user.notationPreference);
      setColorCoding(user.chordColorCoding ?? false);
      setInlineDiagram(user.showInlineDiagram ?? false);
    }
  }, [user]);

  // Charger les statistiques
  useEffect(() => {
    if (!user) return;

    const loadStats = async () => {
      const db = getDb();

      // Compter les grilles
      const sheetsQuery = query(
        collection(db, 'sheets'),
        where('ownerId', '==', user.id)
      );
      const sheetsSnapshot = await getDocs(sheetsQuery);
      const sheetsCount = sheetsSnapshot.size;
      const publicSheetsCount = sheetsSnapshot.docs.filter(doc => doc.data().isPublic).length;

      // Compter les sets
      const setsQuery = query(
        collection(db, 'sets'),
        where('ownerId', '==', user.id)
      );
      const setsSnapshot = await getDocs(setsQuery);
      const setsCount = setsSnapshot.size;

      // Compter les favoris
      const bookmarksQuery = query(
        collection(db, 'bookmarks'),
        where('userId', '==', user.id)
      );
      const bookmarksSnapshot = await getDocs(bookmarksQuery);
      const bookmarksCount = bookmarksSnapshot.size;

      setStats({
        sheetsCount,
        publicSheetsCount,
        setsCount,
        bookmarksCount,
      });
    };

    loadStats();
  }, [user]);

  // Sauvegarder la notation immédiatement au clic
  const handleNotationChange = async (value: NotationPreference) => {
    setNotation(value);
    setIsSavingNotation(true);
    try {
      await updateUser({ notationPreference: value });
    } catch (error) {
      console.error('Error saving notation:', error);
    } finally {
      setIsSavingNotation(false);
    }
  };

  // Sauvegarder le nom
  const handleSaveName = async () => {
    if (!displayName.trim()) {
      setMessage({ type: 'error', text: 'Le nom ne peut pas être vide' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await updateUser({ displayName: displayName.trim(), notationPreference: notation });
      setMessage({ type: 'success', text: 'Nom mis à jour avec succès' });
    } catch (error) {
      console.error('Error updating name:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          <div className="h-32 w-32 bg-gray-200 rounded-full mx-auto" />
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-[var(--ink-light)]">Vous devez être connecté pour accéder à cette page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mb-8">
        Mon profil
      </h1>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Avatar */}
      <div className="flex justify-center mb-8">
        <div className="w-24 h-24 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-4xl font-bold shadow-lg">
          {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Formulaire */}
      <div className="space-y-6 bg-white rounded-xl border border-[var(--line)] p-6">
        {/* Nom d'affichage */}
        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-2">
            Nom d&apos;affichage
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1 px-4 py-2 border border-[var(--line)] rounded-lg
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="Votre nom"
            />
            <Button
              onClick={handleSaveName}
              isLoading={isSaving}
              disabled={displayName === user.displayName}
            >
              Enregistrer
            </Button>
          </div>
        </div>

        {/* Email (lecture seule) */}
        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-2">
            Email
          </label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full px-4 py-2 border border-[var(--line)] rounded-lg bg-gray-50 text-[var(--ink-light)]"
          />
          <p className="mt-1 text-xs text-[var(--ink-faint)]">
            L&apos;email ne peut pas être modifié
          </p>
        </div>

        {/* Date d'inscription */}
        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-2">
            Membre depuis
          </label>
          <p className="text-[var(--ink)]">
            {user.createdAt.toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Préférence de notation */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--line)] mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--ink)]">Notation des accords</h2>
          {isSavingNotation && (
            <span className="text-xs text-[var(--ink-faint)]">Sauvegarde…</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleNotationChange('american')}
            disabled={isSavingNotation}
            className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors ${
              notation === 'american'
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--ink-faint)]'
            }`}
          >
            <div className="font-mono text-lg mb-1">Am · F#m7</div>
            <div>Anglais</div>
          </button>
          <button
            onClick={() => handleNotationChange('french')}
            disabled={isSavingNotation}
            className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors ${
              notation === 'french'
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--ink-faint)]'
            }`}
          >
            <div className="font-mono text-lg mb-1">Lam · Fa#m7</div>
            <div>Français</div>
          </button>
        </div>
      </div>

      {/* Code couleur des accords */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--line)] mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">Code couleur des accords</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              Bordure colorée sur chaque case selon la note fondamentale
            </p>
            <div className="flex gap-1.5 mt-2">
              {[
                { note: 'C', color: '#dc2626' },
                { note: 'D', color: '#ea580c' },
                { note: 'E', color: '#ca8a04' },
                { note: 'F', color: '#16a34a' },
                { note: 'G', color: '#0891b2' },
                { note: 'A', color: '#2563eb' },
                { note: 'B', color: '#7c3aed' },
              ].map(({ note, color }) => (
                <span
                  key={note}
                  className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded"
                  style={{ borderLeft: `5px solid ${color}`, background: `${color}15` }}
                >
                  {note}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={async () => {
              const newVal = !colorCoding;
              setColorCoding(newVal);
              try { await updateUser({ chordColorCoding: newVal }); } catch { /* silent */ }
            }}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              colorCoding ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                colorCoding ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Diagramme inline */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--line)] mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">Diagramme dans la case</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              Affiche le diagramme de l&apos;accord directement dans chaque case en consultation
            </p>
          </div>
          <button
            onClick={async () => {
              const newVal = !inlineDiagram;
              setInlineDiagram(newVal);
              try { await updateUser({ showInlineDiagram: newVal }); } catch { /* silent */ }
            }}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              inlineDiagram ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${inlineDiagram ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Déconnexion */}
      <div className="mt-6">
        <button
          onClick={async () => { await signOut(); router.push('/'); }}
          className="w-full py-2.5 px-4 rounded-xl border border-[var(--line)] text-sm text-[var(--ink-light)]
            hover:border-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors bg-white"
        >
          Se déconnecter
        </button>
      </div>

      {/* Statistiques */}
      <div className="mt-8">
        <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">
          Statistiques
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Grilles"
            value={stats?.sheetsCount ?? '-'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            }
          />
          <StatCard
            label="Publiques"
            value={stats?.publicSheetsCount ?? '-'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Sets"
            value={stats?.setsCount ?? '-'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
          <StatCard
            label="Favoris"
            value={stats?.bookmarksCount ?? '-'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            }
          />
        </div>
      </div>
      {/* Zone danger — suppression de compte */}
      <div className="mt-8 bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-sm font-semibold text-red-700 mb-1">Zone danger</h2>
        <p className="text-xs text-[var(--ink-faint)] mb-4">
          La suppression du compte est irréversible. Toutes vos grilles, sets et favoris seront définitivement supprimés.
        </p>
        <button
          onClick={async () => {
            if (!confirm('Supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible.')) return;
            try {
              await deleteAccount();
              router.push('/');
            } catch (err) {
              console.error('Error deleting account:', err);
              alert('Erreur lors de la suppression. Reconnectez-vous et réessayez.');
            }
          }}
          className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg
            hover:bg-red-50 transition-colors"
        >
          Supprimer mon compte
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--line)] p-4 text-center">
      <div className="flex justify-center mb-2 text-[var(--accent)]">
        {icon}
      </div>
      <div className="text-2xl font-bold text-[var(--ink)]">{value}</div>
      <div className="text-xs text-[var(--ink-light)]">{label}</div>
    </div>
  );
}
