'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit, doc, deleteDoc } from 'firebase/firestore';
import type { User, Sheet } from '@/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Stats {
  totalUsers: number;
  totalSheets: number;
  publicSheets: number;
  totalSets: number;
  totalBookmarks: number;
}

interface UserWithStats extends Omit<User, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
  sheetsCount: number;
}

interface SheetWithOwner extends Sheet {
  id: string;
}

export default function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [recentSheets, setRecentSheets] = useState<SheetWithOwner[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [deletingSheet, setDeletingSheet] = useState<string | null>(null);

  // Rediriger si pas admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/dashboard');
    }
  }, [user, loading, isAdmin, router]);

  // Charger les données
  useEffect(() => {
    if (!isAdmin) return;

    const loadData = async () => {
      const db = getDb();

      try {
        // Statistiques globales
        const [usersSnap, sheetsSnap, setsSnap, bookmarksSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'sheets')),
          getDocs(collection(db, 'sets')),
          getDocs(collection(db, 'bookmarks')),
        ]);

        const publicSheets = sheetsSnap.docs.filter(doc => doc.data().isPublic).length;

        setStats({
          totalUsers: usersSnap.size,
          totalSheets: sheetsSnap.size,
          publicSheets,
          totalSets: setsSnap.size,
          totalBookmarks: bookmarksSnap.size,
        });

        // Compter les grilles par utilisateur
        const sheetsByUser: Record<string, number> = {};
        sheetsSnap.docs.forEach(doc => {
          const ownerId = doc.data().ownerId;
          sheetsByUser[ownerId] = (sheetsByUser[ownerId] || 0) + 1;
        });

        // Liste des utilisateurs avec leur nombre de grilles
        const usersData: UserWithStats[] = usersSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            displayName: data.displayName || '',
            email: data.email || '',
            photoURL: data.photoURL || null,
            role: data.role || 'user',
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            sheetsCount: sheetsByUser[doc.id] || 0,
          };
        });

        // Trier par date de création (plus récent en premier)
        usersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setUsers(usersData);

        // Grilles récentes
        const recentSheetsQuery = query(
          collection(db, 'sheets'),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const recentSheetsSnap = await getDocs(recentSheetsQuery);
        const recentSheetsData: SheetWithOwner[] = recentSheetsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as SheetWithOwner[];

        setRecentSheets(recentSheetsData);
      } catch (error) {
        console.error('Error loading admin data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [isAdmin]);

  // Supprimer une grille
  const handleDeleteSheet = async (sheetId: string) => {
    if (!confirm('Supprimer cette grille ? Cette action est irréversible.')) return;

    setDeletingSheet(sheetId);
    try {
      const db = getDb();
      await deleteDoc(doc(db, 'sheets', sheetId));
      setRecentSheets(prev => prev.filter(s => s.id !== sheetId));
      if (stats) {
        setStats({ ...stats, totalSheets: stats.totalSheets - 1 });
      }
    } catch (error) {
      console.error('Error deleting sheet:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeletingSheet(null);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-playfair text-2xl font-bold text-[var(--ink)]">
          Administration
        </h1>
        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
          Admin
        </span>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        <StatCard label="Utilisateurs" value={stats?.totalUsers ?? 0} color="blue" />
        <StatCard label="Grilles" value={stats?.totalSheets ?? 0} color="green" />
        <StatCard label="Publiques" value={stats?.publicSheets ?? 0} color="purple" />
        <StatCard label="Sets" value={stats?.totalSets ?? 0} color="orange" />
        <StatCard label="Favoris" value={stats?.totalBookmarks ?? 0} color="pink" />
      </div>

      {/* Utilisateurs */}
      <div className="bg-white rounded-xl border border-[var(--line)] p-6 mb-8">
        <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">
          Utilisateurs ({users.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left py-2 px-3 font-medium text-[var(--ink-light)]">Utilisateur</th>
                <th className="text-left py-2 px-3 font-medium text-[var(--ink-light)]">Email</th>
                <th className="text-center py-2 px-3 font-medium text-[var(--ink-light)]">Rôle</th>
                <th className="text-center py-2 px-3 font-medium text-[var(--ink-light)]">Grilles</th>
                <th className="text-left py-2 px-3 font-medium text-[var(--ink-light)]">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-[var(--line)] last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                          {u.displayName?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-[var(--ink)]">{u.displayName || '-'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-[var(--ink-light)]">{u.email}</td>
                  <td className="py-3 px-3 text-center">
                    {u.role === 'admin' ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Admin</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">User</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center font-mono">{u.sheetsCount}</td>
                  <td className="py-3 px-3 text-[var(--ink-light)]">
                    {u.createdAt.toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grilles récentes */}
      <div className="bg-white rounded-xl border border-[var(--line)] p-6">
        <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">
          Grilles récentes
        </h2>
        <div className="space-y-3">
          {recentSheets.map(sheet => (
            <div
              key={sheet.id}
              className="flex items-center justify-between p-3 rounded-lg border border-[var(--line)] hover:bg-gray-50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/sheet/${sheet.id}`}
                    className="font-medium text-[var(--ink)] hover:text-[var(--accent)] truncate"
                  >
                    {sheet.title || 'Sans titre'}
                  </Link>
                  {sheet.isPublic && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">
                      Public
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--ink-light)]">
                  {sheet.artist || 'Artiste inconnu'} • par {sheet.ownerName} • {sheet.createdAt.toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Link href={`/sheet/${sheet.id}/edit`}>
                  <Button variant="ghost" size="sm">
                    Éditer
                  </Button>
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteSheet(sheet.id)}
                  isLoading={deletingSheet === sheet.id}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    pink: 'bg-pink-50 text-pink-700 border-pink-200',
  };

  return (
    <div className={`rounded-xl border p-4 text-center ${colors[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}
