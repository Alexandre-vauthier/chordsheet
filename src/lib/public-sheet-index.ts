import { cache } from 'react';
import { getAdminDb } from '@/lib/firebase-admin';
// Réexport pour les appelants serveur, qui l'importaient d'ici avant que la clé
// serve aussi côté navigateur.
export { songKey } from '@/lib/sheet-groups';

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
  /** Auteur de la grille : sert à déclarer les profils publics au sitemap. */
  ownerId: string;
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
      .select('title', 'artist', 'updatedAt', 'ownerId')
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
        ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
      };
    });
  } catch {
    // Firebase Admin indisponible (variable d'environnement manquante, quota…) :
    // le sitemap se limite alors à ses pages fixes. Mieux vaut un sitemap partiel
    // qu'une page en erreur, qui ferait retirer le fichier entier par le moteur.
    return [];
  }
});


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
      .select('title', 'artist', 'updatedAt', 'ownerId')
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
        ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
      };
    });
  } catch {
    return [];
  }
});

/**
 * Les grilles publiques qui utilisent un accord donné.
 *
 * S'appuie sur le champ `chords` déposé par `toFirestore` : sans lui, il faudrait
 * parcourir toutes les grilles et fouiller leurs sections à chaque page d'accord.
 * L'accord attendu est sous sa forme canonique, celle que produit `normalizeChord`.
 */
export const getSheetsWithChord = cache(async (chord: string, max = 12): Promise<PublicSheetRef[]> => {
  if (!chord) return [];

  try {
    const snap = await getAdminDb()
      .collection('sheets')
      .where('isPublic', '==', true)
      .where('chords', 'array-contains', chord)
      .select('title', 'artist', 'updatedAt', 'ownerId')
      .limit(max)
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
        ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
      };
    });
  } catch {
    // Index composite absent ou reprise pas encore lancée : la page se passe de cette
    // section plutôt que d'échouer.
    return [];
  }
});


/**
 * Les groupes rendus publics par leur leader, pour le sitemap.
 *
 * Une vitrine que personne ne peut découvrir ne sert qu'à ceux qui ont déjà le lien.
 * La déclarer permet à quelqu'un qui cherche le nom d'un créateur de tomber dessus,
 * ce qui est exactement le canal qu'on essaie d'ouvrir.
 */
export const getPublicBands = cache(async (): Promise<{ id: string; updatedAt: Date | null }[]> => {
  try {
    const snap = await getAdminDb()
      .collection('groups')
      .where('isPublic', '==', true)
      .select('updatedAt')
      .limit(500)
      .get();

    const docs = snap.docs as { id: string; data: () => Record<string, unknown> }[];
    return docs.map((d) => {
      const updatedAt = d.data().updatedAt as { toDate?: () => Date } | undefined;
      return { id: d.id, updatedAt: updatedAt?.toDate ? updatedAt.toDate() : null };
    });
  } catch {
    return [];
  }
});
