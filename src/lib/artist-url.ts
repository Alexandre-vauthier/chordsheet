import { slugify } from './slug';

/**
 * L'adresse d'un artiste.
 *
 *     avant   /en/artist/Angus%20%26%20Julia%20Stone
 *     après   /en/artist/angus-julia-stone
 *
 * Le nom brut était mis tel quel dans l'URL, donc pourcent-encodé : sur les 214
 * adresses d'artiste du sitemap, 154 portaient au moins une séquence `%xx`. C'est
 * illisible, ça se partage mal, et ça se copie de travers.
 *
 * **Une différence de fond avec les grilles.** Une grille garde son identifiant
 * dans l'URL, et le slug n'y est que décoratif. Un artiste n'a pas d'identifiant :
 * son nom *est* la clé. Le slug doit donc se **résoudre**, et c'est l'index public
 * — la liste des artistes du catalogue — qui sert de table de correspondance.
 *
 * **Et une conséquence heureuse.** Deux orthographes voisines produisent le même
 * slug : « Francis Cabrel » et « Françis Cabrel », une faute de frappe relevée dans
 * le catalogue, donnent tous deux `francis-cabrel`. Plutôt que d'en élire un et de
 * rendre l'autre page inatteignable, le slug rassemble les deux : la page montre les
 * grilles des deux orthographes, sous celle qui en porte le plus. Une faute de
 * frappe cesse ainsi de couper un artiste en deux.
 */

/**
 * Longueur maximale du slug d'artiste.
 *
 * Plus court que celui d'une grille : un nom d'artiste n'a pas de raison d'être
 * long, et au-delà on tronquerait au milieu d'un nom composé.
 */
const LONGUEUR_MAX = 60;

export function artistSlug(name?: string | null): string {
  return slugify(name ?? '', LONGUEUR_MAX);
}

/** Le chemin, sans préfixe de langue — la navigation l'ajoute. */
export function artistPath(name?: string | null): string {
  return `/artist/${artistSlug(name)}`;
}

/**
 * Les noms du catalogue qui répondent à ce slug.
 *
 * Plusieurs, quand deux orthographes se ramènent au même slug. Aucun, quand le slug
 * ne désigne rien — la page est alors vide et non indexée, comme elle l'était déjà
 * pour un artiste inconnu.
 */
export function artistesDuSlug(slug: string, noms: Iterable<string>): string[] {
  const cible = artistSlug(slug);
  if (!cible) return [];
  return [...new Set(noms)].filter((n) => artistSlug(n) === cible);
}

/**
 * L'orthographe à afficher quand plusieurs se partagent un slug.
 *
 * Celle qui porte le plus de grilles, et l'ordre alphabétique pour trancher à
 * égalité — sans quoi le titre de la page changerait au gré de l'ordre de lecture
 * de Firestore.
 */
export function nomCanonique(noms: string[], grillesPar: (nom: string) => number): string {
  return [...noms].sort((a, b) => grillesPar(b) - grillesPar(a) || a.localeCompare(b, 'fr'))[0] ?? '';
}
