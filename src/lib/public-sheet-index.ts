import { cache } from 'react';
import { estCopieDeGroupe } from '@/lib/sheet-catalogue';
import { getAdminDb } from '@/lib/firebase-admin';
// Réexport pour les appelants serveur, qui l'importaient d'ici avant que la clé
// serve aussi côté navigateur.
export { songKey } from '@/lib/sheet-groups';

/**
 * Index des grilles publiques, lu côté serveur.
 *
 * Volontairement réduit aux champs dont le sitemap, les pages de regroupement et
 * la page de découverte ont besoin : une grille complète pèse ses sections, ses
 * accords personnalisés et parfois ses paroles, et il n'y a aucune raison de
 * charger tout ça pour produire une liste d'URL ou une vignette. Mesuré sur le
 * catalogue : 780 ko pour les grilles entières, 12 ko pour cette projection.
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
  /** Son nom d'affichage : la recherche du catalogue cherche aussi dedans. */
  ownerName?: string;
  /**
   * Groupe propriétaire, le cas échéant. Une grille de groupe a pour `ownerId`
   * l'identifiant de son groupe : le sitemap doit pouvoir l'écarter des profils.
   * Absent des lectures ciblées (par artiste, par accord), qui n'en ont pas besoin.
   */
  groupId?: string;
  /** Genres et niveau, pour filtrer sans requête supplémentaire. */
  genres?: string[];
  difficulty?: number | null;
  /**
   * Accords employés, tels qu'ils sont stockés : en minuscules.
   *
   * Absents des lectures ciblées, qui n'en ont pas besoin. Sert à compter les
   * accords les plus joués sans une seconde traversée du catalogue.
   */
  chords?: string[];
  /**
   * De quoi composer les rayons et les tuiles d'`/explore` sans seconde lecture.
   *
   * Ces champs sont renseignés sur la totalité du catalogue public (vérifié :
   * 130/130 pour `viewCount`, `year`, `createdAt`, `capo` ; 128/130 pour `key`).
   * Les ajouter au `select` ne coûte rien de plus qu'une lecture de document,
   * alors que les obtenir autrement demanderait une requête par rayon — et des
   * index composites qui n'existent pas.
   *
   * `viewCount` est un cumul depuis toujours, jamais fenêtré : il classe les
   * grilles les plus vues, il ne dit rien d'une tendance.
   */
  viewCount?: number;
  year?: number | null;
  key?: string;
  createdAt?: Date | null;
  capo?: number | null;
  averageRating?: number | null;
  ratingCount?: number;
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
      .select(
        'title', 'artist', 'updatedAt', 'ownerId', 'ownerName', 'groupId', 'forkedFrom', 'genres', 'difficulty', 'chords',
        'viewCount', 'year', 'key', 'createdAt', 'capo', 'averageRating', 'ratingCount',
      )
      .limit(MAX_SHEETS)
      .get();

    // getAdminDb() passe par un require : son type est `any`. On ne décrit que la
    // forme réellement utilisée plutôt que de propager le any.
    const docs = snap.docs as { id: string; data: () => Record<string, unknown> }[];

    // Les grilles de groupe sont des copies : hors catalogue, donc hors sitemap,
    // hors pages d'artiste et hors pages d'accord.
    return docs
      .filter((d) => !estCopieDeGroupe({
        groupId: typeof d.data().groupId === 'string' ? (d.data().groupId as string) : null,
        forkedFrom: typeof d.data().forkedFrom === 'string' ? (d.data().forkedFrom as string) : null,
      }))
      .map((d) => {
        const data = d.data();
        const enDate = (v: unknown) => {
          const t = v as { toDate?: () => Date } | undefined;
          return t?.toDate ? t.toDate() : null;
        };
        return {
          id: d.id,
          title: typeof data.title === 'string' ? data.title : '',
          artist: typeof data.artist === 'string' ? data.artist : '',
          updatedAt: enDate(data.updatedAt),
          ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
          ownerName: typeof data.ownerName === 'string' ? data.ownerName : '',
          groupId: '',
          genres: Array.isArray(data.genres) ? (data.genres as string[]) : [],
          difficulty: typeof data.difficulty === 'number' ? data.difficulty : null,
          chords: Array.isArray(data.chords) ? (data.chords as string[]) : [],
          viewCount: typeof data.viewCount === 'number' ? data.viewCount : 0,
          year: typeof data.year === 'number' ? data.year : null,
          key: typeof data.key === 'string' ? data.key : '',
          createdAt: enDate(data.createdAt),
          capo: typeof data.capo === 'number' ? data.capo : null,
          averageRating: typeof data.averageRating === 'number' ? data.averageRating : null,
          ratingCount: typeof data.ratingCount === 'number' ? data.ratingCount : 0,
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

    // Copies de groupe écartées, comme partout dans le catalogue.
    return docs
      .filter((d) => !estCopieDeGroupe({
        groupId: typeof d.data().groupId === 'string' ? (d.data().groupId as string) : null,
        forkedFrom: typeof d.data().forkedFrom === 'string' ? (d.data().forkedFrom as string) : null,
      }))
      .map((d) => {
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

    // Copies de groupe écartées, comme partout dans le catalogue.
    return docs
      .filter((d) => !estCopieDeGroupe({
        groupId: typeof d.data().groupId === 'string' ? (d.data().groupId as string) : null,
        forkedFrom: typeof d.data().forkedFrom === 'string' ? (d.data().forkedFrom as string) : null,
      }))
      .map((d) => {
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
/**
 * Les accords les plus employés du catalogue public.
 *
 * Compté sur les grilles elles-mêmes, une grille comptant pour un quel que soit le
 * nombre de fois où l'accord y revient : « présent dans quarante-six grilles » dit
 * quelque chose, « joué trois cents fois » ne dit que la longueur des morceaux.
 *
 * Lu depuis l'index public plutôt que par une requête propre : les cinq pages
 * d'instrument se construisent en deux langues, ce qui aurait fait dix traversées
 * du catalogue à chaque déploiement pour une réponse identique.
 *
 * Les noms sont ceux du champ `chords`, normalisés en minuscules à l'écriture :
 * c'est à l'appelant de les rapprocher des noms d'affichage de sa bibliothèque.
 */
export async function getTopChords(max = 12): Promise<{ nom: string; grilles: number }[]> {
  const compte = new Map<string, number>();
  for (const sheet of await getPublicSheetIndex()) {
    for (const nom of new Set(sheet.chords ?? [])) {
      if (nom) compte.set(nom, (compte.get(nom) ?? 0) + 1);
    }
  }

  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([nom, grilles]) => ({ nom, grilles }));
}

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
