import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cache } from 'react';
import { getAdminDb } from '@/lib/firebase-admin';
import { fromFirestore } from '@/lib/firestore-helpers';
import { buildAlternates, buildOpenGraph, NO_INDEX, SITE_NAME } from '@/lib/seo';
import { breadcrumbSchema } from '@/lib/seo-schema';
import { JsonLd } from '@/components/seo/json-ld';
import type { Sheet } from '@/types';
import { PublicBandClient, type PublicBand, type PublicSet } from './public-band-client';

interface BandPageProps {
  params: Promise<{ locale: string; id: string }>;
}

/**
 * Vitrine publique d'un groupe, lisible **sans compte**.
 *
 * C'est l'objet qu'un créateur poste dans sa bio ou sous une vidéo : son répertoire
 * en un lien, jouable tout de suite. Exiger une inscription avant d'afficher quoi
 * que ce soit condamnerait l'usage, et rendrait la page invisible des moteurs.
 *
 * Deux principes de sûreté, puisque la page s'adresse à des inconnus :
 *
 * - **liste blanche des champs du groupe.** `memberIds`, `roles` et le concert en
 *   cours restent au serveur. Ce qui n'est pas nommé ici ne peut pas fuiter.
 * - **seules les grilles déjà publiques sortent.** Un set de groupe peut contenir
 *   une grille privée ; la rendre visible parce qu'elle est dans un groupe public
 *   inventerait une règle de partage que personne n'a demandée.
 *
 * Rendre le groupe public n'ouvre donc aucun droit : ni adhésion, ni écriture.
 */
interface ServerBand {
  band: PublicBand | null;
  sets: PublicSet[];
  /** Grilles publiques du groupe qui ne sont dans aucun set. */
  loose: Sheet[];
}

/** Lecture par paquets de dix : `where(documentId(), 'in', …)` n'en accepte pas plus. */
async function loadSheets(db: ReturnType<typeof getAdminDb>, ids: string[]): Promise<Map<string, Sheet>> {
  const out = new Map<string, Sheet>();
  const uniques = [...new Set(ids)].filter(Boolean);

  for (let i = 0; i < uniques.length; i += 10) {
    const lot = uniques.slice(i, i + 10);
    const snaps = await Promise.all(lot.map((id) => db.collection('sheets').doc(id).get()));
    for (const snap of snaps as { id: string; exists: boolean; data: () => Record<string, unknown> }[]) {
      if (!snap.exists) continue;
      const data = snap.data();
      // Le filtre qui compte : une grille privée ne sort jamais d'ici.
      if (data.isPublic !== true) continue;
      out.set(snap.id, fromFirestore(snap.id, data));
    }
  }
  return out;
}

const getServerBand = cache(async (id: string): Promise<ServerBand> => {
  try {
    const db = getAdminDb();
    const snap = await db.collection('groups').doc(id).get();
    if (!snap.exists) return { band: null, sets: [], loose: [] };

    const data = (snap.data() ?? {}) as Record<string, unknown>;
    if (data.isPublic !== true) return { band: null, sets: [], loose: [] };

    const createdAt = data.createdAt as { toDate?: () => Date } | undefined;
    const band: PublicBand = {
      id,
      name: typeof data.name === 'string' ? data.name : '',
      description: typeof data.description === 'string' ? data.description : '',
      photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
      ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
      createdAt: createdAt?.toDate ? createdAt.toDate() : null,
    };

    /**
     * Un groupe tient ses grilles de trois façons, et il faut les trois.
     *
     * - `groupId` posé **sur la grille** : c'est le rattachement principal, celui
     *   qu'utilise la page du groupe (`where('groupId', '==', …)`). L'oublier
     *   laissait la vitrine vide alors que le répertoire était bien là.
     * - `linkedSheetIds` : des grilles publiques d'autres auteurs, référencées.
     * - les sets du groupe, qui pointent leurs propres grilles.
     */
    const [setsSnap, ownSnap] = await Promise.all([
      db.collection('sets').where('groupId', '==', id).get(),
      db.collection('sheets').where('groupId', '==', id).where('isPublic', '==', true).get(),
    ]);
    const setDocs = setsSnap.docs as { id: string; data: () => Record<string, unknown> }[];
    const ownDocs = ownSnap.docs as { id: string; data: () => Record<string, unknown> }[];

    const tousLesIds = [
      ...ownDocs.map((d) => d.id),
      ...(Array.isArray(data.linkedSheetIds) ? (data.linkedSheetIds as string[]) : []),
      ...setDocs.flatMap((d) => (Array.isArray(d.data().sheetIds) ? (d.data().sheetIds as string[]) : [])),
    ];
    const grilles = await loadSheets(db, tousLesIds);

    // Un set dont aucune grille n'est publique n'a rien à montrer : on l'omet plutôt
    // que d'afficher un titre vide, qui donnerait l'impression d'un chargement raté.
    const sets: PublicSet[] = setDocs
      .map((d) => {
        const sd = d.data();
        const ids = Array.isArray(sd.sheetIds) ? (sd.sheetIds as string[]) : [];
        return {
          id: d.id,
          name: typeof sd.name === 'string' ? sd.name : '',
          sheets: ids.map((sid) => grilles.get(sid)).filter((s): s is Sheet => !!s),
        };
      })
      .filter((s) => s.sheets.length > 0);

    const dansUnSet = new Set(sets.flatMap((s) => s.sheets.map((sh) => sh.id)));
    const loose = [...grilles.values()].filter((s) => !dansUnSet.has(s.id));

    return { band, sets, loose };
  } catch {
    // Admin SDK indisponible : mieux vaut une page qui dit « introuvable » qu'une
    // page en erreur, qui ferait fuir le visiteur venu du lien du créateur.
    return { band: null, sets: [], loose: [] };
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

export async function generateMetadata({ params }: BandPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const { band } = await getServerBand(id);

  // Groupe privé ou inexistant : rien à indexer, et rien à divulguer.
  if (!band) return { robots: NO_INDEX };

  const t = await getTranslations({ locale, namespace: 'Seo.band' });
  const title = t('title', { name: band.name });
  const description = band.description?.trim() || t('description', { name: band.name });
  const path = `/band/${id}`;

  return {
    title,
    description,
    alternates: buildAlternates(locale, path),
    openGraph: { ...buildOpenGraph(locale, path), title, description, type: 'profile' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function BandPage({ params }: BandPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const { band, sets, loose } = await getServerBand(id);

  return (
    <>
      <PublicBandClient band={band} sets={sets} loose={loose} />
      {band && (
        <JsonLd
          data={breadcrumbSchema(
            [{ name: SITE_NAME, path: '' }, { name: band.name, path: `/band/${id}` }],
            locale,
          )}
        />
      )}
    </>
  );
}
