import type { GroupRole } from '@/types';

/**
 * Ce que devient la donnée d'un compte supprimé.
 *
 * Les décisions sont ici, en fonctions pures ; la route qui les applique
 * (`/api/account/delete`) ne fait qu'exécuter. C'est de la suppression définitive :
 * une erreur ne se rattrape pas, et un test qui tourne en une milliseconde vaut
 * mieux qu'une relecture attentive.
 *
 * Deux règles décidées avec le propriétaire du produit :
 *
 * - **Les grilles publiques restent, anonymisées.** Elles font le catalogue, et
 *   quelqu'un qui ferme son compte n'emporte pas le travail que d'autres ont mis
 *   dans leur book. Les grilles privées, elles, partent.
 * - **Les conversations dont il est partie prenante partent en entier**, et pas
 *   seulement ses propres messages : un fil de commentaires est une conversation
 *   entre deux personnes, et n'en effacer qu'une moitié laisserait l'autre lire une
 *   question sans destinataire.
 */

/* ── Les groupes ─────────────────────────────────────────────────────────── */

export interface GroupePourSuppression {
  memberIds: string[];
  roles: Record<string, GroupRole>;
}

export type SortDuGroupe =
  | { action: 'supprimer' }
  | { action: 'mettre-a-jour'; memberIds: string[]; roles: Record<string, GroupRole>; ownerId?: string }
  | { action: 'ignorer' };

/**
 * Un groupe survit à celui qui l'a créé.
 *
 * Trois cas, dans cet ordre :
 *
 * 1. **Il était le seul membre** — plus personne, le groupe est supprimé. Le
 *    garder ne ferait qu'une coquille que nul ne peut ouvrir.
 * 2. **Il était le seul leader, mais d'autres restent** — le premier membre restant
 *    est promu. Sans cela le groupe existerait sans personne pour le modifier ni
 *    inviter, ce que les règles Firestore réservent aux leaders : un groupe vivant,
 *    mais figé, et sans aucun moyen de s'en sortir.
 * 3. **Il restait un autre leader** — on le retire, simplement.
 *
 * L'ordre de `memberIds` fait foi pour la promotion : c'est l'ordre d'arrivée dans
 * le groupe, donc le plus ancien membre restant. Rien de plus juste à disposition,
 * et surtout c'est **déterministe** — deux exécutions donnent le même leader.
 *
 * `ownerId` suit la promotion : il porte l'affichage du groupe et sa création, et
 * le laisser sur un compte effacé afficherait un propriétaire fantôme.
 */
export function sortDuGroupe(groupe: GroupePourSuppression, uid: string): SortDuGroupe {
  if (!groupe.memberIds.includes(uid)) return { action: 'ignorer' };

  const restants = groupe.memberIds.filter((id) => id !== uid);
  if (restants.length === 0) return { action: 'supprimer' };

  const roles: Record<string, GroupRole> = {};
  for (const id of restants) roles[id] = groupe.roles?.[id] ?? 'member';

  const ilResteUnLeader = restants.some((id) => roles[id] === 'leader');
  const promu = ilResteUnLeader ? undefined : restants[0];
  if (promu) roles[promu] = 'leader';

  return { action: 'mettre-a-jour', memberIds: restants, roles, ...(promu ? { ownerId: promu } : {}) };
}

/* ── Les notes ───────────────────────────────────────────────────────────── */

/**
 * La note d'une grille, recalculée depuis les avis qui restent.
 *
 * Les grilles portent `averageRating` et `ratingCount` en cache, entretenus à
 * chaque vote. Effacer des notes sans toucher à ce cache le laisserait mentir pour
 * toujours : une grille afficherait « 4,5 sur 12 avis » alors que trois de ces avis
 * n'existent plus.
 *
 * **On recalcule depuis les notes restantes, on ne soustrait pas du cache.** La
 * première version faisait l'inverse : elle reconstituait une somme en multipliant
 * la moyenne stockée par le nombre d'avis. Or cette moyenne est arrondie au dixième
 * à l'écriture, si bien que la somme reconstituée était déjà fausse — un test l'a
 * prise en défaut d'un dixième dès le premier essai. Relire les avis coûte une
 * requête par grille concernée, et rend le résultat exact ; en prime, il répare une
 * dérive antérieure au lieu de la propager.
 *
 * Sans note restante, on revient à `null` — « pas encore noté », qui n'est pas la
 * même chose que « noté zéro » : zéro trierait la grille parmi les mauvaises.
 */
export function noteDe(notes: number[]): { averageRating: number | null; ratingCount: number } {
  const valides = notes.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (valides.length === 0) return { averageRating: null, ratingCount: 0 };

  const moyenne = valides.reduce((s, n) => s + n, 0) / valides.length;
  // Même arrondi qu'à l'écriture d'un vote (`use-ratings`), pour que la valeur
  // recalculée soit exactement celle qu'un vote normal aurait produite.
  return { averageRating: Math.round(moyenne * 10) / 10, ratingCount: valides.length };
}

/* ── Le découpage en lots ────────────────────────────────────────────────── */

/**
 * Firestore refuse un lot de plus de 500 écritures.
 *
 * L'ancienne suppression mettait tout dans un seul `writeBatch` : grilles,
 * setlists, favoris de grilles, favoris de setlists. Un utilisateur assidu passait
 * la barre sans que rien ne l'annonce, et **toute** sa suppression échouait. On
 * garde de la marge sous le plafond, la dernière écriture d'un lot pouvant en
 * entraîner une autre.
 */
export const TAILLE_LOT = 450;

export function enLots<T>(elements: T[], taille = TAILLE_LOT): T[][] {
  const lots: T[][] = [];
  for (let i = 0; i < elements.length; i += taille) lots.push(elements.slice(i, i + taille));
  return lots;
}
