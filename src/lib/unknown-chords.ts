import type { InstrumentId } from '@/types';
import { enharmonicEquivalent, findChordVariants } from '@/lib/chord-data';
import { libraryKey } from '@/lib/library-key';

/**
 * Accords écrits dans une grille que la bibliothèque ne sait pas dessiner.
 *
 * Un accord peut être saisi librement : rien n'empêche d'écrire « Am7b5b9 » ou une
 * faute de frappe. Tant que personne ne le remarque, la grille s'affiche avec une
 * case dont aucun diagramme ne sort — l'auteur croit que c'est normal, et le trou
 * dans la bibliothèque reste invisible.
 *
 * Fonctions pures : aucun accès réseau ni Firestore. Les accords ajoutés par un
 * administrateur vivent pourtant en base — ils sont donc passés en argument, sous la
 * forme de clés `libraryKey`, plutôt que lus ici. C'est ce qui permet d'appeler ces
 * fonctions aussi bien depuis le navigateur que depuis une route serveur.
 */

/**
 * Clés `libraryKey` des accords ajoutés à la bibliothèque par un administrateur.
 *
 * Sans elles, le contrôle réclamerait un accord déjà dessiné : l'application le
 * résout depuis `library_chords` avant de consulter la table statique (voir
 * `resolveChord` dans `use-playback`), et le contrôle doit suivre le même chemin,
 * sinon il décrit une bibliothèque qui n'est pas celle que voient les utilisateurs.
 */
export type AjoutsAdmin = ReadonlySet<string>;

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
export function isChordKnown(
  name: string,
  instrumentId: InstrumentId,
  ajouts?: AjoutsAdmin,
): boolean {
  const propre = name.trim();
  if (!propre) return true;
  if (SANS_BIBLIOTHEQUE.includes(instrumentId)) return true;

  const canonique = capitaliserFondamentales(propre);
  if (estAjouteParAdmin(canonique, instrumentId, ajouts)) return true;

  return findChordVariants(canonique, instrumentId).length > 0;
}

/**
 * L'accord a-t-il été ajouté à la main dans la bibliothèque ?
 *
 * L'équivalent enharmonique est testé aussi : un administrateur qui a dessiné « Db »
 * couvre « C# », et l'application le résout ainsi à la lecture.
 */
function estAjouteParAdmin(canonique: string, instrumentId: InstrumentId, ajouts?: AjoutsAdmin): boolean {
  if (!ajouts?.size) return false;
  if (ajouts.has(libraryKey(canonique, instrumentId))) return true;
  const enh = enharmonicEquivalent(canonique);
  return enh ? ajouts.has(libraryKey(enh, instrumentId)) : false;
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
  ajouts?: AjoutsAdmin,
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
    if (!isChordKnown(propre, instrumentId, ajouts)) out.push(propre);
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
export function instrumentsMissingChord(name: string, ajouts?: AjoutsAdmin): InstrumentId[] {
  return INSTRUMENTS_AVEC_BIBLIOTHEQUE.filter((i) => !isChordKnown(name, i, ajouts));
}
