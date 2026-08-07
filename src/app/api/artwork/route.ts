import { NextRequest, NextResponse } from 'next/server';
import { earliestYearForTitle } from '@/lib/itunes-year';
import { mapItunesGenre } from '@/lib/itunes-genre';
import { choisirResultat, type ItunesResultat } from '@/lib/itunes-pick';

const VIDE = { artworkUrl: null, previewUrl: null, trackUrl: null, year: null, genre: null };

export async function GET(req: NextRequest) {
  // `artist` et `title` séparément, en plus du terme : la route ne recevait qu'une
  // suite de mots, elle ne pouvait donc pas vérifier que le résultat retenu était
  // du bon artiste. `q` reste accepté pour les appels qui n'ont pas la distinction.
  const artiste = req.nextUrl.searchParams.get('artist')?.trim() || undefined;
  const titre = req.nextUrl.searchParams.get('title')?.trim() || undefined;
  // L'artiste avant le titre : mesuré sur 28 grilles du catalogue, cet ordre ne
  // perd jamais contre l'inverse et gagne les morceaux plus connus par une reprise.
  const q = req.nextUrl.searchParams.get('q')?.trim() || [artiste, titre].filter(Boolean).join(' ');
  if (!q) return NextResponse.json(VIDE);

  try {
    // limit élargi : la pochette/extrait viennent du meilleur résultat, mais l'année
    // se déduit de la version la PLUS ANCIENNE du même titre (évite remaster/compil).
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=25`,
      { next: { revalidate: 86400 } } // Vercel cache 24h
    );
    if (!res.ok) throw new Error(`iTunes ${res.status}`);

    const data = await res.json();
    const results: ItunesResultat[] = Array.isArray(data.results) ? data.results : [];
    // Le premier résultat n'est pas forcément le bon morceau : voir `choisirResultat`.
    const top = choisirResultat(results, artiste, titre);
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
    return NextResponse.json(VIDE, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    });
  }
}
