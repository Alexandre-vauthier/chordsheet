// Rapprochement souple entre un accord détecté au micro (notation américaine,
// ex. "G", "Dm", "Gmaj7") et un accord écrit dans une grille.
// On compare la fondamentale (classe de note, enharmonie #/b gérée) et la
// couleur majeur/mineur. Les accords "sus" (sans tierce) matchent les deux
// couleurs sur la même fondamentale. Volontairement tolérant : la détection
// live est imparfaite, et cette étape ne fait que surligner, sans suivre la
// position dans la grille.

const NOTE_PC: Record<string, number> = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

type Family = 'maj' | 'min' | 'sus';

function familyOf(rest: string): Family {
  const r = rest.toLowerCase();
  if (r.startsWith('maj')) return 'maj';
  if (r.startsWith('sus')) return 'sus';
  // m, min, m7, m6, m7b5, dim, ° → couleur mineure
  if (r.startsWith('m') || r.startsWith('dim') || r.startsWith('°') || r.startsWith('min')) return 'min';
  // aug, +, 5, 6, 7, 9, add…, ou triade nue → couleur majeure par défaut
  return 'maj';
}

export interface ParsedChord {
  pc: number;
  family: Family;
}

export function parseChord(name: string): ParsedChord | null {
  if (!name) return null;
  const m = name.trim().match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!m) return null;
  const root = m[1].toUpperCase() + (m[2] || '');
  const pc = NOTE_PC[root];
  if (pc === undefined) return null;
  const rest = m[3].split('/')[0]; // ignorer la basse d'un accord slash (ex. G/B)
  return { pc, family: familyOf(rest) };
}

export function chordsMatch(detected: string, cellChord: string): boolean {
  const a = parseChord(detected);
  const b = parseChord(cellChord);
  if (!a || !b) return false;
  if (a.pc !== b.pc) return false;
  return a.family === b.family || a.family === 'sus' || b.family === 'sus';
}
