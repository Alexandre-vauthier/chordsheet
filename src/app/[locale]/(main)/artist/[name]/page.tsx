import type { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';
import { ArtistViewClient } from './artist-view-client';

interface ArtistPageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  // Param déjà URL-décodé par Next : pas de decodeURIComponent (planterait sur un '%').
  const { name: artistName } = await params;

  try {
    const snap = await getAdminDb()
      .collection('sheets')
      .where('isPublic', '==', true)
      .where('artist', '==', artistName)
      .limit(1)
      .get();
    if (snap.empty) return {};

    const title = `Grilles d'accords de ${artistName}`;
    const description = `Retrouve toutes les grilles d'accords de ${artistName} sur ChordSheet : consulte, transpose et joue les morceaux de cet artiste.`;

    return {
      title,
      description,
      openGraph: { title, description, type: 'website' },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return {};
  }
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { name } = await params;
  return <ArtistViewClient name={name} />;
}
