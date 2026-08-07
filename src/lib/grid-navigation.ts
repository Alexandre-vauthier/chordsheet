/**
 * Se déplacer de cellule en cellule dans une section, au clavier.
 *
 * Une **ligne** est une suite de mesures (quatre quand elle est pleine, voir
 * `MESURES_PAR_LIGNE`), et une **cellule** est une mesure. Les flèches gauche et
 * droite parcourent donc les mesures, haut et bas changent de ligne.
 *
 * Le déplacement s'arrête aux bords de la section et ne crée jamais rien : une
 * flèche ne doit pas modifier la grille. C'est Tab, et lui seul, qui ajoute une
 * mesure quand on sort par la fin.
 *
 * La navigation reste **dans la section** volontairement. En vue déroulée une même
 * section peut être affichée plusieurs fois, et les cellules de ses passages
 * portent le même identifiant ; franchir une frontière y renverrait sur le premier
 * passage, c'est-à-dire ailleurs à l'écran que là où la flèche pointe.
 */

export type Direction = 'left' | 'right' | 'up' | 'down';

export interface PositionCellule {
  rowIndex: number;
  cellIndex: number;
}

/**
 * La cellule voisine, ou `null` s'il n'y en a pas dans cette direction.
 *
 * `longueurs` donne le nombre de mesures de chaque ligne. Il est nécessaire :
 * couper et fusionner rendent les lignes inégales, et descendre d'une ligne de
 * quatre mesures vers une ligne de deux doit tomber sur la dernière mesure de
 * celle-ci, pas dans le vide.
 */
export function deplacer(
  longueurs: number[],
  depuis: PositionCellule,
  direction: Direction,
): PositionCellule | null {
  const { rowIndex, cellIndex } = depuis;
  if (rowIndex < 0 || rowIndex >= longueurs.length) return null;

  const surLigne = (cible: number): PositionCellule | null => {
    if (cible < 0 || cible >= longueurs.length) return null;
    if (longueurs[cible] <= 0) return null;
    // On garde la colonne, à défaut la dernière mesure de la ligne visée.
    return { rowIndex: cible, cellIndex: Math.min(cellIndex, longueurs[cible] - 1) };
  };

  switch (direction) {
    case 'right':
      if (cellIndex + 1 < longueurs[rowIndex]) return { rowIndex, cellIndex: cellIndex + 1 };
      return longueurs[rowIndex + 1] > 0 ? { rowIndex: rowIndex + 1, cellIndex: 0 } : null;

    case 'left':
      if (cellIndex > 0) return { rowIndex, cellIndex: cellIndex - 1 };
      return longueurs[rowIndex - 1] > 0
        ? { rowIndex: rowIndex - 1, cellIndex: longueurs[rowIndex - 1] - 1 }
        : null;

    case 'down':
      return surLigne(rowIndex + 1);

    case 'up':
      return surLigne(rowIndex - 1);
  }
}
