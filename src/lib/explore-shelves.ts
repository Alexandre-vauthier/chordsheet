import type { PublicSheetRef } from '@/lib/public-sheet-index';
import { DIFFICULTY_LABELS, type Sheet } from '@/types';

/**
 * Les tranches du catalogue qui composent la page de découverte.
 *
 * Tout est ici, et tout est pur : ces fonctions reçoivent l'index public en
 * mémoire et rendent des sous-ensembles. Aucune ne connaît React ni Firebase, ce
 * qui les rend vérifiables par `npm test` — c'est la raison de ce module.
 *
 * Une seule lecture les alimente toutes. Les 130 grilles publiques réduites aux
 * champs de tuile pèsent douze kilo-octets : les chercher rayon par rayon
 * coûterait une requête et un index composite chacune, pour moins de données.
 *
 * La contrainte qui a dicté le découpage : **le catalogue est petit**. Des rayons
 * mal choisis montreraient trois fois les mêmes morceaux. Ceux d'ici tranchent
 * selon des critères sans rapport les uns avec les autres — la popularité, la
 * date, la difficulté d'exécution — et se recoupent donc à peine.
 */

/**
 * L'URL demande-t-elle un sous-ensemble du catalogue ?
 *
 * Sert au serveur à ne pas construire les rayons quand ils ne seront pas
 * montrés : on cherche quelque chose, on ne flâne pas. Sans cette question, la
 * page rendait quatre rayons de douze vignettes pour les jeter ensuite.
 *
 * `sort=recent` ne compte pas : c'est l'ordre par défaut, et une URL qui le
 * nomme explicitement demande la même chose qu'une URL nue.
 */
export function filtreActif(
  params: Record<string, string | string[] | undefined>,
  options?: {
    /**
     * Ne pas compter les accords.
     *
     * Le hero pose la question dont `?chords=` est la réponse : il doit rester à
     * l'écran quand elle est posée, sinon on ne peut plus cocher un accord de
     * plus pour voir ce qu'il ouvre. Les rayons, eux, s'effacent — on ne flâne
     * plus une fois qu'on cherche.
     */
    ignorerAccords?: boolean;
  },
): boolean {
  const lire = (cle: string) => {
    const v = params[cle];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
  };
  if (lire('sort') && lire('sort') !== 'recent') return true;
  const cles = ['q', 'genre', 'difficulty', 'decade', 'key'];
  if (!options?.ignorerAccords) cles.push('chords');
  return cles.some((cle) => lire(cle) !== '');
}

/** Les accords transmis par l'URL, dans leur forme comparable. */
export function accordsDeLUrl(valeur: string | string[] | undefined): string[] {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  return (brut ?? '').split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
}

/**
 * L'index public, sous la forme que le catalogue sait afficher.
 *
 * Le catalogue rend des `SheetCard`, qui attendent un `Sheet`. Or il n'en lit que
 * douze champs : titre, artiste, auteur, tonalité, genres, niveau, année, note,
 * vues, date, et les accords pour la recherche de l'administrateur. Le reste — les
 * sections, les accords personnalisés — n'est jamais touché, et représente
 * pourtant l'essentiel du poids d'un document.
 *
 * On complète donc les champs obligatoires du type avec des valeurs neutres,
 * **ici et à un seul endroit**, plutôt que d'affaiblir la signature de `SheetCard`
 * pour ses cinq autres appelants. Une grille ainsi projetée ne doit jamais servir
 * à autre chose qu'une vignette : elle n'a pas de musique dedans.
 */
export function versGrilleDeCatalogue(r: PublicSheetRef): Sheet {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    key: r.key ?? '',
    tempo: '',
    ownerId: r.ownerId,
    ownerName: r.ownerName ?? '',
    isPublic: true,
    sections: [],
    tags: [],
    genres: r.genres ?? [],
    difficulty: (r.difficulty ?? null) as Sheet['difficulty'],
    capo: r.capo ?? null,
    year: r.year ?? null,
    createdAt: r.createdAt ?? new Date(0),
    updatedAt: r.updatedAt ?? new Date(0),
    viewCount: r.viewCount ?? 0,
    averageRating: r.averageRating ?? null,
    ratingCount: r.ratingCount ?? 0,
    bookmarkCount: 0,
    // Le catalogue filtre sur les accords quand le hero lui en transmet.
    chords: r.chords ?? [],
  };
}

/**
 * Les tuiles portent la référence telle quelle.
 *
 * Une projection plus maigre serait tentante, mais la tuile d'un rayon est une
 * `SheetCard` — la même que le catalogue — et elle attend une grille. Tant qu'on
 * réemploie ce composant, réduire ici ne ferait qu'obliger à recomposer là-bas.
 * Le jour où les rayons auront leur propre vignette sans JavaScript, avec sa
 * pochette résolue par le serveur, c'est ce type-là qui rétrécira.
 */
export interface Shelf {
  /** Identité stable : clé de rendu, clé de test, et clé de traduction. */
  id: string;
  tiles: PublicSheetRef[];
  /** Combien de grilles la tranche contient en tout, au-delà de ce qu'on montre. */
  total: number;
  /** Le filtre du catalogue vers lequel mène « tout voir », le cas échéant. */
  href?: string;
}

/** Ce qu'un rayon montre avant qu'il faille faire défiler. */
export const TAILLE_RAYON = 12;

/**
 * Fenêtre des nouveautés, en jours.
 *
 * Sept, parce que le catalogue grossit d'une trentaine de grilles par semaine :
 * plus court, le rayon serait creux certaines semaines ; plus long, il cesserait
 * d'être une nouveauté.
 */
export const JOURS_NOUVEAUTES = 7;

/**
 * Les accords barrés les plus courants, en minuscules comme en base.
 *
 * Liste explicite et non déduction : « barré » n'est pas une propriété du nom de
 * l'accord mais du doigté choisi, et un même accord se joue barré ou non selon la
 * position. On s'en tient donc aux formes qu'un débutant ne peut pratiquement pas
 * éviter de barrer sur une guitare accordée normalement.
 */
export const ACCORDS_BARRES = new Set([
  'f', 'fm', 'f7', 'fmaj7', 'fm7',
  'b', 'bm', 'b7', 'bm7',
  'bb', 'bbm', 'bb7',
  'f#', 'f#m', 'f#m7',
  'c#m', 'cm', 'gm', 'g#m', 'ab', 'eb', 'ebm', 'abm',
]);

/**
 * Ce qu'il faut savoir d'une grille pour dire si on peut la jouer.
 *
 * Le hero tourne dans le navigateur et n'a pas besoin de l'index complet : lui
 * envoyer les titres, les vues et les genres pour compter des accords ferait
 * voyager dix fois le nécessaire.
 */
export type GrilleAccords = { chords?: string[] };

/** Les accords d'une grille, comparables : minuscules et sans espace superflu. */
export function accordsDe(ref: GrilleAccords): string[] {
  return (ref.chords ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);
}

/**
 * Les grilles dont on connaît **tous** les accords.
 *
 * Le sens est « je peux la jouer d'un bout à l'autre », pas « elle contient un
 * accord que je connais » : c'est la promesse qui a de la valeur, et la seconde
 * lecture rendrait presque tout le catalogue.
 *
 * Une grille sans accord lu n'est jouable avec rien : elle est écartée, sans quoi
 * elle apparaîtrait dans toutes les sélections, y compris la sélection vide.
 */
export function jouablesAvec<T extends GrilleAccords>(refs: T[], connus: string[]): T[] {
  const socle = new Set(connus.map((c) => c.trim().toLowerCase()).filter(Boolean));
  if (socle.size === 0) return [];
  return refs.filter((r) => {
    const accords = accordsDe(r);
    return accords.length > 0 && accords.every((a) => socle.has(a));
  });
}

/**
 * L'accord qui débloquerait le plus de grilles, et combien.
 *
 * C'est le ressort de la page : avec `em am c g d` on joue huit grilles, et
 * apprendre `f` en ouvre neuf de plus. Une liste devient une progression, sans
 * rien demander de plus à la base.
 *
 * On ne compte que les grilles auxquelles il ne manque **qu'un** accord : c'est
 * ce qui rend la promesse exacte. À deux accords près, apprendre celui-là ne
 * débloquerait rien.
 */
export function prochainAccord(
  refs: GrilleAccords[],
  connus: string[],
): { accord: string; debloque: number } | null {
  const socle = new Set(connus.map((c) => c.trim().toLowerCase()).filter(Boolean));
  const gains = new Map<string, number>();

  for (const r of refs) {
    const accords = accordsDe(r);
    if (accords.length === 0) continue;
    const manquants = [...new Set(accords.filter((a) => !socle.has(a)))];
    if (manquants.length !== 1) continue;
    gains.set(manquants[0], (gains.get(manquants[0]) ?? 0) + 1);
  }

  let meilleur: { accord: string; debloque: number } | null = null;
  for (const [accord, debloque] of gains) {
    // À égalité, l'ordre alphabétique : sans lui, le résultat dépendrait de
    // l'ordre de lecture de Firestore et changerait d'une revalidation à l'autre.
    if (!meilleur || debloque > meilleur.debloque
      || (debloque === meilleur.debloque && accord < meilleur.accord)) {
      meilleur = { accord, debloque };
    }
  }
  return meilleur;
}

/** Les accords les plus employés du catalogue, du plus fréquent au moins. */
export function accordsLesPlusJoues(refs: GrilleAccords[], combien: number): string[] {
  const freq = new Map<string, number>();
  for (const r of refs) for (const a of new Set(accordsDe(r))) freq.set(a, (freq.get(a) ?? 0) + 1);
  return [...freq.entries()]
    .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
    .slice(0, combien)
    .map(([a]) => a);
}

function rayon(id: string, tranche: PublicSheetRef[], href?: string): Shelf {
  return { id, tiles: tranche.slice(0, TAILLE_RAYON), total: tranche.length, href };
}

/**
 * Les rayons de morceaux.
 *
 * `maintenant` est passé en argument plutôt que lu par la fonction : une fonction
 * qui lit l'horloge ne se teste pas deux fois de la même façon, et la page connaît
 * déjà l'instant de son rendu.
 */
export function rayonsDe(refs: PublicSheetRef[], maintenant: number): Shelf[] {
  const parVues = [...refs].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));

  const recentes = refs
    .filter((r) => r.createdAt && (maintenant - r.createdAt.getTime()) / 86_400_000 <= JOURS_NOUVEAUTES)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

  const simples = parVues.filter((r) => {
    const n = new Set(accordsDe(r)).size;
    return n > 0 && n <= 3;
  });

  const sansBarre = parVues.filter((r) => {
    const accords = accordsDe(r);
    return accords.length > 0 && !accords.some((a) => ACCORDS_BARRES.has(a));
  });

  // Un rayon vide ne s'affiche pas : mieux vaut quatre rayons pleins qu'un
  // cinquième qui annonce une catégorie et ne montre rien.
  return [
    rayon('mostViewed', parVues, '/explore?sort=viewed'),
    rayon('thisWeek', recentes, '/explore?sort=recent'),
    rayon('threeChords', simples),
    rayon('noBarre', sansBarre),
  ].filter((r) => r.total > 0);
}

/** Une porte d'entrée thématique : un libellé, un compte, un filtre du catalogue. */
export interface EntryTile {
  id: string;
  /** Ce qu'on affiche, tel quel quand c'est une valeur de donnée (genre, tonalité). */
  label: string;
  count: number;
  href: string;
  /** Quelques grilles de la tranche, pour la mosaïque de pochettes en fond. */
  sample: PublicSheetRef[];
}

export interface EntryGroup {
  id: string;
  tiles: EntryTile[];
}

const MOSAIQUE = 4;

function porte(id: string, label: string, tranche: PublicSheetRef[], href: string): EntryTile {
  return { id, label, count: tranche.length, href, sample: tranche.slice(0, MOSAIQUE) };
}

/**
 * Les portes d'entrée thématiques.
 *
 * Ce sont des **tuiles de navigation**, pas des listes de morceaux : c'est ce qui
 * évite de remontrer une quatrième fois les mêmes grilles. Chacune mène au
 * catalogue déjà filtré.
 *
 * Les tranches trop maigres sont écartées plutôt que présentées : une tuile
 * « Jazz » qui promet un rayon et livre une grille dessert la page. Le seuil est
 * bas (trois) parce que le catalogue lui-même est petit.
 */
export const SEUIL_PORTE = 3;

export function portesDe(refs: PublicSheetRef[]): EntryGroup[] {
  const parVues = [...refs].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));

  const grouper = <T>(cle: (r: PublicSheetRef) => T[]) => {
    const m = new Map<T, PublicSheetRef[]>();
    for (const r of parVues) for (const k of cle(r)) m.set(k, [...(m.get(k) ?? []), r]);
    return m;
  };

  const decennies = grouper((r) => (r.year && r.year > 1900 ? [Math.floor(r.year / 10) * 10] : []));
  const genres = grouper((r) => r.genres ?? []);
  const tonalites = grouper((r) => (r.key?.trim() ? [r.key.trim()] : []));
  const niveaux = grouper((r) => (r.difficulty ? [r.difficulty] : []));

  const trier = <T>(m: Map<T, PublicSheetRef[]>) =>
    [...m.entries()].filter(([, v]) => v.length >= SEUIL_PORTE).sort((a, b) => b[1].length - a[1].length);

  return [
    {
      id: 'decades',
      tiles: trier(decennies).map(([d, v]) => porte(`decade-${d}`, `${d}s`, v, `/explore?decade=${d}`)),
    },
    {
      id: 'genres',
      tiles: trier(genres).map(([g, v]) => porte(`genre-${g}`, g, v, `/explore?genre=${encodeURIComponent(g)}`)),
    },
    {
      id: 'levels',
      /*
       * Le libellé canonique français, comme les genres : c'est par lui que le
       * dépôt indexe ses traductions (`Difficulty` dans les messages), et le
       * chiffre seul n'y correspondrait à rien.
       */
      tiles: trier(niveaux).map(([d, v]) =>
        porte(`level-${d}`, DIFFICULTY_LABELS[d as 1 | 2 | 3] ?? String(d), v, `/explore?difficulty=${d}`)),
    },
    {
      id: 'keys',
      tiles: trier(tonalites).map(([k, v]) => porte(`key-${k}`, k, v, `/explore?key=${encodeURIComponent(k)}`)),
    },
  ].filter((groupe) => groupe.tiles.length > 0);
}

/** Un artiste du catalogue, tel que le mur des artistes l'affiche. */
export interface ArtistTile {
  name: string;
  count: number;
}

/**
 * Les artistes, du mieux fourni au moins.
 *
 * Un mur et non un rayon : cent-six artistes dont dix-neuf seulement ont plus
 * d'une grille, c'est une liste à parcourir, pas un classement à défiler.
 */
export function artistesDe(refs: PublicSheetRef[], combien: number): ArtistTile[] {
  const m = new Map<string, number>();
  for (const r of refs) {
    const nom = r.artist?.trim();
    if (nom) m.set(nom, (m.get(nom) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .slice(0, combien)
    .map(([name, count]) => ({ name, count }));
}
