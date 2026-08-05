import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliserLibelle } from '@/lib/section-label';

/**
 * La casse des libellés de section.
 *
 * Elle n'était normalisée nulle part : sur sept cent soixante-dix sections, le
 * même mot existait en `refrain`, `Refrain`, `REFRAIN` et `couplet ` avec une
 * espace finale. L'écran n'en montrait rien, les mettant toutes en capitales par
 * CSS ; les extraits de Google, eux, lisaient le texte réel.
 */

test('une capitale initiale est posée', () => {
  assert.equal(normaliserLibelle('couplet'), 'Couplet');
  assert.equal(normaliserLibelle('refrain'), 'Refrain');
  assert.equal(normaliserLibelle('pré-refrain'), 'Pré-refrain');
});

test('les espaces superflus disparaissent', () => {
  assert.equal(normaliserLibelle('  couplet '), 'Couplet');
  assert.equal(normaliserLibelle('Toute   la  musique'), 'Toute la musique');
});

test('un libellé qui crie est ramené au calme', () => {
  assert.equal(normaliserLibelle('REFRAIN'), 'Refrain');
  assert.equal(normaliserLibelle('COUPLET'), 'Couplet');
});

test("un sigle court garde ses capitales : elles sont voulues", () => {
  assert.equal(normaliserLibelle('OK'), 'OK');
  assert.equal(normaliserLibelle('SOL'), 'SOL');
});

test('le reste du libellé est laissé tel que tapé', () => {
  // Rabattre tout en minuscules abîmerait ce que la personne a voulu écrire.
  assert.equal(normaliserLibelle('solo GTR'), 'Solo GTR');
  assert.equal(normaliserLibelle('Couplet 2'), 'Couplet 2');
  assert.equal(normaliserLibelle('Intro/couplet'), 'Intro/couplet');
});

test('un libellé vide le reste', () => {
  assert.equal(normaliserLibelle('   '), '');
});
