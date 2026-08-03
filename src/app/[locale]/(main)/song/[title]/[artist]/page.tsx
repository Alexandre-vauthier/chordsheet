import type { Metadata } from 'next';
import { estAuCatalogue } from '@/lib/sheet-catalogue';
import { cache } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { fromFirestore } from '@/lib/firestore-helpers';
import type { Sheet } from '@/types';
import { decodeParam } from '@/lib/decode-param';
import { buildAlternates, buildOpenGraph, NO_INDEX, SITE_NAME } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';
import { musicCompositionSchema, breadcrumbSchema } from '@/lib/seo-schema';
import { SongVersionsClient } from './song-versions-client';

interface SongPageProps {
  params: Promise<{ locale: string; title: string; artist: string }>;
}

/**
 * Les versions publiques d'un même morceau.
 *
 * Firestore ne sait pas comparer sans tenir compte de la casse : on filtre donc sur
 * l'artiste, indexé, puis on rapproche les titres en mémoire, exactement comme le
 * faisait la lecture client.
 *
 * Les paroles ne sortent pas du serveur (textes sous droits) ; cette page ne les
 * affiche de toute façon pas.
 */
const getSongVersions = cache(async (title: string, artist: string): Promise<Sheet[]> => {
  try {
    const snap = await getAdminDb()
      .collection('sheets')
      .where('isPublic', '==', true)
      .where('artist', '==', artist)
      .limit(100)
      .get();

    const docs = snap.docs as { id: string; data: () => Record<string, unknown> }[];
    const titleNorm = title.trim().toLowerCase();

    return docs
      .map((d) => {
        const { lyrics: _lyrics, ...rest } = d.data();
        return fromFirestore(d.id, rest);
      })
      // Les copies de groupe ne comptent pas comme des versions : ce sont des
      // reprises du même document, elles feraient passer une grille pour quatre.
      .filter((s: Sheet) => estAuCatalogue(s) && s.title.trim().toLowerCase() === titleNorm)
      .sort((a: Sheet, b: Sheet) => {
        const ra = a.averageRating ?? 0;
        const rb = b.averageRating ?? 0;
        if (rb !== ra) return rb - ra;
        return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
      });
  } catch {
    return [];
  }
});

/** Revalidation horaire, comme les autres pages nourries par le catalogue. */
export const revalidate = 3600;

export async function generateMetadata({ params }: SongPageProps): Promise<Metadata> {
  const { locale, title: rawTitle, artist: rawArtist } = await params;
  const title = decodeParam(rawTitle);
  const artist = decodeParam(rawArtist);
  const path = `/song/${rawTitle}/${rawArtist}`;

  const sheets = await getSongVersions(title, artist);

  // Aucune version publique : la page est vide, elle n'a rien à faire dans l'index.
  if (sheets.length === 0) return { robots: NO_INDEX };

  const t = await getTranslations({ locale, namespace: 'Seo.pages.song' });
  const pageTitle = t('title', { title, artist, count: sheets.length });
  const description = t('description', { title, artist, site: SITE_NAME });

  return {
    title: pageTitle,
    description,
    alternates: buildAlternates(locale, path),
    openGraph: { ...buildOpenGraph(locale, path), title: pageTitle, description, type: 'website' },
    twitter: { card: 'summary', title: pageTitle, description },
  };
}

export default async function SongPage({ params }: SongPageProps) {
  const { locale, title: rawTitle, artist: rawArtist } = await params;
  setRequestLocale(locale);

  const title = decodeParam(rawTitle);
  const artist = decodeParam(rawArtist);
  const sheets = await getSongVersions(title, artist);

  return (
    <>
      <SongVersionsClient title={title} artist={artist} initialSheets={sheets} />
      {sheets.length > 0 && (
        <JsonLd
          data={[
            musicCompositionSchema(locale, {
              title,
              artist,
              musicalKey: sheets[0].key,
              path: `/song/${rawTitle}/${rawArtist}`,
            }),
            breadcrumbSchema(
              [
                { name: SITE_NAME, path: '' },
                { name: artist, path: `/artist/${rawArtist}` },
                { name: title, path: `/song/${rawTitle}/${rawArtist}` },
              ],
              locale,
            ),
          ]}
        />
      )}
    </>
  );
}
