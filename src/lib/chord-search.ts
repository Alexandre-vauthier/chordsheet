import { normalizeChord } from '@/lib/sheet-chords';

/**
 * Chercher un accord dans la bibliothèque, comme on cherche dans un dictionnaire.
 *
 * La recherche prenait le nom tapé n'importe où dans le nom de l'accord : taper
 * « D » ramenait cent vingt-six accords, dont Cadd9, Cdim et Cmadd9, où le d est
 * au milieu d'un suffixe. On lit un dictionnaire par le début, pas par le milieu.
 *
 * Deux règles, dans cet ordre.
 *
 * **Une lettre seule désigne la note naturelle.** « D » donne D, Dm, Dm7, Dsus4,
 * et non les vingt-quatre accords de ré bémol ni de ré dièse : ce sont d'autres
 * fondamentales, on les demande en tapant « Db » ou « D# ». Sans cette règle, la
 * moitié de ce qu'on obtient n'est pas ce qu'on cherchait.
 *
 * **Le reste se lit depuis le début.** « Dm » donne Dm, Dm7, Dm9 ; « Db » donne
 * les ré bémol.
 *
 * Le nom français est accepté : « ré », « solm », « fa#7 » se ramènent à leur
 * écriture anglaise avant comparaison, par la même fonction que la saisie d'une
 * grille — deux tables de correspondance auraient fini par diverger.
 */

/** Les sept notes naturelles, en écriture anglaise. */
const NATURELLES = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']);

/**
 * La requête, ramenée à l'écriture anglaise et en minuscules.
 *
 * `normalizeChord` fait déjà ce travail pour la saisie d'une grille : elle
 * capitalise avant d'analyser, sans quoi le français en minuscules n'est pas
 * reconnu, et convertit « lam » en « am ». La réécrire ici aurait donné deux
 * tables de correspondance qui auraient fini par diverger.
 *
 * Une requête qu'elle ne reconnaît pas ressort telle quelle : on cherche
 * peut-être un fragment de suffixe, ce n'est pas une erreur.
 */
export function normaliserRequete(requete: string): string {
  const propre = requete.trim();
  if (!propre) return '';
  return normalizeChord(propre) || propre.toLowerCase();
}

/** Le nom de l'accord répond-il à la requête, déjà normalisée ? */
export function correspondAccord(nom: string, requeteNormalisee: string): boolean {
  if (!requeteNormalisee) return true;
  const cible = nom.trim().toLowerCase();

  if (requeteNormalisee.length === 1 && NATURELLES.has(requeteNormalisee)) {
    if (!cible.startsWith(requeteNormalisee)) return false;
    // Ce qui suit la lettre : une altération en fait une autre fondamentale.
    const suivant = cible.charAt(1);
    return suivant !== '#' && suivant !== 'b';
  }

  return cible.startsWith(requeteNormalisee);
}

/**
 * Les noms retenus pour une requête.
 *
 * Si la lecture par le début ne donne rien, on cherche le fragment n'importe où :
 * taper « sus4 » ou « maj7 » reste une façon légitime de balayer une famille, et
 * rendre une liste vide quand des accords correspondent serait pire que du bruit.
 */
export function filtrerAccords<T>(items: T[], nomDe: (item: T) => string, requete: string): T[] {
  const q = normaliserRequete(requete);
  if (!q) return items;

  const parLeDebut = items.filter((item) => correspondAccord(nomDe(item), q));
  if (parLeDebut.length > 0) return parLeDebut;

  return items.filter((item) => nomDe(item).trim().toLowerCase().includes(q));
}
