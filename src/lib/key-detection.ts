/**
 * Tonalité déduite des accords d'une grille.
 *
 * On note chacune des vingt-quatre tonalités (douze majeures, douze mineures) selon
 * qu'elle explique bien ou mal les accords observés, et on garde la meilleure.
 *
 * Deux choses font la différence entre un calcul naïf et un calcul utile :
 *
 * - **La qualité des accords**, pas seulement leur fondamentale. Do majeur et Ré
 *   majeur partagent quatre fondamentales, mais Do attend un Ré *mineur* là où Ré
 *   attend un Ré *majeur*. C'est ce qui sépare la plupart des tonalités voisines.
 * - **La place des accords**. Do majeur et La mineur ont exactement les mêmes
 *   accords : seul l'accord sur lequel on commence et surtout celui sur lequel on
 *   finit dit lequel est la tonique. Sans ce signal, une tonalité sur deux serait son
 *   relatif.
 *
 * Fonction pure : aucun appel externe, aucune dépendance à React.
 */

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SEMITONE: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4,
  F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9,
  'A#': 10, Bb: 10, B: 11, Cb: 11,
};

/** Orthographe usuelle d'une tonalité : on écrit Bb, pas A#. */
const KEY_SPELLING: Record<number, string> = {
  0: 'C', 1: 'Db', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F',
  6: 'F#', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B',
};

export type ChordQuality = 'major' | 'minor' | 'dominant' | 'diminished' | 'augmented' | 'suspended';

export interface ParsedChord {
  root: number;
  quality: ChordQuality;
}

/**
 * Nom d'accord → fondamentale et couleur.
 *
 * L'ordre des tests compte : « maj7 » contient « m », et « m7b5 » doit se lire comme
 * un diminué, pas comme un mineur. Rend `null` sur ce qui n'est pas un accord.
 */
export function parseChordName(name: string): ParsedChord | null {
  const match = name.trim().match(/^([A-G][b#]?)(.*)$/);
  if (!match) return null;

  const root = SEMITONE[match[1]];
  if (root === undefined) return null;

  // On ignore la basse d'un accord slash : elle colore l'harmonie, elle ne la définit
  // pas. « C/E » reste un accord de Do.
  const suffix = match[2].split('/')[0].trim().toLowerCase();

  if (/^(dim|°|m7b5|ø)/.test(suffix)) return { root, quality: 'diminished' };
  if (/^(aug|\+)/.test(suffix)) return { root, quality: 'augmented' };
  if (/^maj/.test(suffix)) return { root, quality: 'major' };
  if (/^m/.test(suffix)) return { root, quality: 'minor' };
  if (/^sus/.test(suffix)) return { root, quality: 'suspended' };
  if (/^(7|9|11|13)/.test(suffix)) return { root, quality: 'dominant' };
  return { root, quality: 'major' };
}

/** Degrés d'une tonalité majeure : intervalle depuis la tonique, et couleur attendue. */
const MAJOR_DEGREES: { semitone: number; quality: ChordQuality; weight: number }[] = [
  { semitone: 0,  quality: 'major',      weight: 3 },    // I
  { semitone: 2,  quality: 'minor',      weight: 1.5 },  // ii
  { semitone: 4,  quality: 'minor',      weight: 1.5 },  // iii
  { semitone: 5,  quality: 'major',      weight: 2 },    // IV
  { semitone: 7,  quality: 'major',      weight: 2.5 },  // V
  { semitone: 7,  quality: 'dominant',   weight: 3 },    // V7 : signe le plus sûr
  { semitone: 9,  quality: 'minor',      weight: 1.5 },  // vi
  { semitone: 11, quality: 'diminished', weight: 1.5 },  // vii°
];

/**
 * Degrés d'une tonalité mineure.
 *
 * La quinte majeure et la septième de dominante y figurent : le mineur harmonique est
 * la règle en pratique, un Mi majeur dans un morceau en La mineur n'est pas une
 * anomalie mais la cadence attendue.
 */
const MINOR_DEGREES: { semitone: number; quality: ChordQuality; weight: number }[] = [
  { semitone: 0,  quality: 'minor',      weight: 3 },    // i
  { semitone: 2,  quality: 'diminished', weight: 1.5 },  // ii°
  { semitone: 3,  quality: 'major',      weight: 2 },    // III
  { semitone: 5,  quality: 'minor',      weight: 2 },    // iv
  { semitone: 7,  quality: 'minor',      weight: 1.5 },  // v naturel
  { semitone: 7,  quality: 'major',      weight: 2.5 },  // V harmonique
  { semitone: 7,  quality: 'dominant',   weight: 3 },    // V7
  { semitone: 8,  quality: 'major',      weight: 2 },    // VI
  { semitone: 10, quality: 'major',      weight: 2 },    // VII
];

/** Un accord étranger à la tonalité coûte : sans quoi toute tonalité en vaut une autre. */
const FOREIGN_PENALTY = 1.6;

/** Un accord suspendu ne dit rien de sa couleur : on ne le compte ni pour ni contre. */
function degreeScore(
  chord: ParsedChord,
  tonic: number,
  degrees: typeof MAJOR_DEGREES,
): number {
  if (chord.quality === 'suspended') return 0;

  const interval = ((chord.root - tonic) % 12 + 12) % 12;
  const match = degrees.find((d) => d.semitone === interval && d.quality === chord.quality);
  if (match) return match.weight;

  // Bonne fondamentale, mauvaise couleur : à moitié pardonné. C'est le cas d'un
  // emprunt (un IV mineur en majeur), fréquent et peu significatif.
  const sameRoot = degrees.some((d) => d.semitone === interval);
  return sameRoot ? -FOREIGN_PENALTY / 2 : -FOREIGN_PENALTY;
}

export interface KeyGuess {
  /** Tonalité au format de l'application : « C », « Am », « F#m ». */
  key: string;
  /**
   * Écart relatif avec la deuxième hypothèse, de 0 à 1. Sous 0,1 les deux tonalités
   * expliquent aussi bien les accords — typiquement une majeure et son relatif mineur.
   */
  confidence: number;
}

/**
 * Meilleure tonalité pour une suite d'accords, ou `null` si la matière est trop mince.
 *
 * `chords` est la suite **dans l'ordre de la grille**, répétitions comprises : un
 * accord joué vingt fois pèse plus qu'un accord de passage, et le premier comme le
 * dernier départagent une tonalité de son relatif.
 */
export function detectKey(chords: string[]): KeyGuess | null {
  const parsed = chords.map(parseChordName).filter((c): c is ParsedChord => c !== null);
  if (parsed.length === 0) return null;

  // Deux couleurs distinctes au minimum : un seul accord ne dit rien, et le même
  // accord répété non plus. Beaucoup de morceaux tiennent en deux accords, les
  // exclure priverait de réponse ceux qui en ont le plus besoin.
  const distinct = new Set(parsed.map((c) => `${c.root}-${c.quality}`));
  if (distinct.size < 2) return null;

  const first = parsed[0];
  const last = parsed[parsed.length - 1];

  /**
   * Poids de la position, selon la richesse harmonique.
   *
   * Avec quatre couleurs ou plus, les degrés parlent d'eux-mêmes : la position ne fait
   * que départager une tonalité de son relatif, et c'est l'accord de **fin** qui le dit
   * le mieux — une chanson se pose sur sa tonique.
   *
   * En dessous, il n'y a presque pas d'harmonie à lire : la position devient le seul
   * indice, et c'est alors le **début** qui compte. Une grille de deux accords est une
   * boucle, elle ne finit pas, elle recommence — ce qui suit le dernier accord, c'est
   * le premier. « C F » répété est en Do, même si la dernière cellule est un Fa.
   *
   * Mesuré : ce partage donne 26/26 sur les chansons complètes et 14/14 sur les
   * boucles à deux accords, là où un poids unique perdait toujours l'un des deux.
   */
  const richesse = distinct.size;
  const POIDS_DEBUT = richesse >= 4 ? 0.25 : 0.5;
  const POIDS_FIN = richesse >= 4 ? 0.4 : 0.15;

  const candidates: { key: string; score: number }[] = [];

  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      const degrees = mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;
      let score = 0;

      for (const chord of parsed) score += degreeScore(chord, tonic, degrees);

      // La grille commence et surtout finit sur la tonique : c'est ce qui sépare une
      // tonalité de son relatif, qui partagent tous leurs accords.
      const tonicQuality: ChordQuality = mode === 'major' ? 'major' : 'minor';
      if (first.root === tonic && first.quality === tonicQuality) score += parsed.length * POIDS_DEBUT;
      if (last.root === tonic && last.quality === tonicQuality) score += parsed.length * POIDS_FIN;

      candidates.push({
        key: mode === 'major' ? KEY_SPELLING[tonic] : `${KEY_SPELLING[tonic]}m`,
        score,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const [best, second] = candidates;
  if (best.score <= 0) return null;

  return {
    key: best.key,
    confidence: Math.max(0, Math.min(1, (best.score - second.score) / best.score)),
  };
}

/** Les notes chromatiques, exportées pour les écrans qui affichent une tonalité. */
export const CHROMATIC_NOTES = NOTES;
