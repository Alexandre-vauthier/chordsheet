import { test } from 'node:test';
import assert from 'node:assert/strict';
import { premierTempsAVenir } from '@/lib/use-groove-box';

/**
 * Le calage de la boîte à rythme sur le départ des accords.
 *
 * Les deux ne partaient pas du même instant : les accords démarraient dans
 * `runSteps`, la batterie quand son effet React s'exécutait, quelques dizaines de
 * millisecondes plus tard. L'écart s'entendait, et il changeait d'une lecture à
 * l'autre.
 */

const PAS = 0.125; // une double-croche à 120 BPM
const CYCLE = 32;  // deux mesures à quatre temps

test('un départ à venir est respecté tel quel', () => {
  assert.deepEqual(premierTempsAVenir(10.5, 10, PAS, CYCLE), { instant: 10.5, pas: 0 });
});

test('un départ déjà passé avance jusqu’au premier temps à venir', () => {
  const { instant, pas } = premierTempsAVenir(10, 10.3, PAS, CYCLE);
  assert.ok(instant >= 10.3, 'le premier temps doit être à venir');
  assert.ok(Math.abs(instant - 10.375) < 1e-9, `attendu 10.375, obtenu ${instant}`);
  assert.equal(pas, 3);
  // La phase est préservée : l'écart au départ est un multiple entier du pas.
  assert.ok(Math.abs(((instant - 10) / PAS) % 1) < 1e-9);
});

test('le rang de pas tourne dans le cycle', () => {
  // Deux mesures de retard exactement : on retombe sur le premier pas du motif.
  const { pas } = premierTempsAVenir(0, PAS * CYCLE, PAS, CYCLE);
  assert.equal(pas, 0);
});

test('un pas nul ne fait pas tourner la boucle indéfiniment', () => {
  // Ne peut venir que d'un tempo absurde, mais une boucle sans fin gèle l'onglet.
  assert.deepEqual(premierTempsAVenir(1, 5, 0, CYCLE), { instant: 5, pas: 0 });
  assert.deepEqual(premierTempsAVenir(1, 5, -1, CYCLE), { instant: 5, pas: 0 });
  assert.deepEqual(premierTempsAVenir(1, 5, PAS, 0), { instant: 5, pas: 0 });
});
