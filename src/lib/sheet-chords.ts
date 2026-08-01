import type { Section, Sheet } from '@/types';
import { parseChordInput } from '@/lib/chord-data';

/**
 * Accords d'une grille : extraction, forme canonique, et recherche.
 *
 * Les accords vivent au fond de `sections[].rows[][].chord`, hors de portée d'une
 * requête Firestore. `toFirestore` en dépose donc une copie à plat dans le champ
 * `chords`, ce qui rend possible un `array-contains` — c'est ce qui alimente les
 * pages d'accord et la recherche par accord.
 */

/**
 * Plafond du champ indexé. Une grille dépasse rarement la vingtaine d'accords
 * distincts ; le plafond ne protège que du cas pathologique, où un tableau immense
 * ferait grossir l'index Firestore sans rien apporter.
 */
export const MAX_INDEXED_CHORDS = 60;

/** Tous les accords distincts d'une grille, sous leur forme canonique. */
export function collectSheetChords(sheet: { sections?: Section[] }): Set<string> {
  const out = new Set<string>();
  for (const section of sheet.sections ?? []) {
    for (const row of section.rows ?? []) {
      for (const cell of row) {
        const chord = normalizeChord(cell.chord);
        if (chord) out.add(chord);
      }
    }
  }
  return out;
}

/**
 * Forme canonique d'un accord, insensible à la casse et à la notation : la saisie
 * passe par `parseChordInput`, qui convertit le français vers l'anglais (« Lam » →
 * « Am ») et retire un éventuel suffixe de répétition (« Am x2 »).
 */
export function normalizeChord(raw: string | undefined): string {
  const cleaned = raw?.trim();
  if (!cleaned) return '';
  // Première lettre en majuscule avant l'analyse : `parseChordInput` reconnaît les
  // noms français sur leur forme capitalisée (« Fa#m7 »), or l'admin tape volontiers
  // en minuscules. Sans effet sur la notation anglaise (« am » → « Am »).
  const cased = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  // `.trim()` de sortie : un suffixe de répétition détaché (« Am x2 ») laisse une
  // espace en fin de chaîne.
  return parseChordInput(cased).chord.trim().toLowerCase();
}

/**
 * La grille contient-elle l'accord cherché ? Correspondance exacte : « Am » ne
 * remonte pas « Am7 ». Une requête vide ne filtre rien.
 */
export function sheetHasChord(sheet: Sheet, query: string): boolean {
  const needle = normalizeChord(query);
  if (!needle) return true;
  return collectSheetChords(sheet).has(needle);
}

/**
 * Le champ `chords` tel qu'il part en base : trié, plafonné, prêt pour un
 * `array-contains`. Trié pour que deux sauvegardes d'une même grille produisent le
 * même tableau, et n'écrivent donc pas un document identique pour rien.
 */
export function indexedChords(sheet: { sections?: Section[] }): string[] {
  return [...collectSheetChords(sheet)].sort().slice(0, MAX_INDEXED_CHORDS);
}
