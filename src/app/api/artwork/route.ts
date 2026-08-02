import { NextRequest, NextResponse } from 'next/server';
import { earliestYearForTitle } from '@/lib/itunes-year';
import { mapItunesGenre } from '@/lib/itunes-genre';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q?.trim()) {
    return NextResponse.json({ artworkUrl: null, previewUrl: null, trackUrl: null, year: null, genre: null });
  }

  try {
    // limit élargi : la pochette/extrait viennent du meilleur résultat, mais l'année
    // se déduit de la version la PLUS ANCIENNE du même titre (évite remaster/compil).
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=25`,
      { next: { revalidate: 86400 } } // Vercel cache 24h
    );
    if (!res.ok) throw new Error(`iTunes ${res.status}`);

    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const top = results[0];
    const artworkUrl = top?.artworkUrl100?.replace('100x100', '600x600') ?? null;
    const previewUrl = top?.previewUrl ?? null;
    // Lien vers la fiche Apple Music. Les conditions de cette API l'autorisent pour
    // **promouvoir** le contenu de la boutique : afficher pochette et extrait sans
    // jamais y renvoyer, c'en est l'usage le plus discutable. Le lien règle ça.
    const trackUrl = top?.trackViewUrl ?? top?.collectionViewUrl ?? null;
    const year = earliestYearForTitle(results, top?.trackName);
    const genre = mapItunesGenre(top?.primaryGenreName);

    return NextResponse.json(
      { artworkUrl, previewUrl, trackUrl, year, genre },
      { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } }
    );
  } catch {
    return NextResponse.json(
      { artworkUrl: null, previewUrl: null, trackUrl: null, year: null, genre: null },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } }
    );
  }
}
