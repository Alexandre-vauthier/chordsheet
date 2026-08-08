import type { Sheet } from '@/types';
import { sheetPath } from '@/lib/sheet-url';

/**
 * Clé de regroupement d'un même morceau, insensible à la casse et aux espaces.
 *
 * Définie ici, et non dans le module qui lit Firestore : ce dernier importe
 * `firebase-admin`, et l'atteindre depuis un composant client tirait tout le SDK
 * serveur dans le paquet du navigateur — le build s'en est chargé de le signaler.
 */
export function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

/**
 * Regroupement des grilles par morceau.
 *
 * Le même morceau peut arriver plusieurs fois dans une même liste : on a dupliqué
 * une grille pour la retravailler, et mis l'originale en favori. Deux entrées
 * distinctes, une seule chanson — l'afficher deux fois donne l'impression d'un
 * doublon alors que ce sont bien deux versions.
 *
 * Extrait de la page Explorer, qui faisait déjà exactement ça, pour que les deux
 * écrans ne divergent pas.
 */
export interface SheetGroup {
  /** Grille représentative : la première de la liste, déjà triée par l'appelant. */
  sheet: Sheet;
  count: number;
  /** Une seule version : la grille. Plusieurs : la page de choix. */
  href: string;
  /**
   * La meilleure note parmi les versions, ou `null` si aucune n'est notée.
   *
   * La carte affichait la note de la grille représentative, choisie par le tri en
   * cours et pas par sa qualité : un morceau bien noté dans une de ses versions
   * pouvait donc se présenter sans aucune note. On montre la meilleure — c'est ce
   * qu'un visiteur trouvera s'il ouvre le morceau.
   *
   * À moyenne égale, celle qui repose sur le plus d'avis : 4,8 sur vingt avis dit
   * davantage que 4,8 sur un seul.
   */
  bestRating: { average: number; count: number } | null;
}

/** Meilleure note d'un ensemble de versions. */
function meilleureNote(sheets: Sheet[]): { average: number; count: number } | null {
  const notees = sheets.filter((s) => s.ratingCount > 0 && s.averageRating !== null);
  if (notees.length === 0) return null;

  const best = notees.reduce((a, b) => {
    const ea = a.averageRating ?? 0;
    const eb = b.averageRating ?? 0;
    if (eb !== ea) return eb > ea ? b : a;
    return b.ratingCount > a.ratingCount ? b : a;
  });
  return { average: best.averageRating!, count: best.ratingCount };
}

export function groupSheetsBySong(sheets: Sheet[]): SheetGroup[] {
  const groups = new Map<string, Sheet[]>();

  for (const sheet of sheets) {
    const key = songKey(sheet.title, sheet.artist || '');
    const existing = groups.get(key);
    if (existing) existing.push(sheet);
    else groups.set(key, [sheet]);
  }

  return [...groups.values()].map((group) => ({
    sheet: group[0],
    count: group.length,
    href:
      group.length === 1
        ? sheetPath(group[0])
        : `/song/${encodeURIComponent(group[0].title)}/${encodeURIComponent(group[0].artist || '')}`,
    bestRating: meilleureNote(group),
  }));
}
