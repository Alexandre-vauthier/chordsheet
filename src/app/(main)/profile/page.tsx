'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getDb, getStorage } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';

interface UserStats {
  sheetsCount: number;
  publicSheetsCount: number;
  setsCount: number;
  bookmarksCount: number;
}

export default function ProfilePage() {
  const { user, loading, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger le nom initial
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
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

  // Sauvegarder le nom
  const handleSaveName = async () => {
    if (!displayName.trim()) {
      setMessage({ type: 'error', text: 'Le nom ne peut pas être vide' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await updateUser({ displayName: displayName.trim() });
      setMessage({ type: 'success', text: 'Nom mis à jour avec succès' });
    } catch (error) {
      console.error('Error updating name:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    } finally {
      setIsSaving(false);
    }
  };

  // Upload de photo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner une image' });
      return;
    }

    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'L\'image ne doit pas dépasser 2 Mo' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const storage = getStorage();
      const fileRef = ref(storage, `avatars/${user.id}`);

      await uploadBytes(fileRef, file);
      const photoURL = await getDownloadURL(fileRef);

      await updateUser({ photoURL });
      setMessage({ type: 'success', text: 'Photo mise à jour avec succès' });
    } catch (error) {
      console.error('Error uploading photo:', error);
      setMessage({ type: 'error', text: 'Erreur lors de l\'upload' });
    } finally {
      setIsUploading(false);
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

      {/* Photo de profil */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[var(--accent)] text-white text-4xl font-bold">
                {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[var(--ink)] text-white
              flex items-center justify-center shadow-lg hover:bg-[var(--accent)] transition-colors
              disabled:opacity-50"
            title="Changer la photo"
          >
            {isUploading ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>
        <p className="mt-2 text-xs text-[var(--ink-light)]">
          JPG, PNG ou GIF (max 2 Mo)
        </p>
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
