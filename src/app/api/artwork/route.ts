import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q?.trim()) {
    return NextResponse.json({ artworkUrl: null, previewUrl: null, year: null });
  }

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`,
      { next: { revalidate: 86400 } } // Vercel cache 24h
    );
    if (!res.ok) throw new Error(`iTunes ${res.status}`);

    const data = await res.json();
    const result = data.results?.[0];
    const artworkUrl = result?.artworkUrl100?.replace('100x100', '600x600') ?? null;
    const previewUrl = result?.previewUrl ?? null;
    // releaseDate ex. "1975-10-31T12:00:00Z" — on en extrait l'année
    const releaseYear = typeof result?.releaseDate === 'string'
      ? Number(result.releaseDate.slice(0, 4))
      : NaN;
    const year = Number.isFinite(releaseYear) ? releaseYear : null;

    return NextResponse.json(
      { artworkUrl, previewUrl, year },
      { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } }
    );
  } catch {
    return NextResponse.json(
      { artworkUrl: null, previewUrl: null, year: null },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } }
    );
  }
}
