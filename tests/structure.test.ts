import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deroulerStructure, positionCellule, structureParDefaut, structureUtile,
} from '@/lib/sheet-structure';
import type { Section } from '@/types';

/**
 * Le déroulé d'une grille.
 *
 * Une grille garde ses sections une fois ; la structure dit l'ordre. Ces tests
 * figent la règle que quatre consommateurs devront partager — la vue, le PDF, la
 * lecture et le suivi micro. Qu'un seul s'en écarte, et la page montrera trois
 * couplets là où le PDF n'en imprimera qu'un.
 */

const section = (id: string, repeat = 1): Section =>
  ({ id, label: id, repeat, beatsPerMeasure: 4, rows: [[{ chord: 'C', span: 4 }]] });

const COUPLET = section('c');
const REFRAIN = section('r');
const PONT = section('p');

test('sans structure, les sections dans leur ordre, une fois chacune', () => {
  const blocs = deroulerStructure([COUPLET, REFRAIN]);
  assert.deepEqual(blocs.map((b) => b.section.id), ['c', 'r']);
  assert.deepEqual(blocs.map((b) => b.occurrence), [0, 0]);
});

test('sans structure, le nombre de passages de la section est conservé', () => {
  assert.equal(deroulerStructure([section('c', 3)])[0].repeat, 3);
});

test('avec structure, le morceau suit son ordre', () => {
  const blocs = deroulerStructure([COUPLET, REFRAIN, PONT], [
    { sectionId: 'c', repeat: 1 }, { sectionId: 'r', repeat: 1 },
    { sectionId: 'c', repeat: 1 }, { sectionId: 'r', repeat: 1 },
    { sectionId: 'p', repeat: 1 }, { sectionId: 'r', repeat: 2 },
  ]);
  assert.deepEqual(blocs.map((b) => b.section.id), ['c', 'r', 'c', 'r', 'p', 'r']);
  assert.equal(blocs.at(-1)!.repeat, 2);
});

test('chaque passage d\'une même section porte son rang', () => {
  const blocs = deroulerStructure([COUPLET, REFRAIN], [
    { sectionId: 'c', repeat: 1 }, { sectionId: 'r', repeat: 1 }, { sectionId: 'c', repeat: 1 },
  ]);
  assert.deepEqual(blocs.map((b) => b.occurrence), [0, 0, 1]);
});

test('deux passages du même couplet ont des clés de position distinctes', () => {
  // Sans le rang, le suivi micro confondrait le premier couplet et le troisième.
  const blocs = deroulerStructure([COUPLET], [
    { sectionId: 'c', repeat: 1 }, { sectionId: 'c', repeat: 1 },
  ]);
  assert.notEqual(positionCellule(blocs[0], 0, 0), positionCellule(blocs[1], 0, 0));
});

test('la structure commande, le repeat de la section ne se cumule pas', () => {
  // Un couplet marqué deux fois et placé deux fois se jouerait sinon quatre fois.
  const blocs = deroulerStructure([section('c', 2)], [{ sectionId: 'c', repeat: 3 }]);
  assert.equal(blocs[0].repeat, 3);
});

test('une section citée mais disparue est ignorée, pas fatale', () => {
  const blocs = deroulerStructure([COUPLET], [
    { sectionId: 'c', repeat: 1 }, { sectionId: 'disparue', repeat: 1 },
  ]);
  assert.deepEqual(blocs.map((b) => b.section.id), ['c']);
});

test('la structure par défaut reprend la grille telle qu\'elle est', () => {
  assert.deepEqual(structureParDefaut([section('c', 2), REFRAIN]),
    [{ sectionId: 'c', repeat: 2 }, { sectionId: 'r', repeat: 1 }]);
});

test('une structure qui redit l\'ordre naturel n\'apporte rien', () => {
  const sections = [section('c', 2), REFRAIN];
  assert.equal(structureUtile(sections, structureParDefaut(sections)), false);
  assert.equal(structureUtile(sections, [
    { sectionId: 'c', repeat: 2 }, { sectionId: 'r', repeat: 1 }, { sectionId: 'c', repeat: 1 },
  ]), true);
});
