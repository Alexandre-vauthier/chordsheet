import type { Metadata } from 'next';
import { cache } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { fromFirestore } from '@/lib/firestore-helpers';
import type { Sheet } from '@/types';
import { buildAlternates, buildOpenGraph, NO_INDEX, SITE_NAME } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';
import { musicCompositionSchema, breadcrumbSchema } from '@/lib/seo-schema';
import { RelatedSheets } from '@/components/seo/related-sheets';
import { SheetViewClient } from './sheet-view-client';

/**
 * Grille lue côté serveur, uniquement si elle est publique ou non répertoriée.
 *
 * `cache()` évite que `generateMetadata` et le composant page ne lisent deux fois
 * le même document — sans lui, le coût Firestore double à chaque visite.
 *
 * Une grille privée renvoie `null` : le serveur ne connaît pas l'utilisateur, donc
 * il ne peut pas décider de la lui montrer. C'est le composant client, authentifié,
 * qui s'en charge — et rien de privé ne fuite dans le HTML.
 */
const getPublicSheet = cache(async (id: string): Promise<{ sheet: Sheet; unlisted: boolean } | null> => {
  try {
    const snap = await getAdminDb().collection('sheets').doc(id).get();
    if (!snap.exists) return null;

    const data = snap.data() as Record<string, unknown> | undefined;
    if (!data || (!data.isPublic && !data.isUnlisted)) return null;

    // Les paroles ne sortent jamais du serveur. Ce sont des textes sous droits que
    // nous n'avons pas le droit de publier : les laisser dans le HTML servi
    // reviendrait à les faire indexer sous notre nom. Le composant client les
    // récupère depuis Firestore après hydratation, comme il l'a toujours fait.
    const { lyrics: _lyrics, ...withoutLyrics } = data;

    return { sheet: fromFirestore(id, withoutLyrics), unlisted: !data.isPublic };
  } catch {
    return null;
  }
});

/** Revalidation horaire : une modification apparaît au plus tard une heure après. */
export const revalidate = 3600;

interface ViewSheetPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: ViewSheetPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const found = await getPublicSheet(id);
  if (!found) return {};

  const { sheet, unlisted } = found;
  const path = `/sheet/${id}`;

  // Ces textes etaient ecrits en dur, en francais et sous l'ancien nom : les pages
  // anglaises servaient donc une description francaise, et Google affichait encore
  // « ChordSheet » dans ses resultats.
  const t = await getTranslations({ locale, namespace: 'Seo.pages.sheet' });
  const title = t('title', { title: sheet.title, artist: sheet.artist });
  const description = t('description', {
    title: sheet.title,
    artist: sheet.artist,
    key: sheet.key ? ` (${sheet.key})` : '',
    site: SITE_NAME,
  });

  // Next expose l'image voisine (opengraph-image.tsx) sous une URL versionnée qu'il
  // génère lui-même. Il ne l'injecte que si les métadonnées ne fixent pas d'images :
  // on retire donc le visuel générique posé par buildOpenGraph plutôt que de tenter
  // de deviner cette URL.
  const { images: _genericImage, ...og } = buildOpenGraph(locale, path)!;

  return {
    title,
    description,
    // Une grille non répertoriée se partage par lien mais ne s'indexe pas : c'est
    // exactement ce que « non répertorié » promet à son auteur.
    ...(unlisted ? { robots: NO_INDEX } : { alternates: buildAlternates(locale, path) }),
    openGraph: { ...og, title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ViewSheetPage({ params }: ViewSheetPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const found = await getPublicSheet(id);
  const sheet = found?.sheet ?? null;

  return (
    <>
      <SheetViewClient id={id} initialSheet={sheet} />
      {sheet && !found?.unlisted && (
        <RelatedSheets locale={locale} sheetId={id} title={sheet.title} artist={sheet.artist} />
      )}
      {sheet && !found?.unlisted && (
        <JsonLd
          data={[
            musicCompositionSchema(locale, {
              title: sheet.title,
              artist: sheet.artist,
              musicalKey: sheet.key,
              path: `/sheet/${id}`,
            }),
            breadcrumbSchema(
              [
                { name: SITE_NAME, path: '' },
                { name: sheet.artist, path: `/artist/${encodeURIComponent(sheet.artist)}` },
                { name: sheet.title, path: `/sheet/${id}` },
              ],
              locale,
            ),
          ]}
        />
      )}
    </>
  );
}
