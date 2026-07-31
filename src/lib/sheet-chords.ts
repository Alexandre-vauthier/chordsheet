import type { Sheet } from '@/types';
import { parseChordInput } from '@/lib/chord-data';

/**
 * Recherche d'une grille par accord (outil admin de la page Explore).
 *
 * Les accords ne sont pas indexés côté Firestore : ils vivent au fond de
 * `sections[].rows[][].chord`, hors de portée d'une requête. Le filtrage se fait
 * donc en mémoire, sur le lot déjà chargé par Explore.
 */

/** Tous les accords distincts d'une grille, sous leur forme canonique. */
export function collectSheetChords(sheet: Sheet): Set<string> {
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
