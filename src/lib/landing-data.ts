import { cache } from 'react';
import { getPublicSheetIndex } from './public-sheet-index';
import { artistSlug } from './artist-url';

/**
 * Ce que la page d'accueil peut dire de vrai sur le catalogue.
 *
 * Elle affichait « 40+ grilles partagées par la communauté », et ce n'était pas un
 * chiffre : la requête du navigateur portait `limit(40)`, si bien que le compteur
 * était **plafonné par sa propre lecture**. Le catalogue en comptait 258. Un
 * plafond de requête déguisé en donnée, et qui se dévaluait lui-même.
 *
 * On le lit donc côté serveur, sur l'index déjà utilisé par le sitemap et par
 * Explorer — la même source, les mêmes exclusions (les copies de groupe sont hors
 * catalogue), et un chiffre qui entre dans le HTML servi au lieu d'apparaître une
 * demi-seconde après l'hydratation.
 */
export interface ChiffresDuCatalogue {
  grilles: number;
  artistes: number;
}

/** Une grille réduite à ce qu'il faut pour une pochette du mur. */
export interface GrilleEnAvant {
  id: string;
  title: string;
  artist: string;
}

export interface DonneesAccueil {
  chiffres: ChiffresDuCatalogue;
  /** Les plus vues, pour le mur de pochettes. */
  enAvant: GrilleEnAvant[];
}

/**
 * Combien de pochettes le mur consomme.
 *
 * Quatre colonnes qui défilent en boucle : en dessous d'une trentaine, la même
 * pochette repasse trop vite et le mur se lit comme une répétition.
 */
const POUR_LE_MUR = 40;

export const getDonneesAccueil = cache(async (): Promise<DonneesAccueil> => {
  const index = await getPublicSheetIndex();

  // Le décompte d'artistes passe par le slug, comme les pages d'artiste : sans
  // cela « Francis Cabrel » et « Françis Cabrel » compteraient pour deux, alors
  // que le site n'a qu'une page pour les deux.
  const artistes = new Set(
    index.map((s) => artistSlug(s.artist)).filter(Boolean),
  );

  const enAvant = [...index]
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    .slice(0, POUR_LE_MUR)
    .map(({ id, title, artist }) => ({ id, title, artist }));

  return { chiffres: { grilles: index.length, artistes: artistes.size }, enAvant };
});
