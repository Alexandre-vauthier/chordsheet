import type { Sheet } from '@/types';

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
        ? `/sheet/${group[0].id}`
        : `/song/${encodeURIComponent(group[0].title)}/${encodeURIComponent(group[0].artist || '')}`,
  }));
}
