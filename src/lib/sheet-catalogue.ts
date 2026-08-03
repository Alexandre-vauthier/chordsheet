/**
 * Ce qui fait partie du catalogue public.
 *
 * Une grille rattachée à un groupe n'en fait **pas** partie, même publique. Rattacher
 * une grille en crée une copie : trois groupes qui reprennent le même morceau, et le
 * catalogue affiche quatre fois la même chanson, dont trois versions identiques qui
 * ne sont là que parce qu'un groupe les a récupérées. C'est du bruit pour tout le
 * monde, et l'auteur d'origine y perd la visibilité de sa grille.
 *
 * Une grille de groupe reste consultable : par les membres du groupe, et sur la
 * vitrine publique si le groupe en a une. Ce sont ses deux places légitimes.
 *
 * Le contrôle se fait en mémoire plutôt que dans la requête : Firestore ne sait pas
 * filtrer sur l'absence d'un champ (`where('groupId', '==', null)` ne remonte que les
 * documents où il vaut explicitement `null`, pas ceux où il manque), et un champ
 * dénormalisé de plus obligerait à créer autant d'index composites et à reprendre
 * tout l'existant. Le volume écarté est marginal.
 */

interface CatalogueCandidate {
  isPublic?: boolean;
  groupId?: string | null;
}

/** La grille a-t-elle sa place dans le catalogue public ? */
export function estAuCatalogue(sheet: CatalogueCandidate): boolean {
  return sheet.isPublic === true && !sheet.groupId;
}

/** Ne garde que les grilles du catalogue public. */
export function filtrerCatalogue<T extends CatalogueCandidate>(sheets: T[]): T[] {
  return sheets.filter(estAuCatalogue);
}
