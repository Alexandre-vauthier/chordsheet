import type { BadgeId, BadgeDefinition, CreatorLevel } from '@/types';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const LEVEL_THRESHOLDS: Record<CreatorLevel, number> = {
  'Découvreur':  0,
  'Contributeur': 50,
  'Référence':   200,
  'Maître':      600,
};

export const LEVEL_ORDER: CreatorLevel[] = ['Découvreur', 'Contributeur', 'Référence', 'Maître'];

export const BADGE_DEFINITIONS: Record<BadgeId, BadgeDefinition> = {
  first_bookmark:  { id: 'first_bookmark',  icon: '🔖', label: 'Premier favori',     description: 'Une de vos grilles a été mise en favori pour la première fois' },
  bookmark_10:     { id: 'bookmark_10',     icon: '⭐', label: '10 favoris',          description: '10 favoris reçus au total sur vos grilles publiques' },
  bookmark_50:     { id: 'bookmark_50',     icon: '🌟', label: '50 favoris',          description: '50 favoris reçus au total' },
  bookmark_200:    { id: 'bookmark_200',    icon: '💎', label: '200 favoris',         description: '200 favoris reçus au total' },
  first_rating:    { id: 'first_rating',    icon: '🎵', label: 'Première note',       description: 'Une de vos grilles a été notée pour la première fois' },
  rating_10:       { id: 'rating_10',       icon: '🎶', label: '10 évaluations',      description: '10 évaluations reçues au total sur vos grilles publiques' },
  high_quality:    { id: 'high_quality',    icon: '🏆', label: 'Haute qualité',       description: 'Note moyenne ≥ 4.5 sur au moins 5 évaluations' },
  prolific:        { id: 'prolific',        icon: '📚', label: 'Auteur prolifique',   description: '5 grilles publiques ou plus' },
  top_rated_sheet: { id: 'top_rated_sheet', icon: '🎸', label: 'Grille d\'exception', description: 'Une grille avec une note ≥ 4.8 sur au moins 3 évaluations' },
};

/**
 * Poids du score, exportés pour que l'écran qui les explique les lise ici.
 *
 * Les recopier dans une traduction reviendrait à publier un barème qui dérive
 * silencieusement du calcul réel dès qu'on touche à l'un des deux.
 */
export const SCORE_WEIGHTS = {
  /** Points par favori reçu sur une grille publique. */
  bookmark: 10,
  /** Points par évaluation reçue. */
  rating: 5,
  /** Moyenne minimale pour déclencher le bonus de qualité. */
  averageMin: 4.0,
  /** Multiplicateur appliqué à la moyenne quand le seuil est atteint. */
  averageFactor: 5,
} as const;

/** Favoris nécessaires pour gagner un crédit d'analyse. */
export const BOOKMARKS_PER_OCR_CREDIT = 10;

export const MAX_EARNED_OCR_CREDITS = 20;

// ─── Types d'entrée ───────────────────────────────────────────────────────────

export interface SheetStats {
  bookmarkCount: number;
  ratingCount: number;
  averageRating: number | null;
  isPublic: boolean;
}

// ─── Fonctions pures ──────────────────────────────────────────────────────────

function getPublicSheets(sheets: SheetStats[]): SheetStats[] {
  return sheets.filter(s => s.isPublic);
}

export function computeScore(sheets: SheetStats[]): number {
  const pub = getPublicSheets(sheets);
  const totalBookmarks = pub.reduce((acc, s) => acc + (s.bookmarkCount || 0), 0);
  const totalRatings   = pub.reduce((acc, s) => acc + s.ratingCount, 0);
  const totalRatingWeighted = pub.reduce((acc, s) => acc + s.ratingCount * (s.averageRating ?? 0), 0);
  const globalAvg = totalRatings > 0 ? totalRatingWeighted / totalRatings : 0;
  return (
    totalBookmarks * SCORE_WEIGHTS.bookmark +
    totalRatings   * SCORE_WEIGHTS.rating +
    (globalAvg >= SCORE_WEIGHTS.averageMin ? globalAvg * SCORE_WEIGHTS.averageFactor : 0)
  );
}

export function computeLevel(score: number): CreatorLevel {
  let level: CreatorLevel = 'Découvreur';
  for (const l of LEVEL_ORDER) {
    if (score >= LEVEL_THRESHOLDS[l]) level = l;
  }
  return level;
}

export function computeBadges(sheets: SheetStats[]): BadgeId[] {
  const pub = getPublicSheets(sheets);
  const totalBookmarks = pub.reduce((acc, s) => acc + (s.bookmarkCount || 0), 0);
  const totalRatings   = pub.reduce((acc, s) => acc + s.ratingCount, 0);
  const totalRatingWeighted = pub.reduce((acc, s) => acc + s.ratingCount * (s.averageRating ?? 0), 0);
  const globalAvg = totalRatings > 0 ? totalRatingWeighted / totalRatings : 0;

  const badges: BadgeId[] = [];
  if (totalBookmarks >= 1)   badges.push('first_bookmark');
  if (totalBookmarks >= 10)  badges.push('bookmark_10');
  if (totalBookmarks >= 50)  badges.push('bookmark_50');
  if (totalBookmarks >= 200) badges.push('bookmark_200');
  if (totalRatings >= 1)     badges.push('first_rating');
  if (totalRatings >= 10)    badges.push('rating_10');
  if (globalAvg >= 4.5 && totalRatings >= 5) badges.push('high_quality');
  if (pub.length >= 5)       badges.push('prolific');
  if (pub.some(s => (s.averageRating ?? 0) >= 4.8 && s.ratingCount >= 3)) badges.push('top_rated_sheet');
  return badges;
}

export function computeEarnedOcrCredits(sheets: SheetStats[]): number {
  const totalBookmarks = getPublicSheets(sheets).reduce((acc, s) => acc + (s.bookmarkCount || 0), 0);
  return Math.min(Math.floor(totalBookmarks / BOOKMARKS_PER_OCR_CREDIT), MAX_EARNED_OCR_CREDITS);
}

export function getLevelProgress(score: number): {
  current: CreatorLevel;
  next: CreatorLevel | null;
  progressPct: number;
} {
  const current = computeLevel(score);
  const currentIdx = LEVEL_ORDER.indexOf(current);
  const next = currentIdx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[currentIdx + 1] : null;

  if (!next) return { current, next: null, progressPct: 100 };

  const from = LEVEL_THRESHOLDS[current];
  const to   = LEVEL_THRESHOLDS[next];
  const progressPct = Math.min(100, Math.round(((score - from) / (to - from)) * 100));
  return { current, next, progressPct };
}
