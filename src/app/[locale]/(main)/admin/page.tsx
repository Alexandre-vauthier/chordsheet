'use client';

import { useState, useEffect } from 'react';

import { getAuth } from 'firebase/auth';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit, doc, deleteDoc, setDoc, updateDoc, deleteField, where } from 'firebase/firestore';
import type { User, Sheet } from '@/types';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
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
  setsCount: number;
  bookmarksCount: number;
  groupsCount: number;
  lastVisitAt: Date | null;
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
  const [settingPro, setSettingPro] = useState(false);
  const [proResult, setProResult] = useState('');
  const [backfillingSearch, setBackfillingSearch] = useState(false);
  const [backfillResult, setBackfillResult] = useState('');

  // Rediriger si pas admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/dashboard');
    }
  }, [user, loading, isAdmin, router]);

  // Charger les données
  useEffect(() => {
    if (loading || !isAdmin) return;

    const loadData = async () => {
      const db = getDb();

      try {
        // Statistiques globales
        const [usersSnap, sheetsSnap, setsSnap, bookmarksSnap, groupsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'sheets')),
          getDocs(collection(db, 'sets')),
          getDocs(collection(db, 'bookmarks')),
          getDocs(collection(db, 'groups')),
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

        // Compter les sets par utilisateur
        const setsByUser: Record<string, number> = {};
        setsSnap.docs.forEach(doc => {
          const ownerId = doc.data().ownerId;
          setsByUser[ownerId] = (setsByUser[ownerId] || 0) + 1;
        });

        // Compter les favoris (book) par utilisateur
        const bookmarksByUser: Record<string, number> = {};
        bookmarksSnap.docs.forEach(doc => {
          const userId = doc.data().userId;
          bookmarksByUser[userId] = (bookmarksByUser[userId] || 0) + 1;
        });

        // Compter les groupes dont l'utilisateur est membre
        const groupsByUser: Record<string, number> = {};
        groupsSnap.docs.forEach(doc => {
          const memberIds: string[] = doc.data().memberIds || [];
          memberIds.forEach(memberId => {
            groupsByUser[memberId] = (groupsByUser[memberId] || 0) + 1;
          });
        });

        // Liste des utilisateurs avec leurs stats
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
            setsCount: setsByUser[doc.id] || 0,
            bookmarksCount: bookmarksByUser[doc.id] || 0,
            groupsCount: groupsByUser[doc.id] || 0,
            lastVisitAt: data.lastVisitAt?.toDate() || null,
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
  }, [loading, isAdmin]);

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

  const handleSetFoundersPro = async () => {
    const emails = ['alex.vauthier@gmail.com', 'jerome_busato@hotmail.fr', 'vauthier.julien@gmail.com'];
    setSettingPro(true);
    setProResult('');
    try {
      const db = getDb();
      const usersRef = collection(db, 'users');
      let updated = 0;
      for (const email of emails) {
        const snap = await getDocs(query(usersRef, where('email', '==', email)));
        for (const userDoc of snap.docs) {
          await setDoc(doc(db, 'users', userDoc.id, 'private', 'subscription'), {
            plan: 'pro',
            status: 'active',
            ocrUsedThisMonth: 0,
          }, { merge: true });
          // Nettoyage de l'ancien emplacement (subscription vivait avant sur le doc principal)
          await updateDoc(doc(db, 'users', userDoc.id), { subscription: deleteField() }).catch(() => {});
          updated++;
        }
      }
      setProResult(`✓ ${updated} compte${updated > 1 ? 's' : ''} passé${updated > 1 ? 's' : ''} en Pro`);
    } catch (e) {
      setProResult(`Erreur : ${e instanceof Error ? e.message : 'inconnue'}`);
    } finally {
      setSettingPro(false);
    }
  };

  // Ajoute titleLower/artistLower aux grilles existantes qui ne les ont pas encore
  // (nécessaires pour la recherche par préfixe de la navbar/éditeur). Sans danger à
  // relancer : ne touche que les documents où les champs manquent.
  const handleBackfillSearchFields = async () => {
    setBackfillingSearch(true);
    setBackfillResult('');
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error('Non connecté');
      const res = await fetch('/api/admin/backfill-search-fields', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour.');
      setBackfillResult(`✓ ${data.updated}/${data.total} grille(s) mise(s) à jour`);
    } catch (e) {
      setBackfillResult(`Erreur : ${e instanceof Error ? e.message : 'inconnue'}`);
    } finally {
      setBackfillingSearch(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="max-w-[1270px] mx-auto px-4 py-8">
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

      {/* Comptes fondateurs Pro */}
      <div className="mb-8 p-4 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">Comptes fondateurs</p>
          <p className="text-xs text-[var(--ink-faint)]">alex.vauthier@gmail.com · jerome_busato@hotmail.fr · vauthier.julien@gmail.com</p>
        </div>
        <div className="flex items-center gap-3">
          {proResult && <span className="text-xs text-[var(--ink-light)]">{proResult}</span>}
          <button
            onClick={handleSetFoundersPro}
            disabled={settingPro}
            className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {settingPro ? 'En cours…' : 'Passer en Pro'}
          </button>
        </div>
      </div>

      {/* Index de recherche (titleLower/artistLower) */}
      <div className="mb-8 p-4 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">Index de recherche</p>
          <p className="text-xs text-[var(--ink-faint)]">Met à jour les grilles existantes pour qu&apos;elles apparaissent dans la recherche/suggestions (à faire une fois, sans risque de relancer).</p>
        </div>
        <div className="flex items-center gap-3">
          {backfillResult && <span className="text-xs text-[var(--ink-light)]">{backfillResult}</span>}
          <button
            onClick={handleBackfillSearchFields}
            disabled={backfillingSearch}
            className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {backfillingSearch ? 'En cours…' : 'Mettre à jour l’index'}
          </button>
        </div>
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
      <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-6 mb-8">
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
                <th className="text-center py-2 px-3 font-medium text-[var(--ink-light)]">Sets</th>
                <th className="text-center py-2 px-3 font-medium text-[var(--ink-light)]">Book</th>
                <th className="text-center py-2 px-3 font-medium text-[var(--ink-light)]">Groupes</th>
                <th className="text-left py-2 px-3 font-medium text-[var(--ink-light)]">Inscrit le</th>
                <th className="text-left py-2 px-3 font-medium text-[var(--ink-light)]">Dernière visite</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--cell-hover)]">
                  <td className="py-3 px-3">
                    <Link href={`/user/${u.id}`} className="flex items-center gap-2 group/user">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                          {u.displayName?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-[var(--ink)] group-hover/user:text-[var(--accent)] transition-colors">
                        {u.displayName || '-'}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-[var(--ink-light)]">{u.email}</td>
                  <td className="py-3 px-3 text-center">
                    {u.role === 'admin' ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Admin</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-[var(--line)] text-gray-600 rounded text-xs">User</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center font-mono">{u.sheetsCount}</td>
                  <td className="py-3 px-3 text-center font-mono">{u.setsCount}</td>
                  <td className="py-3 px-3 text-center font-mono">{u.bookmarksCount}</td>
                  <td className="py-3 px-3 text-center font-mono">{u.groupsCount}</td>
                  <td className="py-3 px-3 text-[var(--ink-light)]">
                    {u.createdAt.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 px-3 text-[var(--ink-light)]">
                    {u.lastVisitAt ? u.lastVisitAt.toLocaleDateString('fr-FR') : <span className="text-[var(--ink-faint)]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grilles récentes */}
      <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-6">
        <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">
          Grilles récentes
        </h2>
        <div className="space-y-3">
          {recentSheets.map(sheet => (
            <div
              key={sheet.id}
              className="flex items-center justify-between p-3 rounded-lg border border-[var(--line)] hover:bg-[var(--cell-hover)]"
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
