import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accordsVoisins } from '@/lib/chord-neighbours';

/**
 * Avec quoi un accord se joue vraiment.
 *
 * C'est la seule matière qui distingue une page d'accord d'une autre sans que
 * personne l'écrive. Les 1 424 pages d'accord partagent un gabarit — même diagramme,
 * même structure, 368 mots à l'unité près pour `bb` comme pour `am` — et la seule
 * section qui pouvait les différencier, « des chansons à jouer avec cet accord »,
 * est vide pour 1 289 d'entre elles.
 */

const g = (...chords: string[]) => ({ chords });

test('les voisins viennent des grilles où l’accord figure', () => {
  const grilles = [g('g', 'c', 'd'), g('g', 'c'), g('am', 'f')];
  assert.deepEqual(accordsVoisins(grilles, 'g'), ['c', 'd']);
});

test('l’accord lui-même n’est pas son propre voisin', () => {
  assert.ok(!accordsVoisins([g('g', 'c')], 'g').includes('g'));
});

/**
 * Trois cellules de C dans un morceau ne font pas trois voisinages.
 *
 * L'exemple est choisi pour que les deux comportements divergent : en comptant les
 * doublons, C sortirait devant D alors qu'il n'accompagne G que dans une grille sur
 * trois. Avec `g('g','c','c','c')` et une seule grille en D, les deux façons de
 * compter donnaient le même ordre et le test ne prouvait rien.
 */
test('un accord répété dans une grille ne compte qu’une fois', () => {
  const grilles = [g('g', 'c', 'c', 'c'), g('g', 'd'), g('g', 'd')];
  assert.deepEqual(accordsVoisins(grilles, 'g'), ['d', 'c']);
});

test('les plus fréquents viennent en premier', () => {
  const grilles = [g('g', 'c'), g('g', 'c'), g('g', 'd')];
  assert.deepEqual(accordsVoisins(grilles, 'g'), ['c', 'd']);
});

/**
 * Sans départage, la liste changerait d'un rendu à l'autre au gré de l'ordre de
 * lecture de Firestore, et la page ne serait jamais deux fois la même pour un moteur.
 */
test('à égalité, l’ordre alphabétique tranche', () => {
  assert.deepEqual(accordsVoisins([g('g', 'z', 'a')], 'g'), ['a', 'z']);
});

test('la casse et les espaces ne séparent pas deux fois le même accord', () => {
  const grilles = [g('G', 'C'), g('g', ' c ')];
  assert.deepEqual(accordsVoisins(grilles, 'G'), ['c']);
});

test('un accord absent du catalogue n’a pas de voisin', () => {
  assert.deepEqual(accordsVoisins([g('g', 'c')], 'bm'), []);
  assert.deepEqual(accordsVoisins([], 'g'), []);
  assert.deepEqual(accordsVoisins([g('g', 'c')], ''), []);
});

test('une grille sans accord ne perturbe rien', () => {
  assert.deepEqual(accordsVoisins([{ }, g('g', 'c')], 'g'), ['c']);
});

test('on n’en rend que le nombre demandé', () => {
  const grilles = [g('g', 'a', 'b', 'c', 'd', 'e', 'f')];
  assert.equal(accordsVoisins(grilles, 'g').length, 5);
  assert.equal(accordsVoisins(grilles, 'g', 2).length, 2);
});

/** Le cas réel du catalogue, relevé au moment d'écrire cette section. */
test('le cas réel de G', () => {
  const grilles = [
    ...Array.from({ length: 49 }, () => g('g', 'c')),
    ...Array.from({ length: 38 }, () => g('g', 'd')),
    ...Array.from({ length: 35 }, () => g('g', 'am')),
    ...Array.from({ length: 32 }, () => g('g', 'f')),
    ...Array.from({ length: 10 }, () => g('g', 'bm')),
  ];
  assert.deepEqual(accordsVoisins(grilles, 'g'), ['c', 'd', 'am', 'f', 'bm']);
});
