import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleMesure, deroulerStructure, positionCellule, structureParDefaut, structureUtile,
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

/**
 * Retirer une structure doit tenir au rechargement.
 *
 * L'enregistrement passe par `updateDoc`, qui laisse intacts les champs absents
 * de la charge. Tant que `toFirestore` omettait la structure quand il n'y en
 * avait pas, « Retirer la structure » ne retirait rien en base : l'écran suivait,
 * puis l'ancienne structure revenait au rechargement.
 */
test('toFirestore écrit un tableau vide quand la structure est retirée', async () => {
  const { toFirestore } = await import('@/lib/firestore-helpers');
  const grille = {
    title: 'x', artist: '', key: 'C', tempo: '120', ownerId: 'u', ownerName: 'u',
    isPublic: false, sections: [COUPLET], tags: [], genres: [], difficulty: null, capo: null,
  };
  assert.deepEqual((toFirestore(grille as never) as { structure: unknown }).structure, []);
  assert.deepEqual(
    (toFirestore({ ...grille, structure: [{ sectionId: 'c', repeat: 2 }] } as never) as { structure: unknown }).structure,
    [{ sectionId: 'c', repeat: 2 }],
  );
});

/**
 * Un passage joué doit être désignable sans ambiguïté.
 *
 * `buildSequence` ne transporte pas le bloc, seulement de quoi le retrouver. Tant
 * qu'elle ne disait que l'identifiant de section, la vue ne pouvait pas savoir
 * lequel des trois couplets était en cours : elle les surlignait tous les trois
 * en même temps, et le défilement ne visait rien.
 */
test('la lecture distingue deux passages de la même section', async () => {
  const { buildSequence } = await import('@/lib/use-playback');
  const blocs = deroulerStructure([COUPLET, REFRAIN], [
    { sectionId: 'c', repeat: 1 },
    { sectionId: 'r', repeat: 1 },
    { sectionId: 'c', repeat: 1 },
  ]);
  const pas = buildSequence(blocs, 500);
  const couplets = pas.filter((p) => p.sectionId === 'c');
  assert.deepEqual([...new Set(couplets.map((p) => p.occurrence))], [0, 1]);

  // Et la clé de mesure suit le passage, sans quoi le défilement viserait la
  // première mesure du premier couplet pendant qu'on joue le troisième.
  const cles = pas.map((p) => cleMesure(p.sectionId, p.occurrence, p.rowIndex));
  assert.equal(new Set(cles).size, 3);
});

/**
 * Les mêmes accords sous des noms différents.
 *
 * C'est le cas dominant : sur cinquante-trois grilles, l'intro, le refrain et
 * l'outro sont le même accordage recopié sous trois titres. Sans un nom porté par
 * le passage, les fusionner en une seule section ferait perdre les trois titres.
 */
test('un passage peut porter un autre nom que sa section', () => {
  const blocs = deroulerStructure([COUPLET], [
    { sectionId: 'c', repeat: 4 },
    { sectionId: 'c', repeat: 4, label: 'Refrain' },
    { sectionId: 'c', repeat: 4, label: '  ' },
  ]);
  // Le nom de la section quand le passage n'en impose pas, y compris quand le
  // champ ne contient que des espaces : sinon la grille afficherait un titre vide.
  assert.deepEqual(blocs.map((b) => b.label), ['c', 'Refrain', 'c']);
});

test('renommer un passage suffit à rendre la structure utile', () => {
  // Même ordre, mêmes passages : seul le nom change. La bascule « Grille
  // harmonique / Déroulé » doit quand même apparaître, sinon le renommage
  // resterait invisible.
  assert.equal(structureUtile([COUPLET], [{ sectionId: 'c', repeat: 1, label: 'Refrain' }]), true);
  assert.equal(structureUtile([COUPLET], [{ sectionId: 'c', repeat: 1 }]), false);
});

test('toFirestore ne laisse pas passer un nom de passage indéfini', async () => {
  const { toFirestore } = await import('@/lib/firestore-helpers');
  const grille = {
    title: 'x', artist: '', key: 'C', tempo: '120', ownerId: 'u', ownerName: 'u',
    isPublic: false, sections: [COUPLET], tags: [], genres: [], difficulty: null, capo: null,
    // Un `undefined` dans la charge fait rejeter l'écriture entière par Firestore.
    structure: [{ sectionId: 'c', repeat: 1, label: undefined }, { sectionId: 'c', repeat: 1, label: 'REFRAIN' }],
  };
  const ecrit = (toFirestore(grille as never) as { structure: Record<string, unknown>[] }).structure;
  assert.deepEqual(Object.keys(ecrit[0]), ['sectionId', 'repeat']);
  // Et la casse suit la même règle que les libellés de section, qu'il côtoie.
  assert.equal(ecrit[1].label, 'Refrain');
});

/**
 * Une ligne de grille fait quatre mesures, quelle que soit la métrique.
 *
 * `createEmptyRow` en créait autant qu'il y a de temps dans une mesure : quatre en
 * 4/4, ce qui tombait juste par coïncidence, et **trois en 3/4**, ce qui laissait
 * un quart de la ligne vide sans que rien ne l'explique. `span` compte des
 * mesures, pas des temps — c'est cette confusion qui produisait le défaut.
 */
test('une ligne vide fait quatre mesures, en binaire comme en ternaire', async () => {
  const { createEmptyRow, createEmptySection, MESURES_PAR_LIGNE } = await import('@/types');

  assert.equal(createEmptyRow().length, MESURES_PAR_LIGNE);
  // La somme des durées remplit la ligne : c'est elle que la grille met en colonnes.
  assert.equal(createEmptyRow().reduce((t, c) => t + c.span, 0), MESURES_PAR_LIGNE);

  for (const metrique of [3, 4] as const) {
    const section = createEmptySection('Couplet', metrique);
    assert.equal(
      section.rows[0].length,
      MESURES_PAR_LIGNE,
      `en ${metrique}/4, la ligne devrait compter ${MESURES_PAR_LIGNE} mesures`,
    );
  }
});
