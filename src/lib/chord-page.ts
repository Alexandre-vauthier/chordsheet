import type { InstrumentId, StringChord, PianoChord } from '@/types';
import { getChordsByInstrument } from '@/lib/chord-data';

/**
 * Ce qu'il faut pour construire les pages d'accord (/chords/guitar/am).
 *
 * Tout se déduit de la bibliothèque : la liste des pages, leur URL, leur contenu et
 * leurs liens. Rien n'est saisi en double, donc rien ne peut se désynchroniser des
 * diagrammes affichés par l'application.
 */

/**
 * Instruments dotés de pages d'accord.
 *
 * `banjo` en a été écarté tant que ses données se contredisaient : ses doigtés
 * référencent une cinquième corde que `INSTRUMENT_CONFIG` ne déclarait pas, et
 * publier des notes calculées sur une donnée qui se contredit revient à publier
 * une affirmation fausse. La contradiction venait du nombre de cordes, corrigé
 * depuis ; les 133 doigtés font entendre les notes de leur nom, comme le vérifie
 * `tests/accords.test.ts`.
 *
 * `bass` en est absent pour une autre raison : ses douze entrées sont des notes
 * isolées, pas des accords. Une page « accord Do à la basse » n'aurait qu'une note à
 * montrer. `voice` n'a aucun diagramme.
 */
export const CHORD_PAGE_INSTRUMENTS: InstrumentId[] = ['guitar', 'ukulele', 'mandolin', 'banjo', 'piano'];

export function isChordPageInstrument(value: string): value is InstrumentId {
  return (CHORD_PAGE_INSTRUMENTS as string[]).includes(value);
}

/**
 * Nom d'accord → segment d'URL.
 *
 * Le dièse doit disparaître : dans une URL, « # » ouvre un fragment, il n'atteindrait
 * jamais le serveur. Le bémol, lui, s'écrit déjà « b » et passe tel quel — d'où
 * « bb » pour Si bémol, distinct de « b » pour Si.
 *
 * Un dièse suivi d'un suffixe reçoit un séparateur : sans lui, « F#m » donnerait
 * « f-sharpm », illisible et facile à mal recopier. Les fondamentales sans dièse
 * gardent la forme courte, « am » plutôt que « a-m ». Aucun suffixe de la
 * bibliothèque ne commence par « b », il n'y a donc pas d'ambiguïté avec un bémol.
 *
 * Vérifié sur les 712 accords concernés : aucune collision.
 */
export function chordSlug(name: string): string {
  const parts = splitChordName(name);
  if (!parts) return name.trim().toLowerCase();

  const root = parts.root.replace('#', '-sharp').toLowerCase();
  if (!parts.suffix) return root;

  const suffix = parts.suffix.toLowerCase();
  return parts.root.includes('#') ? `${root}-${suffix}` : `${root}${suffix}`;
}

/** Les noms d'accord distincts d'un instrument, dans l'ordre de la bibliothèque. */
export function chordNamesFor(instrumentId: InstrumentId): string[] {
  return [...new Set(getChordsByInstrument(instrumentId).map((c) => c.name))];
}

/** Segment d'URL → nom d'accord réel, ou null si l'accord n'existe pas pour cet instrument. */
export function chordFromSlug(slug: string, instrumentId: InstrumentId): string | null {
  const wanted = slug.toLowerCase();
  return chordNamesFor(instrumentId).find((name) => chordSlug(name) === wanted) ?? null;
}

/** Toutes les entrées portant ce nom : plusieurs si l'accord a des doigtés alternatifs. */
export function chordEntries(name: string, instrumentId: InstrumentId): (StringChord | PianoChord)[] {
  return getChordsByInstrument(instrumentId).filter((c) => c.name === name);
}

/** Fondamentale et suffixe d'un nom d'accord (« Am7 » → « A » + « m7 »). */
export function splitChordName(name: string): { root: string; suffix: string } | null {
  const match = name.trim().match(/^([A-G][b#]?)(.*)$/);
  if (!match) return null;
  return { root: match[1], suffix: match[2] };
}

/**
 * Accords voisins : ceux qui partagent la fondamentale, et ceux qui partagent la
 * couleur. C'est le maillage naturel de la thématique — quelqu'un qui cherche Am
 * cherche souvent Am7 juste après, ou Em pour enchaîner.
 */
export function neighbourChords(
  name: string,
  instrumentId: InstrumentId,
): { sameRoot: string[]; sameSuffix: string[] } {
  const parts = splitChordName(name);
  if (!parts) return { sameRoot: [], sameSuffix: [] };

  const names = chordNamesFor(instrumentId);
  const sameRoot: string[] = [];
  const sameSuffix: string[] = [];

  for (const other of names) {
    if (other === name) continue;
    const otherParts = splitChordName(other);
    if (!otherParts) continue;
    if (otherParts.root === parts.root) sameRoot.push(other);
    else if (otherParts.suffix === parts.suffix) sameSuffix.push(other);
  }

  return { sameRoot, sameSuffix };
}

/** Demi-tons de chaque fondamentale écrite, dièses et bémols confondus. */
const ROOT_SEMITONE: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4,
  F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9,
  'A#': 10, Bb: 10, B: 11, Cb: 11,
};

/**
 * Le même accord sur les autres instruments.
 *
 * Le rapprochement se fait sur la **hauteur** de la fondamentale, pas sur son
 * orthographe : la bibliothèque piano nomme « C#m » ce que la bibliothèque guitare
 * nomme « Dbm ». Comparer les chaînes laisserait un lien croisé sur trois mort, et
 * `enharmonicEquivalent` ne traduit que dans un sens (C# → Db, jamais l'inverse).
 */
export function sameChordElsewhere(
  name: string,
  instrumentId: InstrumentId,
): { instrumentId: InstrumentId; name: string }[] {
  const parts = splitChordName(name);
  if (!parts) return [];

  const semitone = ROOT_SEMITONE[parts.root];
  if (semitone === undefined) return [];

  const out: { instrumentId: InstrumentId; name: string }[] = [];

  for (const other of CHORD_PAGE_INSTRUMENTS) {
    if (other === instrumentId) continue;

    const match = chordNamesFor(other).find((candidate) => {
      const c = splitChordName(candidate);
      return c !== null && c.suffix === parts.suffix && ROOT_SEMITONE[c.root] === semitone;
    });

    if (match) out.push({ instrumentId: other, name: match });
  }

  return out;
}

/**
 * Accords les plus courants, tous instruments confondus : majeurs, mineurs et
 * septièmes de dominante. Sert à hiérarchiser le sitemap — un Dbdim et un Am ne
 * méritent pas la même priorité, et le prétendre dessert les deux.
 */
export function isCommonChord(name: string): boolean {
  const parts = splitChordName(name);
  return parts ? ['', 'm', '7'].includes(parts.suffix) : false;
}
