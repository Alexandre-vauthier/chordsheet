import type { Metadata } from 'next';
import { filtrerCatalogue } from '@/lib/sheet-catalogue';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cache } from 'react';
import { getAdminDb } from '@/lib/firebase-admin';
import { fromFirestore } from '@/lib/firestore-helpers';
import type { Sheet } from '@/types';
import { JsonLd } from '@/components/seo/json-ld';
import { musicGroupSchema, breadcrumbSchema } from '@/lib/seo-schema';
import { decodeParam } from '@/lib/decode-param';
import { buildAlternates, buildOpenGraph, localeUrl, NO_INDEX, SITE_NAME } from '@/lib/seo';
import { ArtistViewClient } from './artist-view-client';
import { sheetPath } from '@/lib/sheet-url';

interface ArtistPageProps {
  params: Promise<{ locale: string; name: string }>;
}

/**
 * Grilles publiques d'un artiste, lues côté serveur.
 *
 * `cache()` est indispensable : sans lui, `generateMetadata` et le composant page
 * feraient chacun leur requête pour le même artiste, doublant le coût Firestore à
 * chaque visite comme à chaque passage de robot.
 *
 * Les Timestamp de l'Admin SDK ne traversent pas la frontière serveur/client :
 * `fromFirestore` les convertit déjà en Date, on sérialise ensuite en chaîne ISO
 * au moment de passer la prop.
 */
const getArtistSheets = cache(async (artistName: string): Promise<Sheet[]> => {
  try {
    const snap = await getAdminDb()
      .collection('sheets')
      .where('isPublic', '==', true)
      .where('artist', '==', artistName)
      .limit(100)
      .get();

    // getAdminDb() passe par un require, son type est donc `any` : on décrit ici la
    // seule forme dont on se sert, plutôt que de propager le any plus loin.
    const docs = snap.docs as { id: string; data: () => Record<string, unknown> }[];
    // Hors catalogue : une copie de groupe ferait doublon avec la grille d'origine.
    const sheets: Sheet[] = filtrerCatalogue(docs.map((d) => fromFirestore(d.id, d.data())));
    return sheets.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
  } catch {
    // Lecture serveur indisponible : le composant client prendra le relais.
    return [];
  }
});

/*
 * Pas de `revalidate` ici, et c'est délibéré.
 *
 * Il y en avait un, et il ne servait à rien : `next build` classe cette route
 * `ƒ Dynamic — server-rendered on demand`, elle est donc rendue à chaque requête
 * et aucune durée de cache ne s'y applique. Mesuré en production : la réponse
 * porte `cache-control: no-store` et deux requêtes de suite ne rendent pas le
 * même HTML. La déclaration laissait croire à une mise en cache inexistante, ce
 * qui est pire que son absence — on raisonne faux sur la fraîcheur des données.
 *
 * La cause n'est pas une API dynamique : avec `dynamic = 'error'`, la page se rend
 * statiquement sans broncher. C'est l'absence de `generateStaticParams` sur un
 * segment dynamique qui suffit à faire basculer Next en rendu par requête.
 * Le jour où l'on voudra cacher ces pages, c'est là qu'il faudra revenir.
 */

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  // Param URL-encodé (ex. « Save%20Tonight ») : décodage sûr.
  const { locale, name } = await params;
  const artistName = decodeParam(name);
  const path = `/artist/${name}`;

  try {
    const sheets = await getArtistSheets(artistName);

    // Aucune grille publique : la page n'a rien à montrer, inutile de l'indexer.
    if (sheets.length === 0) return { robots: NO_INDEX };

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

  const artistName = decodeParam(name);
  const sheets = await getArtistSheets(artistName);

  return (
    <>
      <ArtistViewClient name={name} initialSheets={sheets} />
      {sheets.length > 0 && (
        <JsonLd
          data={[
            musicGroupSchema(locale, {
              name: artistName,
              path: `/artist/${name}`,
              // On ne décrit que ce que la page rend réellement.
              items: sheets.map((s) => ({ title: s.title, url: localeUrl(locale, sheetPath(s)) })),
            }),
            breadcrumbSchema(
              [{ name: SITE_NAME, path: '' }, { name: artistName, path: `/artist/${name}` }],
              locale,
            ),
          ]}
        />
      )}
    </>
  );
}
