/**
 * Avec quoi un accord se joue vraiment, dans le catalogue.
 *
 *     G  se joue avec  C, D, Am, Em, F
 *     Bm se joue avec  G, A, D, Em, F#m
 *
 * C'est la seule matière qui distingue une page d'accord d'une autre sans que
 * personne ait à l'écrire. Les 1 424 pages d'accord partagent un gabarit dont
 * seules les variables changent — même diagramme, même structure, même nombre de
 * mots à l'unité près — et la seule section qui pouvait les différencier, « des
 * chansons à jouer avec cet accord », est vide pour 1 289 d'entre elles.
 *
 * Ce voisinage-là, lui, se déduit de ce qui est déjà en base, se met à jour tout
 * seul quand le catalogue grossit, et aucun site d'accords ne l'a — parce qu'il
 * suppose d'avoir des grilles derrière.
 *
 * **Pas de chiffres à l'affichage, un ordre.** Le calcul travaille sur un
 * échantillon borné (voir `getSheetsWithChord`), et non sur le catalogue entier :
 * annoncer « C, 49 fois » deviendrait faux le jour où le plafond mord. L'ordre,
 * lui, reste juste — c'est la propriété qu'on tient.
 */

/** Ce qu'il faut d'une grille pour en tirer un voisinage. */
export interface GrilleAccords {
  chords?: string[];
}

/**
 * Les accords qui accompagnent le plus souvent celui-ci, du plus fréquent au moins.
 *
 * L'accord lui-même est écarté, et les doublons d'une même grille ne comptent qu'une
 * fois : trois cellules de G dans un morceau ne font pas trois voisinages.
 *
 * À égalité, l'ordre alphabétique tranche — sans quoi la liste changerait d'un rendu
 * à l'autre au gré de l'ordre de lecture de Firestore, et la page ne serait jamais
 * deux fois la même pour un moteur.
 */
export function accordsVoisins(
  grilles: GrilleAccords[],
  accord: string,
  combien = 5,
): string[] {
  const cible = accord.trim().toLowerCase();
  if (!cible) return [];

  const frequence = new Map<string, number>();
  for (const g of grilles) {
    const accords = new Set((g.chords ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean));
    if (!accords.has(cible)) continue;
    for (const a of accords) {
      if (a === cible) continue;
      frequence.set(a, (frequence.get(a) ?? 0) + 1);
    }
  }

  return [...frequence.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, combien)
    .map(([a]) => a);
}
