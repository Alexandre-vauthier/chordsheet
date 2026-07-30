// Déduit l'année de sortie « d'origine » d'un morceau à partir des résultats iTunes.
// L'API renvoie souvent en 1er une réédition/remaster/compilation (releaseDate tardive)
// alors que la pochette semble correcte. On prend donc l'année la PLUS ANCIENNE parmi
// les résultats qui portent le MÊME titre que le meilleur résultat (une réédition est
// toujours postérieure à l'originale).

// Normalise un titre pour regrouper les versions : minuscule + retrait des mentions
// entre parenthèses/crochets (« (Remastered 2011) », « [Live] »…) et des espaces.
function normalizeTitle(title: string | undefined): string {
  return (title || '')
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ITunesResult {
  trackName?: string;
  releaseDate?: string;
}

export function earliestYearForTitle(results: ITunesResult[], topTrackName: string | undefined): number | null {
  if (!Array.isArray(results) || results.length === 0) return null;
  const target = normalizeTitle(topTrackName);

  const years: number[] = [];
  for (const r of results) {
    // Ne considérer que les versions du même morceau (évite d'attraper un autre titre
    // plus ancien remonté par la recherche).
    if (target && normalizeTitle(r.trackName) !== target) continue;
    if (typeof r.releaseDate !== 'string') continue;
    const y = Number(r.releaseDate.slice(0, 4));
    if (Number.isFinite(y) && y > 1900 && y <= 2100) years.push(y);
  }

  // Repli : si aucun même-titre exploitable, on prend l'année du meilleur résultat.
  if (years.length === 0) {
    const y0 = typeof results[0]?.releaseDate === 'string' ? Number(results[0].releaseDate.slice(0, 4)) : NaN;
    return Number.isFinite(y0) ? y0 : null;
  }
  return Math.min(...years);
}
