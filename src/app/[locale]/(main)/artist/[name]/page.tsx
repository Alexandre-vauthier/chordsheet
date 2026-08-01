import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { decodeParam } from '@/lib/decode-param';
import { buildAlternates, buildOpenGraph, NO_INDEX } from '@/lib/seo';
import { ArtistViewClient } from './artist-view-client';

interface ArtistPageProps {
  params: Promise<{ locale: string; name: string }>;
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  // Param URL-encodé (ex. « Save%20Tonight ») : décodage sûr.
  const { locale, name } = await params;
  const artistName = decodeParam(name);
  const path = `/artist/${name}`;

  try {
    const snap = await getAdminDb()
      .collection('sheets')
      .where('isPublic', '==', true)
      .where('artist', '==', artistName)
      .limit(1)
      .get();

    // Aucune grille publique : la page n'a rien à montrer, inutile de l'indexer.
    if (snap.empty) return { robots: NO_INDEX };

    const t = await getTranslations({ locale, namespace: 'Seo.artist' });
    const title = t('title', { artist: artistName });
    const description = t('description', { artist: artistName });

    return {
      title,
      description,
      alternates: buildAlternates(locale, path),
      openGraph: { ...buildOpenGraph(locale, path), title, description, type: 'website' },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return {};
  }
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { locale, name } = await params;
  setRequestLocale(locale);
  return <ArtistViewClient name={name} />;
}
