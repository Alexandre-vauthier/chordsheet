/**
 * Ce qui fait partie du catalogue public.
 *
 * Ce qui en est écarté, c'est la **copie** qu'un groupe s'est faite d'une grille
 * existante. Trois groupes qui reprennent le même morceau, et le catalogue affichait
 * quatre fois la même chanson dont trois versions identiques : du bruit pour tout le
 * monde, et l'auteur d'origine y perdait la visibilité de sa grille.
 *
 * Mais **une grille écrite dans un groupe n'est pas une copie**. C'est une œuvre
 * comme une autre, souvent la seule version qui existe. La première version de cette
 * règle écartait tout ce qui portait un `groupId` : sur le catalogue réel, cela
 * cachait dix-sept grilles originales pour cinq vraies copies. Le marqueur juste est
 * `forkedFrom`, pas l'appartenance à un groupe.
 *
 * Une copie reste consultable : par les membres du groupe, et sur la vitrine
 * publique si le groupe en a une. Ce sont ses deux places légitimes.
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
  /** Grille dont celle-ci est la copie, le cas échéant. */
  forkedFrom?: string | null;
}

/**
 * La grille est-elle la copie qu'un groupe s'est faite d'une autre ?
 *
 * Les deux conditions comptent. Sans `groupId`, c'est une reprise personnelle, que
 * son auteur a le droit de publier. Sans `forkedFrom`, c'est une création du groupe,
 * et rien ne justifie de la cacher.
 *
 * Distincte de `estAuCatalogue` : certains écrans décident déjà de la visibilité
 * autrement (un administrateur voit les grilles privées, un auteur voit les siennes)
 * et n'ont besoin que d'écarter les doublons.
 *
 * Limite assumée : si l'original disparaît ou repasse en privé, sa copie reste
 * écartée alors qu'elle devient la seule version. Le vérifier demanderait une lecture
 * par grille, pour un cas rare et sans conséquence — elle reste lisible depuis le
 * groupe et sa vitrine.
 */
export function estCopieDeGroupe(sheet: CatalogueCandidate): boolean {
  return !!sheet.groupId && !!sheet.forkedFrom;
}

/** Écarte les copies de groupe, sans rien décider de la visibilité. */
export function sansCopiesDeGroupe<T extends CatalogueCandidate>(sheets: T[]): T[] {
  return sheets.filter((s) => !estCopieDeGroupe(s));
}

/** La grille a-t-elle sa place dans le catalogue public ? */
export function estAuCatalogue(sheet: CatalogueCandidate): boolean {
  return sheet.isPublic === true && !estCopieDeGroupe(sheet);
}

/** Ne garde que les grilles du catalogue public. */
export function filtrerCatalogue<T extends CatalogueCandidate>(sheets: T[]): T[] {
  return sheets.filter(estAuCatalogue);
}
