'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { groupSheetsBySong, songKey } from '@/lib/sheet-groups';
import { sansCopiesDeGroupe } from '@/lib/sheet-catalogue';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { collection, query, where, getDocs, limit, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { sheetHasChord } from '@/lib/sheet-chords';
import { accordsDeLUrl, jouablesAvec } from '@/lib/explore-shelves';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useGenreLabel, useDifficultyLabel } from '@/lib/use-genre-labels';
import { Input } from '@/components/ui/input';
import { SheetCard } from '@/components/explore/sheet-card';
import { WelcomeBanner } from '@/components/explore/welcome-banner';
import { GENRES, DIFFICULTY_OPTIONS, type Difficulty } from '@/types';
import type { Sheet } from '@/types';
import { useRouter } from '@/i18n/navigation';

type SortOption = 'recent' | 'rated' | 'viewed';

/** Taille d'un lot de cartes du catalogue. */
const LOT = 48;

// Préférences de visibilité admin, conservées entre les visites de la page
const ADMIN_SHOW_PUBLIC_KEY = 'explore_admin_show_public';
const ADMIN_SHOW_PRIVATE_KEY = 'explore_admin_show_private';
const ADMIN_SHOW_PENDING_KEY = 'explore_admin_show_pending';

export function ExploreClient({
  initialSheets,
  decouverte,
  maintenant,
}: {
  initialSheets: Sheet[];
  /**
   * Les rayons, **déjà rendus par le serveur**.
   *
   * Ils arrivent en propriété plutôt que d'être construits ici : un composant
   * serveur passé à un composant client le reste, si bien que les tuiles sont
   * dans le HTML servi. Les construire dans ce fichier les aurait fait basculer
   * côté navigateur, et la page serait redevenue vide pour les moteurs.
   */
  decouverte?: React.ReactNode;
  /**
   * L'instant du rendu, descendu du serveur.
   *
   * La fenêtre de fraîcheur a besoin d'une origine, et lire l'horloge pendant un
   * rendu React n'est pas permis : deux passes donneraient deux frontières. Le
   * serveur la lit une fois, la page la transmet.
   */
  maintenant: number;
}) {
  const t = useTranslations('Explore');
  const genreLabel = useGenreLabel();
  const difficultyLabel = useDifficultyLabel();
  const { isAdmin, user, loading: authLoading } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * Le catalogue vient du serveur.
   *
   * Il venait d'un `getDocs` navigateur plafonné à 200 documents **sans
   * `orderBy`** : Firestore rendait les 200 premiers par identifiant, un
   * sous-ensemble arbitraire, et le tri « Récents » ne triait ensuite que
   * celui-là. Le compteur affiché mentait de la même façon, et le HTML servi aux
   * moteurs ne contenait aucune grille.
   *
   * L'administrateur charge en plus les grilles privées et à valider, que les
   * règles Firestore réservent à son compte : c'est le seul cas qui reste client.
   */
  const [sheets, setSheets] = useState<Sheet[]>(initialSheets);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');

  // Mettre à jour la recherche si le param URL change (nouvelle recherche depuis la navbar)
  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '');
  }, [searchParams]);


  // Filtres — initialisés depuis l'URL pour survivre au retour arrière
  const [sortBy, setSortBy] = useState<SortOption>(() => (searchParams.get('sort') as SortOption) ?? 'recent');
  const [selectedGenre, setSelectedGenre] = useState<string>(() => searchParams.get('genre') ?? '');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(() => { const d = searchParams.get('difficulty'); return d ? (Number(d) as Difficulty) : null; });
  /**
   * Décennie et tonalité : **lues** dans l'URL, jamais recopiées dans un état.
   *
   * La décennie était volontairement éphémère, rien n'y menant de l'extérieur.
   * Les tuiles thématiques y mènent désormais, comme les liens du bloc éditorial
   * mènent aux genres : elle rejoint donc l'URL, sans quoi une tuile ouvrirait un
   * catalogue non filtré.
   *
   * Dérivées et non dupliquées : un état recopié depuis l'URL demande un effet
   * pour se resynchroniser, et cet effet est précisément l'endroit où les deux
   * finissent par diverger. Ici l'URL est la seule source, et le sélecteur ne
   * fait que l'écrire.
   */
  const selectedDecade = Number(searchParams.get('decade')) || null;
  const selectedKey = searchParams.get('key')?.trim() ?? '';
  /**
   * Fenêtre de fraîcheur, en jours.
   *
   * C'est la destination du « tout voir » du rayon des nouveautés. Sans elle, ce
   * bouton n'aurait mené qu'au catalogue trié par date : les plus récentes en
   * haut, certes, mais mêlées à tout le reste, alors que le rayon promettait une
   * tranche précise.
   */
  const depuisJours = Number(searchParams.get('since')) || null;
  /**
   * Les accords qu'on sait jouer, tels que le hero les a transmis.
   *
   * Lu dans l'URL et non porté par un état : c'est le hero qui décide, la page
   * ne fait qu'obéir. Une seule source, donc pas de dérive possible entre ce que
   * la question annonce et ce que le catalogue montre.
   */
  const accordsConnus = useMemo(
    () => accordsDeLUrl(searchParams.get('chords') ?? undefined),
    [searchParams],
  );
  // Toggles admin : afficher/masquer les grilles publiques, privées et à valider (visible ⇒ true par défaut).
  // Défaut à true côté serveur pour éviter un écart d'hydratation ; la préférence
  // stockée est relue au montage juste après.
  const [showPublic, setShowPublic] = useState(true);
  const [showPrivate, setShowPrivate] = useState(true);
  const [showPending, setShowPending] = useState(true);
  // Recherche par accord (admin) : filtrage en mémoire, les accords n'étant pas
  // indexés côté Firestore. Voir lib/sheet-chords.ts.
  const [chordQuery, setChordQuery] = useState('');

  // Relire la préférence de visibilité admin au montage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(ADMIN_SHOW_PUBLIC_KEY) === '0') setShowPublic(false);
    if (localStorage.getItem(ADMIN_SHOW_PRIVATE_KEY) === '0') setShowPrivate(false);
    if (localStorage.getItem(ADMIN_SHOW_PENDING_KEY) === '0') setShowPending(false);
  }, []);

  const toggleShowPublic = () => {
    const next = !showPublic;
    setShowPublic(next);
    if (typeof window !== 'undefined') localStorage.setItem(ADMIN_SHOW_PUBLIC_KEY, next ? '1' : '0');
  };
  const toggleShowPrivate = () => {
    const next = !showPrivate;
    setShowPrivate(next);
    if (typeof window !== 'undefined') localStorage.setItem(ADMIN_SHOW_PRIVATE_KEY, next ? '1' : '0');
  };
  const toggleShowPending = () => {
    const next = !showPending;
    setShowPending(next);
    if (typeof window !== 'undefined') localStorage.setItem(ADMIN_SHOW_PENDING_KEY, next ? '1' : '0');
  };

  // Synchroniser l'URL quand les filtres changent
  const updateUrl = (params: { sort?: SortOption; genre?: string; difficulty?: Difficulty | null; decade?: number | null; q?: string }) => {
    const p = new URLSearchParams(searchParams.toString());
    if (params.sort !== undefined) { params.sort === 'recent' ? p.delete('sort') : p.set('sort', params.sort); }
    if (params.genre !== undefined) { params.genre ? p.set('genre', params.genre) : p.delete('genre'); }
    if (params.difficulty !== undefined) { params.difficulty ? p.set('difficulty', String(params.difficulty)) : p.delete('difficulty'); }
    if (params.decade !== undefined) { params.decade ? p.set('decade', String(params.decade)) : p.delete('decade'); }
    if (params.q !== undefined) { params.q ? p.set('q', params.q) : p.delete('q'); }
    router.replace(`/explore?${p.toString()}`, { scroll: false });
  };

  /**
   * La recherche tapée finit dans l'URL, mais pas à chaque frappe.
   *
   * Elle n'y allait pas du tout : une recherche faite sur la page n'était ni
   * partageable ni conservée au retour arrière, alors que la barre de navigation
   * promet le contraire en envoyant sur `/explore?q=…`. Le filtrage reste
   * immédiat — il travaille sur le catalogue déjà en mémoire — et seule
   * l'adresse attend que la frappe s'arrête. Sans cette attente, chaque lettre
   * déclencherait un rendu serveur, la page étant dynamique.
   */
  const rechercheEcrite = useRef(searchParams.get('q') ?? '');
  useEffect(() => {
    if (searchQuery === rechercheEcrite.current) return;
    const minuteur = setTimeout(() => {
      rechercheEcrite.current = searchQuery;
      updateUrl({ q: searchQuery });
    }, 400);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleSortBy = (v: SortOption) => { setSortBy(v); updateUrl({ sort: v }); };
  const handleGenre = (v: string) => { setSelectedGenre(v); updateUrl({ genre: v }); };
  const handleDifficulty = (v: Difficulty | null) => { setSelectedDifficulty(v); updateUrl({ difficulty: v }); };
  // L'URL suit le sélecteur, comme pour le genre : une décennie choisie doit
  // pouvoir se partager et survivre au retour arrière.
  const handleDecade = (v: number | null) => updateUrl({ decade: v });

  // Mettre à jour le genre si le param URL change (ex: depuis la navbar)
  useEffect(() => {
    setSelectedGenre(searchParams.get('genre') ?? '');
  }, [searchParams]);

  // Sauvegarder le scroll à chaque mouvement
  useEffect(() => {
    const saveScroll = () => sessionStorage.setItem('explore_scroll', String(window.scrollY));
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => window.removeEventListener('scroll', saveScroll);
  }, []);

  // Restaurer la position de scroll au retour
  useEffect(() => {
    if (loading) return;
    const saved = sessionStorage.getItem('explore_scroll');
    if (!saved) return;
    const y = parseInt(saved);
    sessionStorage.removeItem('explore_scroll');

    // Next.js App Router peut réinitialiser le scroll après le rendu.
    // On verrouille la position pendant 800ms en écoutant chaque scroll vers 0.
    let done = false;
    const lock = () => {
      if (!done && window.scrollY < y / 2) {
        window.scrollTo({ top: y, behavior: 'instant' });
      }
    };
    window.addEventListener('scroll', lock, { passive: true });

    // Premiers essais rapides pour le cas où tout est déjà en place
    const t1 = setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 50);
    const t2 = setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 150);
    const t3 = setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 400);
    const cleanup = setTimeout(() => {
      done = true;
      window.removeEventListener('scroll', lock);
    }, 800);

    return () => {
      done = true;
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(cleanup);
      window.removeEventListener('scroll', lock);
    };
  }, [loading]);

  /**
   * Le filet : l'administrateur, et le cas où le serveur n'a rien rendu.
   *
   * `getPublicSheetIndex` avale ses erreurs et rend un tableau vide quand Firebase
   * Admin est indisponible — identifiants absents, quota. Sans ce repli, le
   * catalogue serait alors **vide**, alors qu'il se lisait jusqu'ici depuis le
   * navigateur avec les clés publiques. On garde donc l'ancien chemin comme
   * secours : la page dégrade au lieu de disparaître.
   */
  const serveurMuet = initialSheets.length === 0;

  useEffect(() => {
    if (authLoading || (!isAdmin && !serveurMuet)) return;

    setLoading(true);
    async function loadSheets() {
      try {
        const db = getDb();
        // L'administrateur voit aussi les grilles privées et à valider ; le
        // secours, lui, se limite au catalogue public comme n'importe quel
        // visiteur.
        const q = isAdmin
          ? query(collection(db, 'sheets'), limit(500))
          : query(collection(db, 'sheets'), where('isPublic', '==', true), limit(200));

        const snapshot = await getDocs(q);
        const loadedSheets: Sheet[] = snapshot.docs.map((docSnap) =>
          fromFirestore(docSnap.id, docSnap.data())
        );

        /**
         * Les copies de groupe sortent du catalogue, **y compris pour un
         * administrateur**.
         *
         * Sa vue élargie sert à moderer les grilles privées, pas à voir des doublons :
         * les compter fausse le nombre de versions d'un morceau, et l'empêche de
         * juger sa propre page. Une grille de groupe se modère depuis son groupe.
         */
        setSheets(sansCopiesDeGroupe(loadedSheets));
      } catch (error) {
        console.error('Error loading sheets:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSheets();
  }, [isAdmin, authLoading, serveurMuet]);

  const handleAdminDelete = async (sheetId: string) => {
    if (!confirm(t('confirmDeleteSheet'))) return;
    try {
      const db = getDb();
      await deleteDoc(doc(db, 'sheets', sheetId));
      setSheets(prev => prev.filter(s => s.id !== sheetId));
    } catch (error) {
      console.error('Error deleting sheet:', error);
      alert(t('errorDelete'));
    }
  };

  // Filtrer, trier, puis grouper par titre+artiste (une entrée par musique)
  const filteredSheets = useMemo(() => {
    let result = [...sheets];

    // Toggles admin : masquer les catégories désactivées (publiques / privées / à valider).
    if (isAdmin && (!showPublic || !showPrivate || !showPending)) {
      result = result.filter((sheet) => {
        if (sheet.isPublic) return showPublic;
        return sheet.pendingValidation ? showPending : showPrivate;
      });
    }

    // Filtre texte
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (sheet) =>
          sheet.title.toLowerCase().includes(q) ||
          sheet.artist.toLowerCase().includes(q) ||
          sheet.ownerName.toLowerCase().includes(q) ||
          sheet.key.toLowerCase().includes(q)
      );
    }

    // Jouables avec les accords annoncés par le hero.
    if (accordsConnus.length > 0) {
      result = jouablesAvec(result.map((sheet) => ({ sheet, chords: sheet.chords })), accordsConnus)
        .map((x) => x.sheet);
    }

    // Filtre par accord (admin uniquement)
    if (isAdmin && chordQuery.trim()) {
      result = result.filter((sheet) => sheetHasChord(sheet, chordQuery));
    }

    // Filtre par genre
    if (selectedGenre) {
      result = result.filter((sheet) =>
        sheet.genres?.includes(selectedGenre)
      );
    }

    // Filtre par difficulté
    if (selectedDifficulty) {
      result = result.filter((sheet) => sheet.difficulty === selectedDifficulty);
    }

    // Fenêtre de fraîcheur.
    if (depuisJours) {
      const limite = maintenant - depuisJours * 86_400_000;
      result = result.filter((sheet) => sheet.createdAt.getTime() >= limite);
    }

    // Filtre par tonalité, posé par les tuiles thématiques.
    if (selectedKey) {
      const k = selectedKey.toLowerCase();
      result = result.filter((sheet) => sheet.key.trim().toLowerCase() === k);
    }

    // Filtre par décennie (année dans [decade, decade+10[)
    if (selectedDecade) {
      result = result.filter((sheet) => sheet.year != null && sheet.year >= selectedDecade && sheet.year < selectedDecade + 10);
    }

    // Tri
    switch (sortBy) {
      case 'rated':
        result.sort((a, b) => {
          const ratingA = a.averageRating || 0;
          const ratingB = b.averageRating || 0;
          if (ratingB !== ratingA) return ratingB - ratingA;
          return (b.ratingCount || 0) - (a.ratingCount || 0);
        });
        break;
      case 'viewed':
        result.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        break;
      case 'recent':
      default:
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
    }

    return result;
  }, [sheets, searchQuery, selectedGenre, selectedDifficulty, selectedDecade, selectedKey, depuisJours, maintenant, sortBy, isAdmin, showPublic, showPrivate, showPending, chordQuery, accordsConnus]);

  // Décennies effectivement présentes dans les grilles (pour ne pas encombrer le menu)
  const availableDecades = useMemo(() => {
    const set = new Set<number>();
    for (const s of sheets) if (s.year != null) set.add(Math.floor(s.year / 10) * 10);
    return Array.from(set).sort((a, b) => b - a);
  }, [sheets]);

  // Grouper par titre+artiste → une seule entrée par musique
  // Le regroupement vivait ici en double du module partagé, et les deux avaient
  // deja diverge : celui-ci ignorait la meilleure note des versions.
  const groupedResults = useMemo(() => groupSheetsBySong(filteredSheets), [filteredSheets]);

  /**
   * Combien de cartes du catalogue sont rendues.
   *
   * Quarante-huit au premier affichage : de quoi remplir plusieurs écrans et
   * donner aux moteurs de quoi lire, sans payer cent trente vignettes dont les
   * dernières ne sont atteintes qu'après six défilements. Le reste est déjà en
   * mémoire — dévoiler un lot ne demande rien au serveur.
   */
  const [montrees, setMontrees] = useState(LOT);

  // Un nouveau résultat repart du premier lot : garder le compte d'avant ferait
  // afficher cent cartes pour une recherche qui n'en rend que trois.
  useEffect(() => { setMontrees(LOT); }, [groupedResults]);

  // Réinitialiser les filtres
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGenre('');
    setSelectedDifficulty(null);
    // La décennie, la tonalité et les accords vivent dans l'URL : c'est le
    // `router.replace` de fin qui les efface, pas un setter.
    setSortBy('recent');
    setShowPublic(true);
    setShowPrivate(true);
    setShowPending(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_SHOW_PUBLIC_KEY, '1');
      localStorage.setItem(ADMIN_SHOW_PRIVATE_KEY, '1');
      localStorage.setItem(ADMIN_SHOW_PENDING_KEY, '1');
    }
    router.replace('/explore', { scroll: false });
  };

  /**
   * Deux notions, longtemps confondues sous un seul nom.
   *
   * **Chercher**, c'est réduire le catalogue à ce qu'on veut : un mot, un genre,
   * un niveau, une décennie, une tonalité, des accords. Là, la découverte n'a
   * plus lieu d'être — on ne flâne plus.
   *
   * **Régler l'affichage**, c'est autre chose : changer l'ordre de tri, ou, pour
   * un administrateur, masquer les grilles privées le temps d'une revue. Cela ne
   * réduit rien de ce qu'on cherche, et cela ne devrait donc rien cacher.
   *
   * Les deux étaient mêlées, et les bascules d'administration sont mémorisées
   * dans `localStorage` : un administrateur qui avait décoché « à valider » une
   * fois ne revoyait plus jamais ni les rayons ni les tuiles, sans qu'aucun
   * filtre ne soit visible à l'écran pour l'expliquer.
   */
  const rechercheEnCours = Boolean(
    accordsConnus.length > 0 || selectedKey || depuisJours || searchQuery || selectedGenre || selectedDifficulty || selectedDecade,
  );
  /** Y a-t-il quoi que ce soit à réinitialiser ? Le tri et les bascules comptent ici. */
  const hasActiveFilters = rechercheEnCours || sortBy !== 'recent' || !showPublic || !showPrivate || !showPending;

  const handleRandom = () => {
    if (sheets.length === 0) return;
    const random = sheets[Math.floor(Math.random() * sheets.length)];
    router.push(`/sheet/${random.id}`);
  };

  return (
    <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-8">
      <WelcomeBanner />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ink)]">{t('title')}</h1>
        <p className="text-[var(--ink-light)] mt-1">
          {t('subtitle')}
          {sheets.length > 0 && ` ${t('subtitleCount', { count: sheets.length })}`}
          {groupedResults.length > 0 && groupedResults.length < sheets.length && ` · ${t('subtitleUniqueTitles', { count: groupedResults.length })}`}
        </p>
      </div>

      {/*
        La découverte s'efface dès qu'on filtre : à ce moment-là on cherche
        quelque chose, et des rayons entre la recherche et ses résultats
        n'apporteraient que de la distance.
      */}
      {!rechercheEnCours && decouverte}

      {/* Barre de recherche et filtres */}
      <div className="space-y-4 mb-8">
        {/* Recherche */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              type="search"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <button
            onClick={handleRandom}
            disabled={sheets.length === 0}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)] text-sm text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
            title={t('randomTitle')}
          >
            {t('random')}
          </button>
        </div>

        {/* Filtres et tri */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tri */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
              <button
                onClick={() => handleSortBy('recent')}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--cell-hover)]'
                }`}
              >
                {t('sortRecent')}
              </button>
              <button
                onClick={() => handleSortBy('rated')}
                className={`px-3 py-1.5 text-sm border-l border-[var(--line)] transition-colors ${
                  sortBy === 'rated'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--cell-hover)]'
                }`}
              >
                {t('sortRated')}
              </button>
              <button
                onClick={() => handleSortBy('viewed')}
                className={`px-3 py-1.5 text-sm border-l border-[var(--line)] transition-colors ${
                  sortBy === 'viewed'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--cell-hover)]'
                }`}
              >
                {t('sortViewed')}
              </button>
            </div>
          </div>

          {/* Séparateur */}
          <div className="hidden sm:block h-6 w-px bg-[var(--line)]" />

          {/* Genre */}
          <select
            value={selectedGenre}
            onChange={(e) => handleGenre(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm bg-[var(--cell-bg)]
              text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">{t('allGenres')}</option>
            {GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genreLabel(genre)}
              </option>
            ))}
          </select>

          {/* Difficulté */}
          <select
            value={selectedDifficulty ?? ''}
            onChange={(e) => handleDifficulty(e.target.value ? Number(e.target.value) as Difficulty : null)}
            className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm bg-[var(--cell-bg)]
              text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">{t('allDifficulties')}</option>
            {DIFFICULTY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{difficultyLabel(label)}</option>
            ))}
          </select>

          {/* Décennie (affiché seulement s'il y a des années renseignées) */}
          {availableDecades.length > 0 && (
            <select
              value={selectedDecade ?? ''}
              onChange={(e) => handleDecade(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm bg-[var(--cell-bg)]
                text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">{t('allYears')}</option>
              {availableDecades.map((d) => (
                <option key={d} value={d}>{`${d}s`}</option>
              ))}
            </select>
          )}

          {/* Toggles admin : visibilité des grilles privées / à valider */}
          {isAdmin && (
            <>
              <div className="hidden sm:block h-6 w-px bg-[var(--line)]" />
              <input
                type="search"
                value={chordQuery}
                onChange={(e) => setChordQuery(e.target.value)}
                placeholder={t('adminChordSearchPlaceholder')}
                title={t('adminChordSearchTitle')}
                className="w-36 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)] text-sm font-mono text-[var(--ink)] placeholder:text-[var(--ink-faint)] placeholder:font-sans focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={toggleShowPublic}
                title={t('adminTogglePublicTitle')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  showPublic
                    ? 'border-green-500 bg-green-500/10 text-green-600'
                    : 'border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink-faint)] line-through'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                {t('adminTogglePublic')}
              </button>
              <button
                onClick={toggleShowPrivate}
                title={t('adminTogglePrivateTitle')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  showPrivate
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink-faint)] line-through'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                {t('adminTogglePrivate')}
              </button>
              <button
                onClick={toggleShowPending}
                title={t('adminTogglePendingTitle')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  showPending
                    ? 'border-amber-500 bg-amber-500/10 text-amber-600'
                    : 'border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink-faint)] line-through'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                {t('adminTogglePending')}
              </button>
            </>
          )}

          {/* Réinitialiser */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-[var(--accent)] hover:underline"
            >
              {t('reset')}
            </button>
          )}
        </div>
      </div>

      {/* Résultats. L'ancre est la destination des « tout voir » des rayons :
          sans elle, le bouton changeait le tri et laissait le lecteur en haut de
          page, devant les mêmes vignettes. */}
      <div id="catalogue" className="scroll-mt-20" />
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-[var(--line)] animate-pulse bg-[var(--cell-bg)]">
              <div className="aspect-square bg-[var(--line)]/40" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-[var(--line)]/40 rounded w-3/4" />
                <div className="h-2.5 bg-[var(--line)]/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : groupedResults.length > 0 ? (
        <>
          {hasActiveFilters && (
            <p className="text-sm text-[var(--ink-light)] mb-4">
              {t('resultsCount', { count: groupedResults.length })}
              {filteredSheets.length > groupedResults.length && ` ${t('resultsVersions', { count: filteredSheets.length })}`}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {groupedResults.slice(0, montrees).map(({ sheet, count, href, bestRating }) => (
              <SheetCard
                /* `songKey` et non une concaténation : « Fade — Away » et
                   « Fade Away — » donnaient la même clé, et React confondait
                   alors deux morceaux distincts. */
                key={songKey(sheet.title, sheet.artist)}
                sheet={sheet}
                showOwner
                showPublicBadge={isAdmin}
                href={href}
                variantCount={count}
                ratingOverride={bestRating}
                isBookmarked={sheet.id ? isBookmarked(sheet.id) : false}
                onToggleBookmark={user && sheet.id ? () => toggleBookmark(sheet.id!) : undefined}
                onDelete={isAdmin && sheet.id ? () => handleAdminDelete(sheet.id!) : undefined}
              />
            ))}
          </div>

          {/*
            Le catalogue se dévoile par lots.
            Les cent trente cartes étaient rendues d'un bloc : le HTML servi
            pesait 647 ko, dont l'essentiel pour des vignettes qu'on n'atteint
            qu'après six écrans de défilement. Un premier lot suffit à ce qu'un
            moteur voie des morceaux et à ce qu'un visiteur ait de quoi lire ;
            la suite est déjà en mémoire et s'affiche sans rien redemander.
          */}
          {groupedResults.length > montrees && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setMontrees((n) => n + LOT)}
                className="cursor-pointer px-5 py-2.5 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]
                  text-sm text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {t('showMore', { count: groupedResults.length - montrees })}
              </button>
            </div>
          )}
        </>
      ) : sheets.length > 0 ? (
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-8 text-center">
          <div className="text-[var(--ink-faint)]">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg">{t('noResultsForQuery', { query: searchQuery })}</p>
            <p className="text-sm mt-1">{t('noResultsHint')}</p>
            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-[var(--ink-light)] border border-[var(--line)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {t('reset')}
              </button>
              <a
                href={`/sheet/new`}
                className="px-4 py-2 text-sm text-white bg-[var(--accent)] rounded-lg hover:bg-[#a83d25] transition-colors"
              >
                {t('createThisSheet')}
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-8 text-center">
          <div className="text-[var(--ink-faint)]">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-lg">{t('noPublicSheetsYet')}</p>
            <p className="text-sm mt-1">{t('beFirstToShare')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
