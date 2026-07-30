// Convertit une tonalité au format GetSongBPM (« C », « Am », « F# min », « A minor »,
// « C maj », « C# / Db »…) vers notre format compact (« C », « Am », « F#m »).
export function normalizeKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;

  // « C# / Db » -> on garde la 1re graphie.
  s = s.split('/')[0].trim();

  // Note (A-G) + éventuel dièse/bémol.
  const m = s.match(/^([A-Ga-g])\s*([#b♯♭])?/);
  if (!m) return null;
  const accidental = m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : (m[2] ?? '');
  const note = m[1].toUpperCase() + accidental;

  // Reste = mode (min / maj / m / minor / major / vide).
  const rest = s.slice(m[0].length).toLowerCase().replace(/[^a-z]/g, '');
  const minor = rest === 'm' || rest.startsWith('min');
  return note + (minor ? 'm' : '');
}
