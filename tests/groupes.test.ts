import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compterGrilles } from '@/lib/use-group-cards';

/**
 * Le nombre de grilles d'un groupe.
 *
 * La carte comptait `linkedSheetIds` — les grilles qu'on a *rattachées* au groupe
 * depuis son répertoire personnel — et ignorait celles que le groupe **possède**,
 * c'est-à-dire les copies créées dedans. Mesuré sur la base au moment du
 * correctif : « Nebraska » s'annonçait à 5 grilles et en montrait 15 sur sa page,
 * « test » s'annonçait à 0 et en montrait 2.
 */

test('les grilles possédées comptent, pas seulement les liées', () => {
  assert.equal(compterGrilles(['a', 'b'], []), 2, 'un groupe sans grille liée n’est pas un groupe vide');
  assert.equal(compterGrilles([], ['x']), 1);
  assert.equal(compterGrilles(['a'], ['x']), 2);
});

/**
 * Une grille peut relever des deux ensembles : on lie une grille personnelle,
 * quelqu'un la copie dans le groupe. La compter deux fois donnerait un second
 * nombre faux, cette fois plus grand que ce que la page montre.
 */
test('une grille à la fois possédée et liée ne compte qu’une fois', () => {
  assert.equal(compterGrilles(['a', 'b'], ['b', 'c']), 3);
});

/** Le cas relevé en base : 14 possédées, 5 liées, 4 communes, 15 affichées. */
test('le cas réel de « Nebraska »', () => {
  const possedees = Array.from({ length: 14 }, (_, i) => `p${i}`);
  const liees = ['p0', 'p1', 'p2', 'p3', 'autre'];
  assert.equal(compterGrilles(possedees, liees), 15);
});

test('un groupe sans rien affiche zéro', () => {
  assert.equal(compterGrilles([], []), 0);
});
