import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireBattements, buildSequence, type PlayStep } from '@/lib/use-playback';
import { metriqueDeGrille, estTernaire } from '@/lib/sheet-meter';
import { createEmptySection } from '@/types';
import type { Section, Cell } from '@/types';

/**
 * Le décompte du métronome.
 *
 * Il comptait pour son compte : un `beat` incrémenté modulo une métrique lue sur
 * la **première** section de la grille. Sur une grille dont les sections n'ont pas
 * toutes la même métrique — cas produit par l'éditeur lui-même, la bascule
 * binaire/ternaire ne touchant que les sections existantes — il comptait quatre là
 * où la musique était en trois, et l'accent glissait sans jamais se rattraper.
 *
 * Il joue maintenant un calendrier déduit des mesures. Les tests portent donc sur
 * ce calendrier : il n'y a plus de compteur à vérifier.
 */

const BEAT_MS = 500; // 120 BPM à la noire

function mesure(section: string, rowIndex: number, bpm: number, cellules: number): PlayStep[] {
  return Array.from({ length: cellules }, (_, cellIndex) => ({
    sectionId: section,
    occurrence: 0,
    rowIndex,
    cellIndex,
    durationMs: (1 / cellules) * bpm * BEAT_MS,
    rowRepeatIndex: 0,
    sectionRepeatIndex: 0,
    beatsPerMeasure: bpm,
  }));
}

test('une mesure à quatre temps donne quatre temps, dont un seul accentué', () => {
  const b = construireBattements(mesure('a', 0, 4, 2), 10, BEAT_MS);
  assert.equal(b.length, 4);
  assert.deepEqual(b.map((x) => x.premier), [true, false, false, false]);
  assert.deepEqual(b.map((x) => x.instant), [10, 10.5, 11, 11.5]);
});

test('une mesure à trois temps en donne trois', () => {
  const b = construireBattements(mesure('a', 0, 3, 3), 0, BEAT_MS);
  assert.equal(b.length, 3);
  assert.deepEqual(b.map((x) => x.premier), [true, false, false]);
});

/**
 * Le défaut d'origine, celui qu'on entendait : la première section comptait
 * juste, les suivantes non.
 */
test('un changement de métrique en cours de morceau est suivi', () => {
  const b = construireBattements(
    [...mesure('a', 0, 3, 3), ...mesure('b', 0, 4, 4), ...mesure('b', 1, 4, 4)],
    0,
    BEAT_MS,
  );
  assert.deepEqual(
    b.map((x) => x.premier),
    [true, false, false, true, false, false, false, true, false, false, false],
  );
  // Et chaque premier temps tombe bien au début de sa mesure, pas à côté.
  assert.deepEqual(
    b.filter((x) => x.premier).map((x) => x.instant),
    [0, 1.5, 3.5],
  );
});

test('chaque mesure est ré-ancrée : aucune dérive sur cent mesures', () => {
  const steps = Array.from({ length: 100 }, (_, i) => mesure('a', i, 4, 4)).flat();
  const b = construireBattements(steps, 0, BEAT_MS);
  assert.equal(b.length, 400);
  assert.equal(b[399].instant, 199.5);
  for (const battement of b.filter((x) => x.premier)) {
    assert.ok(Math.abs((battement.instant / 2) % 1) < 1e-9, 'un premier temps toutes les deux secondes');
  }
});

/**
 * Le premier temps du métronome et le premier accord partaient de deux instants
 * différents : `runSteps` pour l'accord, l'exécution de l'effet React pour le
 * métronome, quelques dizaines de millisecondes plus tard.
 */
test('le premier temps tombe sur le départ de la lecture, pas plus tard', () => {
  const debut = 42.75;
  assert.equal(construireBattements(mesure('a', 0, 4, 4), debut, BEAT_MS)[0].instant, debut);
});

test('une mesure incomplète garde son premier temps', () => {
  const partielle = mesure('a', 0, 4, 4).slice(0, 1); // un quart de mesure
  const b = construireBattements(partielle, 0, BEAT_MS);
  assert.equal(b.length, 1);
  assert.equal(b[0].premier, true);
});

test('une ligne répétée compte autant de mesures que de passages', () => {
  const steps = [0, 1].map((rr) =>
    mesure('a', 0, 4, 2).map((s) => ({ ...s, rowRepeatIndex: rr })),
  ).flat();
  assert.equal(construireBattements(steps, 0, BEAT_MS).filter((x) => x.premier).length, 2);
});

/**
 * L'invariant en amont, sur la donnée cette fois : une section ajoutée après coup
 * héritait de la métrique du modèle et non de celle de la grille. Quatre grilles
 * du catalogue en portaient la trace, dont une en `3,4,4,4,4`.
 */
test('le déroulé d’une grille en trois temps ne contient aucune mesure en quatre', () => {
  const sections: Section[] = ['Intro', 'Couplet'].map((label) => {
    const s = createEmptySection(label, 3);
    s.rows[0] = [{ chord: 'Am', span: 1 }] as Cell[];
    return s;
  });
  const steps = buildSequence(
    sections.map((section, i) => ({ section, label: section.label, repeat: 1, occurrence: i })),
    BEAT_MS,
  );
  assert.ok(steps.length > 0);
  assert.deepEqual([...new Set(steps.map((s) => s.beatsPerMeasure))], [3]);
  assert.equal(construireBattements(steps, 0, BEAT_MS).length, 6);
});

/**
 * La métrique de la grille, lue au même endroit par tout le monde.
 *
 * Trois grilles du catalogue — Wicked Games, Knockin on Heaven's Door,
 * Kryptonite — sont en trois temps sans porter le champ au niveau du document :
 * il n'était écrit que par la bascule de l'éditeur, jamais à la création. La
 * bascule s'y affichait donc sur « binaire », et le badge « ternaire » manquait.
 */
const grille = (doc: 3 | 4 | undefined, sections: (3 | 4)[]) => ({
  beatsPerMeasure: doc,
  sections: sections.map((beatsPerMeasure) => ({ beatsPerMeasure })),
});

test('sans champ au niveau du document, la métrique vient des sections', () => {
  assert.equal(metriqueDeGrille(grille(undefined, [3, 3])), 3);
  assert.equal(estTernaire(grille(undefined, [3, 3])), true);
});

test('le champ du document a le dernier mot quand il est là', () => {
  assert.equal(metriqueDeGrille(grille(4, [3, 3])), 4);
});

test('une grille sans section vaut quatre temps', () => {
  assert.equal(metriqueDeGrille(grille(undefined, [])), 4);
  assert.equal(estTernaire(grille(undefined, [])), false);
});
