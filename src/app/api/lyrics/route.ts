import { NextRequest, NextResponse } from 'next/server';

/**
 * Paroles, récupérées à la volée et **jamais conservées**.
 *
 * L'application allait auparavant les chercher toute seule et les écrivait dans la
 * grille. Deux problèmes distincts : la source n'a aucune licence des ayants droit,
 * et surtout c'était l'application qui publiait, plus l'utilisateur. Ici on se
 * contente de relayer à l'affichage — rien n'est stocké, ni chez nous ni dans la
 * grille.
 *
 * Le relais passe par le serveur pour une raison pratique aussi : la réponse est
 * mise en cache, ce qui évite de solliciter un service gratuit à chaque ouverture
 * d'une même grille.
 */
export const dynamic = 'force-dynamic';

const SOURCE = 'https://api.lyrics.ovh/v1';

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get('artist')?.trim();
  const title = req.nextUrl.searchParams.get('title')?.trim();

  if (!artist || !title) return NextResponse.json({ lyrics: null });

  try {
    const res = await fetch(
      `${SOURCE}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return NextResponse.json({ lyrics: null });

    const data = await res.json();
    const lyrics = typeof data?.lyrics === 'string' ? data.lyrics.trim() : null;

    return NextResponse.json(
      { lyrics: lyrics || null },
      { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } },
    );
  } catch {
    return NextResponse.json({ lyrics: null });
  }
}
