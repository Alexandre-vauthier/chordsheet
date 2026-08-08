/**
 * L'adresse d'une grille : un slug lisible, puis son identifiant.
 *
 *     /fr/sheet/wonderwall-oasis-UiqCi71Sn9CWBVM8Exm2
 *
 * L'identifiant reste **la seule clé de résolution**. Le slug ne sert qu'à l'œil et
 * aux moteurs : il n'est jamais lu pour retrouver la grille, et il peut donc être
 * périmé, tronqué ou absent sans qu'un lien cesse de fonctionner. C'est ce qui
 * permet de renommer un morceau sans casser ce qui a été partagé.
 *
 * **Pourquoi le tiret comme séparateur.** Mesuré sur le catalogue : les 192
 * identifiants font tous exactement vingt caractères, tous dans `[A-Za-z0-9]`, et
 * aucun ne contient de tiret — ce sont des identifiants Firestore automatiques, qui
 * n'en contiennent jamais. Le dernier segment après le dernier tiret est donc
 * l'identifiant, sans ambiguïté possible avec le slug qui le précède.
 */

/** Un identifiant Firestore automatique : vingt caractères alphanumériques. */
const IDENTIFIANT = /^[A-Za-z0-9]{20}$/;

/**
 * Longueur maximale du slug.
 *
 * Quelques titres sont très longs, et une adresse de trois cents caractères se
 * partage mal — les messageries la coupent. On tranche à la frontière d'un mot pour
 * ne pas laisser de moitié de mot.
 */
const LONGUEUR_MAX = 80;

/**
 * Le slug d'un morceau, depuis son titre et son artiste.
 *
 * Le catalogue est francophone : les accents sont translittérés plutôt que retirés
 * (« Éléonore » donne `eleonore`, pas `lonore`), et les ligatures que la
 * décomposition Unicode ignore sont traitées à part — « Cœur » donne `coeur`.
 *
 * Rend une chaîne vide si rien d'exploitable ne reste : l'adresse se réduit alors à
 * l'identifiant seul, ce qui est laid mais juste.
 */
export function sheetSlug(title?: string | null, artist?: string | null): string {
  const brut = [title, artist].map((v) => (v ?? '').trim()).filter(Boolean).join(' ');
  if (!brut) return '';

  const slug = brut
    .toLowerCase()
    // Les ligatures d'abord : `NFD` ne les décompose pas, et sans cette étape
    // « cœur » deviendrait `c-ur`.
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/đ|ð/g, 'd')
    .replace(/þ/g, 'th')
    // Puis les accents : on sépare la lettre de son signe, et on jette le signe.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Tout ce qui n'est ni lettre ni chiffre devient un tiret, les tirets multiples
    // se compactent, et les bords se nettoient.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (slug.length <= LONGUEUR_MAX) return slug;
  const coupe = slug.slice(0, LONGUEUR_MAX);
  const frontiere = coupe.lastIndexOf('-');
  return (frontiere > 0 ? coupe.slice(0, frontiere) : coupe).replace(/-$/, '');
}

/**
 * Le segment d'adresse d'une grille : `slug-identifiant`, ou l'identifiant seul.
 *
 * C'est la forme canonique. Toute autre forme de la même grille y est redirigée en
 * permanence — voir la page `/sheet/[id]`.
 */
export function sheetSegment(id: string, title?: string | null, artist?: string | null): string {
  const slug = sheetSlug(title, artist);
  return slug ? `${slug}-${id}` : id;
}

/** Le chemin complet, sans préfixe de langue — celui-ci est ajouté par la navigation. */
export function sheetPath(
  sheet: { id?: string; title?: string | null; artist?: string | null },
): string {
  return `/sheet/${sheetSegment(sheet.id ?? '', sheet.title, sheet.artist)}`;
}

/**
 * L'identifiant contenu dans un segment d'adresse.
 *
 * C'est la seule lecture qui compte : le slug est ignoré, quel qu'il soit. Trois cas
 * se présentent, et tous les trois rendent l'identifiant.
 *
 * - `wonderwall-oasis-UiqCi71Sn9CWBVM8Exm2` — le dernier segment est un identifiant.
 * - `UiqCi71Sn9CWBVM8Exm2` — l'ancienne forme, sans tiret : le tout est l'identifiant.
 * - `un-truc-bizarre` — le dernier segment n'a pas la forme d'un identifiant. On rend
 *   le segment entier, qui n'existera pas en base : la page dira qu'elle ne trouve
 *   rien, plutôt que d'aller chercher « bizarre ».
 */
export function sheetIdFromSegment(segment: string): string {
  const decode = (() => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  })();
  const dernier = decode.slice(decode.lastIndexOf('-') + 1);
  return IDENTIFIANT.test(dernier) ? dernier : decode;
}

/**
 * Les chemins à invalider quand une grille change.
 *
 * Trois formes, dans chaque langue, et chacune pour une raison précise.
 *
 * - **L'identifiant nu.** C'est la page qui doit se mettre à rediriger le jour où
 *   la grille devient lisible par le serveur. Sans l'invalider, une grille passée
 *   de privée à publique garderait une heure sa page en cache, sans redirection.
 * - **Le nouveau segment.** Il n'a peut-être jamais été rendu ; l'invalider ne
 *   coûte rien et garantit qu'il servira le titre à jour.
 * - **L'ancien segment**, quand le titre ou l'artiste ont changé. C'est lui qui,
 *   sinon, continuerait à servir un 200 avec l'ancien titre là où il doit
 *   désormais rediriger vers le nouveau slug. C'est le cas qu'on oublie, et le
 *   seul qui demande de connaître l'état d'avant.
 *
 * Sans doublon : quand rien n'a été renommé, les trois formes se réduisent souvent
 * à deux.
 */
export function sheetRevalidationPaths(
  locales: readonly string[],
  sheet: {
    id?: string;
    title?: string | null;
    artist?: string | null;
    previousTitle?: string | null;
    previousArtist?: string | null;
  },
): string[] {
  const id = sheet.id;
  if (!id) return [];

  const segments = new Set([
    id,
    sheetSegment(id, sheet.title, sheet.artist),
    sheetSegment(id, sheet.previousTitle ?? sheet.title, sheet.previousArtist ?? sheet.artist),
  ]);

  return locales.flatMap((l) => [...segments].map((s) => `/${l}/sheet/${s}`));
}
