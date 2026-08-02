'use client';

import { useState, useEffect } from 'react';
import { AdminTile } from '@/components/admin/admin-tile';

import { getAuth } from 'firebase/auth';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit, doc, deleteDoc, setDoc, updateDoc, deleteField, where } from 'firebase/firestore';
import type { Sheet, UserWithStats } from '@/types';
import { Button } from '@/components/ui/button';
import { AdminUsersTable } from '@/components/admin/users-table';
import { Link, useRouter } from '@/i18n/navigation';
interface Stats {
  totalUsers: number;
  totalSheets: number;
  publicSheets: number;
  totalSets: number;
  totalBookmarks: number;
}

interface SheetWithOwner extends Sheet {
  id: string;
}

export default function AdminPage() {
  const t = useTranslations('Admin');
  const locale = useLocale();
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
  const [checkingKeys, setCheckingKeys] = useState(false);
  const [keyResult, setKeyResult] = useState('');
  const [backfillingBpm, setBackfillingBpm] = useState(false);
  const [bpmResult, setBpmResult] = useState('');
  const [purgingLyrics, setPurgingLyrics] = useState(false);
  const [lyricsResult, setLyricsResult] = useState('');
  const [backfillingChords, setBackfillingChords] = useState(false);
  const [chordResult, setChordResult] = useState('');
  const [backfillingYears, setBackfillingYears] = useState(false);
  const [yearResult, setYearResult] = useState('');
  const [backfillingGenres, setBackfillingGenres] = useState(false);
  const [genreResult, setGenreResult] = useState('');

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
    if (!confirm(t('deleteConfirm'))) return;

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
      alert(t('deleteError'));
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
      setProResult(t('proSuccess', { count: updated }));
    } catch (e) {
      setProResult(t('errorPrefix', { message: e instanceof Error ? e.message : t('unknownError') }));
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
      if (!idToken) throw new Error(t('notConnected'));
      const res = await fetch('/api/admin/backfill-search-fields', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('backfillError'));
      setBackfillResult(t('backfillSuccess', { updated: data.updated, total: data.total }));
    } catch (e) {
      setBackfillResult(t('errorPrefix', { message: e instanceof Error ? e.message : t('unknownError') }));
    } finally {
      setBackfillingSearch(false);
    }
  };

  /**
   * Mesure l'accord entre la tonalité déduite des accords et celle déjà renseignée.
   * Lecture seule : rien n'est écrit, il s'agit de décider si la déduction vaut d'être
   * proposée, sur des données réelles.
   */
  const handleKeyCheck = async () => {
    setCheckingKeys(true);
    setKeyResult('');
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error(t('notConnected'));
      const res = await fetch('/api/admin/key-check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('backfillError'));
      setKeyResult(t('keyCheckResult', {
        compared: data.compared, exact: data.exact, relative: data.relative, different: data.different,
      }));
      // Le détail va dans la console : il sert au diagnostic, pas à l'écran.
      console.info('[tonalité] sans capo :', data.sansCapo, '· avec capo :', data.avecCapo, '· expliqués par le capo :', data.capoExplique);
      console.info('[tonalité] intervalles d\'écart (demi-tons) :', data.intervalles);
      console.table(data.ecarts);
    } catch (e) {
      setKeyResult(t('errorPrefix', { message: e instanceof Error ? e.message : t('unknownError') }));
    } finally {
      setCheckingKeys(false);
    }
  };

  /**
   * Renseigne tempo et tonalité des grilles qui n'en ont pas.
   *
   * Par petits lots : chaque interrogation du service prend plusieurs secondes, elle
   * transite par un proxy. On relance tant qu'il reste des grilles à traiter.
   */
  const handleBackfillBpm = async () => {
    setBackfillingBpm(true);
    setBpmResult('');
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error(t('notConnected'));
      const res = await fetch('/api/admin/backfill-bpm', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('backfillError'));
      setBpmResult(t('bpmBackfillResult', { updated: data.updated, notFound: data.notFound, remaining: data.remaining }));
    } catch (e) {
      setBpmResult(t('errorPrefix', { message: e instanceof Error ? e.message : t('unknownError') }));
    } finally {
      setBackfillingBpm(false);
    }
  };

  /**
   * Efface les paroles stockées. En deux temps, à dessein : on compte d'abord, on
   * annonce le nombre, et la suppression n'a lieu qu'après confirmation. C'est
   * irréversible, ça mérite un arrêt.
   */
  const handlePurgeLyrics = async () => {
    setPurgingLyrics(true);
    setLyricsResult('');
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error(t('notConnected'));
      const headers = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };

      const compte = await fetch('/api/admin/purge-lyrics', {
        method: 'POST', headers, body: JSON.stringify({ dryRun: true }),
      });
      const apercu = await compte.json().catch(() => ({}));
      if (!compte.ok) throw new Error(apercu.error || t('backfillError'));

      if (apercu.withLyrics === 0) {
        setLyricsResult(t('lyricsPurgeNone'));
        return;
      }
      if (!confirm(t('lyricsPurgeConfirm', { count: apercu.withLyrics }))) {
        setLyricsResult('');
        return;
      }

      const res = await fetch('/api/admin/purge-lyrics', {
        method: 'POST', headers, body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('backfillError'));
      setLyricsResult(t('lyricsPurgeDone', { count: data.purged }));
    } catch (e) {
      setLyricsResult(t('errorPrefix', { message: e instanceof Error ? e.message : t('unknownError') }));
    } finally {
      setPurgingLyrics(false);
    }
  };

  // Dépose le champ `chords` (accords à plat) sur les grilles antérieures à son
  // introduction. C'est lui qui rend une grille visible depuis une page d'accord.
  // Idempotent : une grille déjà à jour n'est pas réécrite.
  const handleBackfillChords = async () => {
    setBackfillingChords(true);
    setChordResult('');
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error(t('notConnected'));
      const res = await fetch('/api/admin/backfill-chords', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('backfillError'));
      setChordResult(t('backfillSuccess', { updated: data.updated, total: data.total }));
    } catch (e) {
      setChordResult(t('errorPrefix', { message: e instanceof Error ? e.message : t('unknownError') }));
    } finally {
      setBackfillingChords(false);
    }
  };

  // Renseigne l'année de sortie (depuis iTunes) des grilles qui n'en ont pas encore.
  // Traite un lot par appel : relancer tant que "reste" > 0.
  const handleBackfillYears = async () => {
    setBackfillingYears(true);
    setYearResult('');
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error(t('notConnected'));
      const res = await fetch('/api/admin/backfill-years', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('backfillError'));
      setYearResult(t('yearBackfillSuccess', { updated: data.updated, notFound: data.notFound, remaining: data.remaining }));
    } catch (e) {
      setYearResult(t('errorPrefix', { message: e instanceof Error ? e.message : t('unknownError') }));
    } finally {
      setBackfillingYears(false);
    }
  };

  // Renseigne le genre (depuis iTunes) des grilles qui n'en ont pas encore.
  const handleBackfillGenres = async () => {
    setBackfillingGenres(true);
    setGenreResult('');
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error(t('notConnected'));
      const res = await fetch('/api/admin/backfill-genres', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('backfillError'));
      setGenreResult(t('genreBackfillSuccess', { updated: data.updated, notFound: data.notFound, remaining: data.remaining }));
    } catch (e) {
      setGenreResult(t('errorPrefix', { message: e instanceof Error ? e.message : t('unknownError') }));
    } finally {
      setBackfillingGenres(false);
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
          {t('title')}
        </h1>
        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
          {t('badge')}
        </span>
      </div>

      {/* Opérations d'administration, en grille : empilées en pleine largeur, il
          fallait dérouler pour savoir ce qui existe. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <AdminTile
          title={t('foundersAccounts')}
          description="alex.vauthier@gmail.com · jerome_busato@hotmail.fr · vauthier.julien@gmail.com"
          action={t('setToPro')}
          running={settingPro}
          runningLabel={t('inProgress')}
          result={proResult}
          onRun={handleSetFoundersPro}
        />
        <AdminTile
          title={t('searchIndex')}
          description={t('searchIndexDesc')}
          action={t('updateIndex')}
          running={backfillingSearch}
          runningLabel={t('inProgress')}
          result={backfillResult}
          onRun={handleBackfillSearchFields}
        />
        <AdminTile
          title={t('chordIndex')}
          description={t('chordIndexDesc')}
          action={t('updateIndex')}
          running={backfillingChords}
          runningLabel={t('inProgress')}
          result={chordResult}
          onRun={handleBackfillChords}
        />
        <AdminTile
          title={t('yearBackfill')}
          description={t('yearBackfillDesc')}
          action={t('fillYears')}
          running={backfillingYears}
          runningLabel={t('inProgress')}
          result={yearResult}
          onRun={handleBackfillYears}
        />
        <AdminTile
          title={t('genreBackfill')}
          description={t('genreBackfillDesc')}
          action={t('fillGenres')}
          running={backfillingGenres}
          runningLabel={t('inProgress')}
          result={genreResult}
          onRun={handleBackfillGenres}
        />
        <AdminTile
          title={t('bpmBackfill')}
          description={t('bpmBackfillDesc')}
          action={t('fillBpm')}
          running={backfillingBpm}
          runningLabel={t('inProgress')}
          result={bpmResult}
          onRun={handleBackfillBpm}
        />
        <AdminTile
          title={t('keyCheck')}
          description={t('keyCheckDesc')}
          action={t('keyCheckAction')}
          running={checkingKeys}
          runningLabel={t('inProgress')}
          result={keyResult}
          onRun={handleKeyCheck}
        />
        <AdminTile
          title={t('lyricsPurge')}
          description={t('lyricsPurgeDesc')}
          action={t('lyricsPurgeAction')}
          running={purgingLyrics}
          runningLabel={t('inProgress')}
          result={lyricsResult}
          onRun={handlePurgeLyrics}
          danger
        />
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        <StatCard label={t('statUsers')} value={stats?.totalUsers ?? 0} color="blue" />
        <StatCard label={t('statSheets')} value={stats?.totalSheets ?? 0} color="green" />
        <StatCard label={t('statPublic')} value={stats?.publicSheets ?? 0} color="purple" />
        <StatCard label={t('statSets')} value={stats?.totalSets ?? 0} color="orange" />
        <StatCard label={t('statBookmarks')} value={stats?.totalBookmarks ?? 0} color="pink" />
      </div>

      {/* Utilisateurs */}
      <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-6 mb-8">
        <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">
          {t('usersSection', { count: users.length })}
        </h2>
        <AdminUsersTable users={users} />
      </div>

      {/* Grilles récentes */}
      <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-6">
        <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">
          {t('recentSheets')}
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
                    {sheet.title || t('untitled')}
                  </Link>
                  {sheet.isPublic && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">
                      {t('publicBadge')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--ink-light)]">
                  {sheet.artist || t('unknownArtist')} • {t('byOwner', { name: sheet.ownerName })} • {sheet.createdAt.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR')}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Link href={`/sheet/${sheet.id}/edit`}>
                  <Button variant="ghost" size="sm">
                    {t('editButton')}
                  </Button>
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteSheet(sheet.id)}
                  isLoading={deletingSheet === sheet.id}
                >
                  {t('deleteButton')}
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
