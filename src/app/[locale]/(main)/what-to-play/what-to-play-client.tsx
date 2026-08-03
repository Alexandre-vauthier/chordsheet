'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { artworkKey, useArtwork } from '@/lib/use-artwork';
import { playPreviewAudio, stopPreviewAudio } from '@/lib/preview-audio';
import { Link } from '@/i18n/navigation';
import { useGenreLabel, useDifficultyLabel } from '@/lib/use-genre-labels';
import { DIFFICULTY_LABELS } from '@/types';

export interface Candidate {
  id: string;
  title: string;
  artist: string;
  genres: string[];
  difficulty: number | null;
}

/** Mélange de Fisher-Yates : chaque ordre est également probable. */
function melanger<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Un extrait est demandé d'avance pour le morceau suivant.
 *
 * Le hook met en cache ce qu'il rapporte (mémoire puis `localStorage`) : le
 * demander ici, sans rien afficher, rend le clic sur « suivant » instantané au lieu
 * d'attendre un aller-retour vers iTunes.
 */
function Prechargement({ candidate }: { candidate: Candidate | null }) {
  useArtwork(candidate?.artist, candidate?.title);
  return null;
}

/**
 * Le lecteur de découverte.
 *
 * Rien ne démarre tout seul : les navigateurs refusent le son tant qu'on n'a pas
 * cliqué, et un bouton qui ne fait rien serait pire que pas de bouton. Le premier
 * clic lance la file, les suivants sont eux-mêmes des clics.
 *
 * L'enchaînement automatique à la fin d'un extrait a un garde-fou : si la lecture
 * s'est arrêtée en moins d'une seconde et demie, c'est qu'elle a échoué et non
 * qu'elle est allée au bout. Sans ce contrôle, un refus du navigateur ferait défiler
 * le catalogue entier en silence.
 */
const DUREE_MINIMALE_MS = 1500;

/**
 * Sauts consécutifs tolérés sans extrait avant d'éteindre la radio.
 *
 * Un morceau introuvable chez iTunes est passé automatiquement. Sans plafond, un
 * catalogue dont aucun titre n'aurait d'extrait défilerait indéfiniment.
 */
const MAX_SAUTS = 10;

export function WhatToPlayClient({ candidates }: { candidates: Candidate[] }) {
  const t = useTranslations('WhatToPlay');
  const genreLabel = useGenreLabel();
  const difficultyLabel = useDifficultyLabel();

  /**
   * Deux filtres, pas plus.
   *
   * « Je ne sais pas quoi jouer » s'accommode mal d'un formulaire : chaque champ
   * ramène la question à laquelle la page est censée répondre. Le genre et le niveau
   * sont les deux seuls qui écartent vraiment ce qu'on ne jouera pas — on ne va pas
   * proposer un morceau avancé à quelqu'un qui débute.
   */
  const [genre, setGenre] = useState('');
  const [niveau, setNiveau] = useState<number | null>(null);

  const retenus = useMemo(() => candidates.filter((c) =>
    (!genre || c.genres.includes(genre)) &&
    (niveau === null || c.difficulty === niveau),
  ), [candidates, genre, niveau]);

  // Changer de filtre retire la file : on retire un nouveau tirage plutôt que de
  // reprendre au même endroit dans une liste qui n'est plus la même.
  const file = useMemo(() => melanger(retenus), [retenus]);
  const [index, setIndex] = useState(0);
  const [enLecture, setEnLecture] = useState(false);
  /**
   * La radio tourne : chaque morceau enchaîne sur le suivant.
   *
   * Il fallait recliquer à chaque extrait, ce qui vidait la page de son intérêt —
   * on vient justement pour se laisser porter. Le premier clic reste obligatoire,
   * les navigateurs refusant le son sans lui ; ensuite le geste initial suffit.
   */
  const [continu, setContinu] = useState(false);
  const debutRef = useRef(0);
  const sautsRef = useRef(0);
  const lectureRef = useRef(0);

  /**
   * Le tirage a changé sous les pieds : on repart du début.
   *
   * Et surtout **le son suit**. Changer de filtre remplaçait la pochette sans rien
   * faire de la lecture en cours : on voyait un morceau et on en entendait un autre.
   * On coupe donc, en invalidant le jeton pour que le rappel du lecteur ne soit pas
   * pris pour une fin de morceau, et la radio — si elle tournait — repart sur le
   * premier du nouveau tirage.
   */
  useEffect(() => {
    lectureRef.current += 1;
    stopPreviewAudio();
    setEnLecture(false);
    sautsRef.current = 0;
    setIndex(0);
  }, [file]);

  const courant = file[index] ?? null;
  const suivant = file[index + 1] ?? null;

  const { artworkUrl, previewUrl, trackUrl, year, key } = useArtwork(courant?.artist, courant?.title);

  /**
   * Les valeurs décrivent-elles bien le morceau affiché ?
   *
   * Le hook met un rendu à se mettre à jour : dans le rendu qui suit un changement
   * de morceau, il rend encore l'extrait du précédent. Comparer sa clé à celle qu'on
   * attend est la seule façon fiable de le savoir, les deux venant du même rendu.
   */
  const genresDisponibles = useMemo(() => {
    const vus = new Map<string, number>();
    for (const c of candidates) for (const g of c.genres) vus.set(g, (vus.get(g) ?? 0) + 1);
    return [...vus.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [candidates]);

  const attendue = courant ? artworkKey(courant.artist, courant.title) : '';
  const pret = !!attendue && key === attendue;

  const arreter = useCallback(() => {
    lectureRef.current += 1;
    stopPreviewAudio();
    setEnLecture(false);
    setContinu(false);
  }, []);

  useEffect(() => arreter, [arreter]);

  /**
   * Passer au morceau suivant ou précédent.
   *
   * `manuel` distingue le clic de l'enchaînement automatique, et ce n'est pas un
   * détail : le compteur de sauts protège d'un emballement de la machine, pas d'une
   * personne qui parcourt la file. En zappant vite on traversait des morceaux sans
   * extrait, le compteur atteignait son plafond, et la radio s'éteignait toute seule
   * — d'où l'impression qu'aller trop vite l'arrêtait.
   */
  const aller = useCallback((delta: number, manuel = false) => {
    // On invalide la lecture en cours avant de couper : son rappel ne doit pas être
    // pris pour une fin de morceau et faire avancer une seconde fois.
    lectureRef.current += 1;
    stopPreviewAudio();
    setEnLecture(false);
    if (manuel) sautsRef.current = 0;
    setIndex((i) => {
      const n = i + delta;
      if (n < 0) return file.length - 1;
      if (n >= file.length) return 0;
      return n;
    });
  }, [file.length]);

  const lire = useCallback(() => {
    if (!previewUrl || !pret) return;
    setContinu(true);
    setEnLecture(true);
    sautsRef.current = 0;
    debutRef.current = Date.now();

    /**
     * Jeton de lecture.
     *
     * Le lecteur partagé coupe l'extrait en cours avant d'en lancer un autre, et
     * prévient alors son appelant précédent. Sans ce jeton, ce rappel se croyait à
     * la fin d'un morceau et avançait d'un cran de plus : on sautait un titre sur
     * deux et la lecture s'arrêtait de temps en temps.
     */
    const jeton = ++lectureRef.current;

    playPreviewAudio(previewUrl, () => {
      if (lectureRef.current !== jeton) return;
      setEnLecture(false);
      if (Date.now() - debutRef.current > DUREE_MINIMALE_MS) {
        // Fin normale : au suivant, et l'effet ci-dessous le lance.
        aller(1);
      } else {
        // Arrêt immédiat : le navigateur a refusé le son. On éteint la radio plutôt
        // que de traverser le catalogue en silence.
        setContinu(false);
      }
    });
  }, [previewUrl, pret, aller]);

  /**
   * L'enchaînement.
   *
   * Dès qu'un morceau est prêt et que la radio tourne, il part. S'il n'a pas
   * d'extrait, on passe au suivant — c'est fréquent, tous les titres ne sont pas
   * chez iTunes, et s'arrêter là casserait l'enchaînement.
   */
  useEffect(() => {
    if (!continu || enLecture) return;
    // Tant que les valeurs ne décrivent pas ce morceau-ci, il n'y a rien à décider.
    if (!pret) return;
    if (previewUrl) { lire(); return; }
    // Recherche terminée sans extrait : ce morceau n'en a pas, on passe.
    sautsRef.current += 1;
    if (sautsRef.current >= MAX_SAUTS) setContinu(false);
    else aller(1);
  }, [continu, enLecture, pret, previewUrl, lire, aller]);

  // Flèches pour passer d'un morceau à l'autre, barre d'espace pour écouter : on
  // enchaîne vite, et c'est tout l'intérêt de la page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); aller(1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); aller(-1, true); }
      if (e.key === ' ') { e.preventDefault(); if (enLecture) arreter(); else lire(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aller, lire, arreter, enLecture]);

  if (!courant) {
    const filtre = !!genre || niveau !== null;
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="font-playfair text-3xl font-bold text-[var(--ink)]">{t('title')}</h1>
        <p className="mt-3 text-sm text-[var(--ink-light)]">{filtre ? t('emptyFiltered') : t('empty')}</p>
        {filtre && (
          <button
            type="button"
            onClick={() => { setGenre(''); setNiveau(null); }}
            className="mt-3 text-sm text-[var(--accent)] hover:underline cursor-pointer"
          >
            {t('clearFilters')}
          </button>
        )}
        <Link href="/explore" className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium">
          {t('browse')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-center">
        <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[var(--ink)]">{t('title')}</h1>
        <p className="mt-2 text-sm text-[var(--ink-light)] leading-relaxed">{t('subtitle')}</p>
      </div>

      {/* Deux menus discrets plutôt qu'un panneau : ils doivent rester une option,
          pas la première chose qu'on lise sur une page faite pour ne pas choisir. */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          aria-label={t('filterGenre')}
          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]
            text-[var(--ink)] outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          <option value="">{t('allGenres')}</option>
          {genresDisponibles.map((g) => (
            <option key={g} value={g}>{genreLabel(g)}</option>
          ))}
        </select>

        <select
          value={niveau ?? ''}
          onChange={(e) => setNiveau(e.target.value ? Number(e.target.value) : null)}
          aria-label={t('filterLevel')}
          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]
            text-[var(--ink)] outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          <option value="">{t('allLevels')}</option>
          {([1, 2, 3] as const).map((d) => (
            <option key={d} value={d}>{difficultyLabel(DIFFICULTY_LABELS[d])}</option>
          ))}
        </select>

        {(genre || niveau !== null) && (
          <button
            type="button"
            onClick={() => { setGenre(''); setNiveau(null); }}
            className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
          >
            {t('clearFilters')}
          </button>
        )}
      </div>

      {/* La pochette reste le repère visuel : on reconnaît souvent un disque avant
          d'en reconnaître les premières notes. */}
      <button
        type="button"
        onClick={() => (enLecture ? arreter() : lire())}
        disabled={!previewUrl || !pret}
        aria-label={enLecture ? t('stop') : t('play')}
        className="group relative block mx-auto mt-8 w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden
          bg-[var(--cell-bg)] border border-[var(--line)] shadow-xl enabled:cursor-pointer disabled:cursor-default"
      >
        {artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artworkUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-5xl text-[var(--ink-faint)]">♪</span>
        )}

        {/* La commande reste visible en permanence, lecture comme arrêt : le premier
            clic est obligatoire, autant qu'on le voie sans avoir à survoler — et au
            doigt il n'y a pas de survol. Le voile, lui, n'apparaît qu'au survol ou
            pendant la lecture, pour ne pas ternir la pochette en continu. */}
        {previewUrl && (
          <span className={`absolute inset-0 flex items-center justify-center transition-colors ${
            enLecture ? 'bg-black/35' : 'group-hover:bg-black/35'
          }`}>
            <span className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-lg ring-1 ring-black/10">
              {enLecture ? (
                <svg className="w-7 h-7 text-[var(--nav-bg)]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg className="w-7 h-7 ml-1 text-[var(--nav-bg)]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
                </svg>
              )}
            </span>
          </span>
        )}
      </button>

      <div className="mt-6 text-center">
        <p className="font-playfair text-2xl font-bold text-[var(--ink)] leading-tight">{courant.title}</p>
        <p className="text-[var(--ink-light)] mt-1">{courant.artist}{year ? ` · ${year}` : ''}</p>

        {/* Dire pourquoi il ne se passe rien, plutôt que laisser un bouton inerte. */}
        {pret && !previewUrl && (
          <p className="mt-2 text-xs text-[var(--ink-faint)]">{t('noPreview')}</p>
        )}
        {!continu && previewUrl && (
          <p className="mt-2 text-xs text-[var(--ink-faint)]">{t('tapToStart')}</p>
        )}

        {/* Sous la pochette, comme sur la page d'une grille : les conditions de
            l'API iTunes autorisent pochette et extrait pour **promouvoir** le
            catalogue, ce qui suppose d'y renvoyer. Un crédit se lit près de ce
            qu'il crédite, pas relégué en bas de page. */}
        {trackUrl && (
          <a
            href={trackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs text-[var(--ink-light)] underline decoration-dotted
              underline-offset-2 hover:text-[var(--accent)] transition-colors"
          >
            {t('listenOnApple')} ↗
          </a>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => aller(-1, true)}
          aria-label={t('previous')}
          className="w-11 h-11 rounded-full border border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink)]
            flex items-center justify-center hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6h2v12H6zm3 6l9 6V6z" />
          </svg>
        </button>

        <span className="text-xs text-[var(--ink-faint)] tabular-nums w-20 text-center">
          {index + 1} / {file.length}
        </span>

        <button
          type="button"
          onClick={() => aller(1, true)}
          aria-label={t('next')}
          className="w-11 h-11 rounded-full border border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink)]
            flex items-center justify-center hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M16 6h2v12h-2zM6 18l9-6-9-6z" />
          </svg>
        </button>
      </div>

      <Link
        href={`/sheet/${courant.id}`}
        className="mt-8 block w-full text-center px-6 py-3 rounded-lg bg-[var(--accent)] hover:bg-[#a83d25]
          text-white font-medium transition-colors"
      >
        {t('openSheet')}
      </Link>

      {/* Le conseil qui donne envie d'ouvrir la grille.
          Le picto est celui, au trait près, du bouton d'accompagnement du lecteur
          (cf. sheet-viewer) : recopier le glyphe permet de le reconnaître une fois
          sur place, là où une icône approchante ferait chercher. */}
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] px-4 py-3">
        <span className="w-9 h-9 shrink-0 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5" aria-hidden>
            <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </span>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          {t.rich('tipAccompaniment', { b: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong> })}
        </p>
      </div>

      <p className="mt-4 text-center text-[11px] text-[var(--ink-faint)]">{t('shortcuts')}</p>

      <Prechargement candidate={suivant} />
    </div>
  );
}
