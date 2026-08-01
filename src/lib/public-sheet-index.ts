import { cache } from 'react';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Index des grilles publiques, lu côté serveur.
 *
 * Volontairement réduit aux quatre champs dont le sitemap et les pages de
 * regroupement ont besoin : une grille complète pèse ses sections, ses accords
 * personnalisés et parfois ses paroles, et il n'y a aucune raison de charger tout
 * ça pour produire une liste d'URL.
 *
 * `cache()` mémorise le résultat pour la durée d'un rendu : la page sitemap le lit
 * une fois, quel que soit le nombre d'appels.
 */
export interface PublicSheetRef {
  id: string;
  title: string;
  artist: string;
  updatedAt: Date | null;
}

/**
 * Plafond volontaire. Le format sitemap admet 50 000 URL par fichier ; on s'arrête
 * bien avant, à un volume qui reste lisible en une requête. Le jour où le catalogue
 * s'en approche, il faudra passer à un index de sitemaps paginé — pas avant.
 */
const MAX_SHEETS = 5000;

export const getPublicSheetIndex = cache(async (): Promise<PublicSheetRef[]> => {
  try {
    const snap = await getAdminDb()
      .collection('sheets')
      .where('isPublic', '==', true)
      .select('title', 'artist', 'updatedAt')
      .limit(MAX_SHEETS)
      .get();

    // getAdminDb() passe par un require : son type est `any`. On ne décrit que la
    // forme réellement utilisée plutôt que de propager le any.
    const docs = snap.docs as { id: string; data: () => Record<string, unknown> }[];

    return docs.map((d) => {
      const data = d.data();
      const updatedAt = data.updatedAt as { toDate?: () => Date } | undefined;
      return {
        id: d.id,
        title: typeof data.title === 'string' ? data.title : '',
        artist: typeof data.artist === 'string' ? data.artist : '',
        updatedAt: updatedAt?.toDate ? updatedAt.toDate() : null,
      };
    });
  } catch {
    // Firebase Admin indisponible (variable d'environnement manquante, quota…) :
    // le sitemap se limite alors à ses pages fixes. Mieux vaut un sitemap partiel
    // qu'une page en erreur, qui ferait retirer le fichier entier par le moteur.
    return [];
  }
});

/** Clé de regroupement d'un même morceau, insensible à la casse et aux espaces. */
export function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

/**
 * Les grilles publiques d'un artiste, en version allégée.
 *
 * Sert au maillage interne depuis une page de grille : proposer les autres versions
 * du même morceau et le reste du répertoire de l'artiste. Requête ciblée sur
 * l'artiste plutôt que lecture de l'index complet — quelques documents au lieu de
 * quelques milliers.
 */
export const getArtistSheetRefs = cache(async (artist: string): Promise<PublicSheetRef[]> => {
  if (!artist) return [];

  try {
    const snap = await getAdminDb()
      .collection('sheets')
      .where('isPublic', '==', true)
      .where('artist', '==', artist)
      .select('title', 'artist', 'updatedAt')
      .limit(50)
      .get();

    const docs = snap.docs as { id: string; data: () => Record<string, unknown> }[];

    return docs.map((d) => {
      const data = d.data();
      const updatedAt = data.updatedAt as { toDate?: () => Date } | undefined;
      return {
        id: d.id,
        title: typeof data.title === 'string' ? data.title : '',
        artist: typeof data.artist === 'string' ? data.artist : '',
        updatedAt: updatedAt?.toDate ? updatedAt.toDate() : null,
      };
    });
  } catch {
    return [];
  }
});
