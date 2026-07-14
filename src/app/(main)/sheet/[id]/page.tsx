import type { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';
import { SheetViewClient } from './sheet-view-client';

interface ViewSheetPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ViewSheetPageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const snap = await getAdminDb().collection('sheets').doc(id).get();
    if (!snap.exists) return {};

    const data = snap.data();
    if (!data || (!data.isPublic && !data.isUnlisted)) return {};

    const title = `${data.title} — ${data.artist}`;
    const description = `Grille d'accords de « ${data.title} » par ${data.artist}${data.key ? ` (${data.key})` : ''}. Consulte, transpose et joue sur ChordSheet.`;

    return {
      title,
      description,
      openGraph: { title, description, type: 'article' },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return {};
  }
}

export default async function ViewSheetPage({ params }: ViewSheetPageProps) {
  const { id } = await params;
  return <SheetViewClient id={id} />;
}
