import type { InstrumentId } from '@/types';
import { findChordVariants } from '@/lib/chord-data';

/**
 * Accords écrits dans une grille que la bibliothèque ne sait pas dessiner.
 *
 * Un accord peut être saisi librement : rien n'empêche d'écrire « Am7b5b9 » ou une
 * faute de frappe. Tant que personne ne le remarque, la grille s'affiche avec une
 * case dont aucun diagramme ne sort — l'auteur croit que c'est normal, et le trou
 * dans la bibliothèque reste invisible.
 *
 * Fonctions pures : elles ne lisent que la bibliothèque, aucun accès réseau ni
 * Firestore. C'est ce qui permet de les appeler aussi bien depuis le navigateur que
 * depuis une route serveur.
 */

/**
 * Instruments dont la bibliothèque ne dit rien, à écarter du contrôle.
 *
 * La voix n'a aucun diagramme par construction : passer une grille de chant au
 * crible signalerait chacun de ses accords comme introuvable.
 */
const SANS_BIBLIOTHEQUE: InstrumentId[] = ['voice'];

/**
 * Remet les majuscules aux fondamentales, comme le fait la saisie d'une case.
 *
 * Le champ indexé d'une grille est stocké en minuscules, or la reconnaissance attend
 * une fondamentale capitalisée (`/^[A-G]/`). La note après un `/` compte aussi :
 * sans elle, « c/e » relu depuis la base passerait pour un accord introuvable, et le
 * tableau d'administration se remplirait de tous les accords slash du catalogue.
 */
function capitaliserFondamentales(nom: string): string {
  let out = '';
  let majuscule = true;
  for (const c of nom) {
    if (c === '/') { out += c; majuscule = true; continue; }
    if (/[a-zA-Z]/.test(c)) { out += majuscule ? c.toUpperCase() : c.toLowerCase(); majuscule = false; continue; }
    out += c;
  }
  return out;
}

/**
 * L'accord est-il connu pour cet instrument ?
 *
 * `findChordVariants` couvre bien plus que la table : équivalences enharmoniques,
 * accords slash, et génération à la volée des formules enrichies. Un accord qu'elle
 * ne rend pas est donc réellement absent, pas seulement absent de la table.
 */
export function isChordKnown(name: string, instrumentId: InstrumentId): boolean {
  const propre = name.trim();
  if (!propre) return true;
  if (SANS_BIBLIOTHEQUE.includes(instrumentId)) return true;

  return findChordVariants(capitaliserFondamentales(propre), instrumentId).length > 0;
}

/**
 * Les accords introuvables parmi ceux qu'on lui donne, sans doublon et dans l'ordre.
 *
 * `connus` reçoit les doigtés que l'auteur a dessinés lui-même : ils sont propres à
 * la grille et parfaitement légitimes, les compter comme manquants reviendrait à
 * signaler la fonctionnalité qui sert justement à combler un trou.
 */
export function unknownChordsIn(
  chords: string[],
  instrumentId: InstrumentId,
  connus: string[] = [],
): string[] {
  const dessines = new Set(connus.map((c) => c.trim().toLowerCase()));
  const vus = new Set<string>();
  const out: string[] = [];

  for (const brut of chords) {
    const propre = brut.trim();
    if (!propre) continue;
    const cle = propre.toLowerCase();
    if (vus.has(cle) || dessines.has(cle)) continue;
    vus.add(cle);
    if (!isChordKnown(propre, instrumentId)) out.push(propre);
  }

  return out;
}

/** Les instruments qui ont une bibliothèque de diagrammes. */
export const INSTRUMENTS_AVEC_BIBLIOTHEQUE: InstrumentId[] =
  ['guitar', 'ukulele', 'mandolin', 'banjo', 'bass', 'piano'];

/**
 * Les instruments qui ne savent pas dessiner cet accord.
 *
 * Une grille n'est contrôlée que pour son propre instrument, ce qui suffit à savoir
 * si son auteur voit une case vide. Mais du point de vue de la bibliothèque, la
 * question utile est ailleurs : un accord peut manquer à la guitare **et** à
 * l'ukulélé, et le savoir d'un coup d'œil dit combien de travail son ajout
 * représente. Rendre la liste vide signifie que tout le monde sait le dessiner.
 */
export function instrumentsMissingChord(name: string): InstrumentId[] {
  return INSTRUMENTS_AVEC_BIBLIOTHEQUE.filter((i) => !isChordKnown(name, i));
}
