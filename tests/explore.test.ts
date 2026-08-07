import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  jouablesAvec, prochainAccord, accordsLesPlusJoues,
  rayonsDe, portesDe, artistesDe,
  TAILLE_RAYON, SEUIL_PORTE, ACCORDS_BARRES, filtreActif, accordsDeLUrl,
} from '@/lib/explore-shelves';
import type { PublicSheetRef } from '@/lib/public-sheet-index';

/**
 * Les tranches du catalogue qui composent la page de découverte.
 *
 * Ce qui est vérifié ici, ce sont les règles éditoriales autant que le code : le
 * catalogue est petit (130 grilles publiques), et des rayons mal découpés
 * montreraient trois fois les mêmes morceaux. La disjonction est donc un test,
 * pas une intention.
 */

const JOUR = 86_400_000;
const MAINTENANT = new Date('2026-08-08T12:00:00Z').getTime();

let compteur = 0;
function grille(p: Partial<PublicSheetRef> & { chords?: string[] } = {}): PublicSheetRef {
  compteur += 1;
  return {
    id: p.id ?? `g${compteur}`,
    title: p.title ?? `Titre ${compteur}`,
    artist: p.artist ?? `Artiste ${compteur}`,
    updatedAt: null,
    ownerId: 'moi',
    chords: p.chords ?? ['g', 'c', 'd'],
    genres: p.genres ?? [],
    difficulty: p.difficulty ?? null,
    viewCount: p.viewCount ?? 0,
    year: p.year ?? null,
    key: p.key ?? '',
    createdAt: p.createdAt ?? new Date(MAINTENANT - 400 * JOUR),
    capo: null,
    averageRating: null,
    ratingCount: 0,
    ...p,
  };
}

/* ── Jouer avec les accords qu'on connaît ────────────────────────────────── */

test('une grille n’est jouable que si on connaît TOUS ses accords', () => {
  const refs = [
    grille({ id: 'ok', chords: ['g', 'c'] }),
    grille({ id: 'non', chords: ['g', 'c', 'f'] }),
  ];
  assert.deepEqual(jouablesAvec(refs, ['g', 'c', 'd']).map((r) => r.id), ['ok']);
});

test('la casse et les espaces ne comptent pas', () => {
  const refs = [grille({ id: 'ok', chords: ['g', 'am'] })];
  assert.equal(jouablesAvec(refs, [' G ', 'Am']).length, 1);
});

/** Sans quoi une grille sans accord lu apparaîtrait dans toutes les sélections. */
test('une grille sans accord n’est jouable avec rien', () => {
  assert.equal(jouablesAvec([grille({ chords: [] })], ['g', 'c', 'd']).length, 0);
});

test('ne rien connaître ne rend rien jouable', () => {
  assert.equal(jouablesAvec([grille({ chords: ['g'] })], []).length, 0);
  assert.equal(jouablesAvec([grille({ chords: ['g'] })], ['  ']).length, 0);
});

/* ── L’accord qui débloque le plus ───────────────────────────────────────── */

/**
 * Le ressort de la page. Mesuré en base : avec `em am c g d` on joue 8 grilles,
 * et apprendre `f` en ouvre 9 de plus.
 */
test('l’accord proposé est celui qui débloque le plus de grilles', () => {
  const refs = [
    grille({ chords: ['g', 'c', 'f'] }),
    grille({ chords: ['g', 'f'] }),
    grille({ chords: ['c', 'f'] }),
    grille({ chords: ['g', 'c', 'bm'] }),
  ];
  assert.deepEqual(prochainAccord(refs, ['g', 'c']), { accord: 'f', debloque: 3 });
});

/** Deux accords manquants : en apprendre un ne débloque toujours rien. */
test('une grille à deux accords près ne compte pas', () => {
  const refs = [grille({ chords: ['g', 'f', 'bm'] })];
  assert.equal(prochainAccord(refs, ['g']), null);
});

test('à égalité, l’ordre alphabétique tranche', () => {
  const refs = [grille({ chords: ['g', 'z'] }), grille({ chords: ['g', 'a'] })];
  assert.equal(prochainAccord(refs, ['g'])?.accord, 'a');
});

test('quand tout est déjà jouable, il n’y a plus rien à proposer', () => {
  assert.equal(prochainAccord([grille({ chords: ['g', 'c'] })], ['g', 'c']), null);
});

test('les accords les plus joués viennent du catalogue, du plus fréquent au moins', () => {
  const refs = [
    grille({ chords: ['g', 'c'] }),
    grille({ chords: ['g', 'am'] }),
    grille({ chords: ['g'] }),
  ];
  assert.deepEqual(accordsLesPlusJoues(refs, 2), ['g', 'am']);
});

/* ── Les rayons ──────────────────────────────────────────────────────────── */

test('« les plus jouées » classe par vues décroissantes', () => {
  const refs = [grille({ id: 'b', viewCount: 5 }), grille({ id: 'a', viewCount: 50 })];
  const r = rayonsDe(refs, MAINTENANT).find((x) => x.id === 'mostViewed');
  assert.deepEqual(r?.tiles.map((t) => t.id), ['a', 'b']);
});

test('« cette semaine » ne retient que les sept derniers jours', () => {
  const refs = [
    grille({ id: 'hier', createdAt: new Date(MAINTENANT - 1 * JOUR) }),
    grille({ id: 'vieille', createdAt: new Date(MAINTENANT - 30 * JOUR) }),
  ];
  const r = rayonsDe(refs, MAINTENANT).find((x) => x.id === 'thisWeek');
  assert.deepEqual(r?.tiles.map((t) => t.id), ['hier']);
});

test('« trois accords suffisent » n’en accepte pas une à quatre', () => {
  const refs = [
    grille({ id: 'trois', chords: ['g', 'c', 'd'] }),
    grille({ id: 'quatre', chords: ['g', 'c', 'd', 'em'] }),
  ];
  const r = rayonsDe(refs, MAINTENANT).find((x) => x.id === 'threeChords');
  assert.deepEqual(r?.tiles.map((t) => t.id), ['trois']);
});

/** Le doublon compte pour un : trois cellules de G ne font pas trois accords. */
test('« trois accords » compte les accords distincts', () => {
  const refs = [grille({ id: 'ok', chords: ['g', 'g', 'c', 'd'] })];
  const r = rayonsDe(refs, MAINTENANT).find((x) => x.id === 'threeChords');
  assert.deepEqual(r?.tiles.map((t) => t.id), ['ok']);
});

test('« sans barré » écarte les grilles qui en contiennent un', () => {
  const refs = [
    grille({ id: 'libre', chords: ['g', 'c', 'em'] }),
    grille({ id: 'barre', chords: ['g', 'f'] }),
  ];
  const r = rayonsDe(refs, MAINTENANT).find((x) => x.id === 'noBarre');
  assert.deepEqual(r?.tiles.map((t) => t.id), ['libre']);
  assert.ok(ACCORDS_BARRES.has('f') && !ACCORDS_BARRES.has('em'));
});

/** Mieux vaut quatre rayons pleins qu'un cinquième qui annonce et ne montre rien. */
test('un rayon vide n’est pas rendu', () => {
  const refs = [grille({ chords: ['g', 'c', 'd', 'em', 'f'], createdAt: new Date(MAINTENANT - 90 * JOUR) })];
  const ids = rayonsDe(refs, MAINTENANT).map((r) => r.id);
  assert.ok(!ids.includes('thisWeek'), 'aucune nouveauté');
  assert.ok(!ids.includes('threeChords'), 'cinq accords');
  assert.ok(!ids.includes('noBarre'), 'contient un fa');
  assert.deepEqual(ids, ['mostViewed']);
});

test('un rayon ne montre pas plus que sa taille, mais dit son total', () => {
  const refs = Array.from({ length: TAILLE_RAYON + 7 }, (_, i) => grille({ viewCount: i }));
  const r = rayonsDe(refs, MAINTENANT).find((x) => x.id === 'mostViewed');
  assert.equal(r?.tiles.length, TAILLE_RAYON);
  assert.equal(r?.total, TAILLE_RAYON + 7);
});

/**
 * La contrainte qui a dicté tout le découpage. Mesuré sur la base réelle :
 * 48 tuiles pour 40 morceaux distincts, soit 1,20 apparition par morceau. Ce test
 * garde l'ordre de grandeur, pour qu'un rayon ajouté à la légère se voie.
 */
test('les rayons se recouvrent peu', () => {
  const refs = [
    ...Array.from({ length: 20 }, (_, i) => grille({ viewCount: 200 - i, chords: ['g', 'c', 'd', 'em', 'f'] })),
    ...Array.from({ length: 15 }, () => grille({ createdAt: new Date(MAINTENANT - 2 * JOUR), chords: ['a', 'e', 'bm', 'd', 'f'] })),
    ...Array.from({ length: 15 }, () => grille({ chords: ['g', 'c'] })),
  ];
  const rayons = rayonsDe(refs, MAINTENANT);
  const tuiles = rayons.flatMap((r) => r.tiles.map((t) => t.id));
  const distincts = new Set(tuiles);
  assert.ok(
    tuiles.length / distincts.size < 1.5,
    `${tuiles.length} tuiles pour ${distincts.size} morceaux : recouvrement trop fort`,
  );
});

/* ── Les portes thématiques ──────────────────────────────────────────────── */

const pourPortes = () => [
  ...Array.from({ length: 5 }, () => grille({ year: 1995, genres: ['Pop'], difficulty: 1, key: 'Em' })),
  ...Array.from({ length: 4 }, () => grille({ year: 2003, genres: ['Rock'], difficulty: 2, key: 'Am' })),
  ...Array.from({ length: 2 }, () => grille({ year: 1974, genres: ['Jazz'], difficulty: 3, key: 'Bb' })),
];

test('les portes comptent juste et mènent au catalogue filtré', () => {
  const groupes = portesDe(pourPortes());
  const decennies = groupes.find((g) => g.id === 'decades')!;
  const annees90 = decennies.tiles.find((t) => t.label === '1990s')!;
  assert.equal(annees90.count, 5);
  assert.equal(annees90.href, '/explore?decade=1990');

  const genres = groupes.find((g) => g.id === 'genres')!;
  assert.equal(genres.tiles.find((t) => t.label === 'Pop')?.href, '/explore?genre=Pop');
});

/** Une tuile qui promet un rayon et livre deux grilles dessert la page. */
test('une tranche trop maigre n’a pas de tuile', () => {
  const groupes = portesDe(pourPortes());
  const genres = groupes.find((g) => g.id === 'genres')!;
  assert.ok(!genres.tiles.some((t) => t.label === 'Jazz'), `Jazz n’a que 2 grilles, seuil ${SEUIL_PORTE}`);
  assert.deepEqual(genres.tiles.map((t) => t.label), ['Pop', 'Rock']);
});

test('les portes sont classées de la plus fournie à la moins', () => {
  const decennies = portesDe(pourPortes()).find((g) => g.id === 'decades')!;
  assert.deepEqual(decennies.tiles.map((t) => t.count), [5, 4]);
});

test('un groupe sans aucune tuile disparaît', () => {
  const groupes = portesDe([grille({ year: null, genres: [], difficulty: null, key: '' })]);
  assert.deepEqual(groupes, []);
});

test('un genre à espace ou accent garde une adresse valide', () => {
  const refs = Array.from({ length: 3 }, () => grille({ genres: ['Chanson française'] }));
  const genres = portesDe(refs).find((g) => g.id === 'genres')!;
  assert.equal(genres.tiles[0].href, '/explore?genre=Chanson%20fran%C3%A7aise');
});

test('chaque porte porte quelques pochettes pour sa mosaïque', () => {
  const decennies = portesDe(pourPortes()).find((g) => g.id === 'decades')!;
  assert.ok(decennies.tiles[0].sample.length > 0 && decennies.tiles[0].sample.length <= 4);
});

/* ── Les artistes ────────────────────────────────────────────────────────── */

test('les artistes sont classés par nombre de grilles, puis par nom', () => {
  const refs = [
    grille({ artist: 'Queen' }), grille({ artist: 'Queen' }),
    grille({ artist: 'Zaz' }), grille({ artist: 'ABBA' }),
  ];
  assert.deepEqual(artistesDe(refs, 3), [
    { name: 'Queen', count: 2 },
    { name: 'ABBA', count: 1 },
    { name: 'Zaz', count: 1 },
  ]);
});

test('une grille sans artiste ne crée pas d’entrée vide', () => {
  assert.deepEqual(artistesDe([grille({ artist: '  ' })], 5), []);
});

/* ── L’URL demande-t-elle un sous-ensemble ? ─────────────────────────────── */

test('une URL nue laisse flâner', () => {
  assert.equal(filtreActif({}), false);
});

/** L'ordre par défaut nommé explicitement demande la même chose qu'une URL nue. */
test('sort=recent n’est pas un filtre, les autres tris le sont', () => {
  assert.equal(filtreActif({ sort: 'recent' }), false);
  assert.equal(filtreActif({ sort: 'viewed' }), true);
});

test('chaque filtre du catalogue est reconnu', () => {
  for (const cle of ['q', 'genre', 'difficulty', 'decade', 'key']) {
    assert.equal(filtreActif({ [cle]: 'x' }), true, `${cle} devrait compter`);
  }
});

test('un paramètre vide ou blanc ne filtre rien', () => {
  assert.equal(filtreActif({ genre: '', q: '   ' }), false);
});

/** Next rend un paramètre répété sous forme de tableau. */
test('un paramètre répété est lu quand même', () => {
  assert.equal(filtreActif({ genre: ['Rock', 'Pop'] }), true);
});

test('un paramètre étranger ne déclenche rien', () => {
  assert.equal(filtreActif({ utm_source: 'newsletter' }), false);
});

/**
 * Le hero pose la question dont `?chords=` est la réponse : il doit rester à
 * l'écran quand elle est posée, sinon on ne peut plus cocher un accord de plus.
 * Les rayons, eux, s'effacent — on ne flâne plus une fois qu'on cherche.
 */
test('les accords effacent les rayons mais pas le hero', () => {
  assert.equal(filtreActif({ chords: 'g,c,d' }), true, 'les rayons s’effacent');
  assert.equal(filtreActif({ chords: 'g,c,d' }, { ignorerAccords: true }), false, 'le hero reste');
});

test('un autre filtre efface le hero, même avec des accords', () => {
  assert.equal(filtreActif({ chords: 'g,c', genre: 'Rock' }, { ignorerAccords: true }), true);
});

test('les accords de l’URL se lisent dans leur forme comparable', () => {
  assert.deepEqual(accordsDeLUrl('G, c ,Am'), ['g', 'c', 'am']);
  assert.deepEqual(accordsDeLUrl(undefined), []);
  assert.deepEqual(accordsDeLUrl(',,'), []);
  assert.deepEqual(accordsDeLUrl(['g,c', 'd']), ['g', 'c'], 'un paramètre répété : le premier');
});
