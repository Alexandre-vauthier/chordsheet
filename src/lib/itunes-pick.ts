/**
 * Choisir, parmi les résultats iTunes, celui qui parle bien du morceau demandé.
 *
 * La route prenait `results[0]`, c'est-à-dire ce qu'iTunes juge le plus pertinent
 * pour une suite de mots — sans jamais vérifier que l'artiste est le bon. Sur un
 * échantillon de 28 grilles du catalogue, un résultat correct existait dans les 25
 * renvoyés pour 24 d'entre elles, et le premier n'était le bon que 23 fois : « La
 * Vie En Rose » d'Édith Piaf ramenait la reprise de Louis Armstrong, avec sa
 * pochette et son extrait.
 *
 * On ne se fie donc plus au classement seul. Quand l'artiste demandé est connu, on
 * retient le premier résultat qui le porte vraiment ; à défaut de correspondance,
 * on retombe sur le classement d'iTunes, qui reste meilleur que rien.
 */

export interface ItunesResultat {
  artistName?: string;
  trackName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
  primaryGenreName?: string;
  releaseDate?: string;
}

/**
 * Forme comparable d'un nom : sans casse, sans accent, sans ce qui est entre
 * parenthèses ou crochets, sans ponctuation.
 *
 * Les mentions parenthésées sont ce qui sépare le plus souvent deux écritures du
 * même morceau — « (Remastered 2011) », « (Single Version) », « [Live] ».
 */
export function normaliserTexte(valeur: string | undefined): string {
  return (valeur ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[([].*?[)\]]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Deux noms désignent-ils la même chose ?
 *
 * L'inclusion est admise dans les deux sens, parce que les deux côtés abrègent :
 * une grille dit « Beatles » là où iTunes dit « The Beatles », et iTunes dit
 * « Bohemian Rhapsody (2011 Mix) » là où la grille dit « Bohemian Rhapsody ». Elle
 * est bornée à trois caractères : sans ce plancher, « U2 » correspondrait à tout
 * nom contenant ces deux lettres.
 */
export function correspond(a: string | undefined, b: string | undefined): boolean {
  const x = normaliserTexte(a);
  const y = normaliserTexte(b);
  if (!x || !y) return false;
  // Deux découpages, parce qu'aucun ne suffit seul. La ponctuation devient une
  // espace : « What's » donne « what s », qu'un titre saisi sans apostrophe —
  // « Whats My Age Again », comme dans le catalogue — ne rejoint pas. La coller
  // règle ce cas, mais séparerait « rock n roll » de « rock'n'roll ». On accepte
  // donc l'un **ou** l'autre.
  return memeChaine(x, y) || memeChaine(x.replaceAll(' ', ''), y.replaceAll(' ', ''));
}

function memeChaine(x: string, y: string): boolean {
  if (x === y) return true;
  if (Math.min(x.length, y.length) < 3) return false;
  return x.includes(y) || y.includes(x);
}

/**
 * Le meilleur résultat pour cette demande.
 *
 * L'artiste pèse plus que le titre : c'est lui qui distingue l'original de la
 * reprise, alors que le titre est le plus souvent commun aux deux. À égalité de
 * score, le classement d'iTunes tranche — on garde donc le premier rencontré.
 *
 * Aucun résultat ne marque de point : on rend `results[0]`. Ne rien rendre
 * priverait de pochette des morceaux qu'iTunes trouve correctement mais que notre
 * comparaison ne sait pas reconnaître (orthographe, translittération, artiste
 * crédité autrement).
 */
export function choisirResultat<T extends ItunesResultat>(
  results: T[],
  artiste?: string,
  titre?: string,
): T | undefined {
  if (!Array.isArray(results) || results.length === 0) return undefined;
  if (!artiste && !titre) return results[0];

  let meilleur = results[0];
  let meilleurScore = 0;

  for (const r of results) {
    const score =
      (artiste && correspond(r.artistName, artiste) ? 2 : 0) +
      (titre && correspond(r.trackName, titre) ? 1 : 0);
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = r;
    }
  }
  return meilleur;
}
