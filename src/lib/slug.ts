/**
 * Fabriquer un slug d'URL depuis du texte libre.
 *
 * Partagé par les adresses de grille et celles d'artiste. Deux copies auraient
 * divergé au premier ajustement, et un artiste dont le slug ne se calcule pas
 * pareil selon l'endroit devient un artiste introuvable.
 *
 * Le catalogue est francophone : les accents sont **translittérés** et non retirés
 * (« Éléonore » donne `eleonore`, pas `lonore`), et les ligatures que la
 * décomposition Unicode ignore sont traitées à part — « Cœur » donne `coeur`.
 */

/** Ce que `NFD` ne décompose pas : sans cette table, « cœur » deviendrait `c-ur`. */
const LIGATURES: [RegExp, string][] = [
  [/œ/g, 'oe'],
  [/æ/g, 'ae'],
  [/ß/g, 'ss'],
  [/ø/g, 'o'],
  [/ł/g, 'l'],
  [/đ|ð/g, 'd'],
  [/þ/g, 'th'],
];

/**
 * Le slug d'un texte, tronqué à une frontière de mot.
 *
 * Rend une chaîne vide s'il ne reste rien d'exploitable : c'est à l'appelant de
 * décider quoi faire d'un texte sans une seule lettre latine.
 */
export function slugify(texte: string, longueurMax: number): string {
  let s = (texte ?? '').trim().toLowerCase();
  if (!s) return '';

  for (const [motif, remplacement] of LIGATURES) s = s.replace(motif, remplacement);

  s = s
    // On sépare la lettre de son signe diacritique, et on jette le signe.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Tout ce qui n'est ni lettre ni chiffre devient un tiret ; les tirets
    // multiples se compactent, et les bords se nettoient.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (s.length <= longueurMax) return s;
  const coupe = s.slice(0, longueurMax);
  const frontiere = coupe.lastIndexOf('-');
  return (frontiere > 0 ? coupe.slice(0, frontiere) : coupe).replace(/-$/, '');
}
