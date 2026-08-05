import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traduireLibelle } from '@/lib/section-dictionary';

/**
 * Le vocabulaire des sections d'une langue à l'autre.
 *
 * Les titres sont des données d'auteur, pas des textes d'interface : rien ne les
 * traduisait, et une grille française affichait « Couplet » et « Refrain » à un
 * lecteur anglophone. Ces tests figent ce qu'on traduit et surtout ce qu'on ne
 * traduit pas — traduire de travers un titre serait pire que ne rien faire.
 */

test('le vocabulaire courant passe dans la langue du lecteur', () => {
  assert.equal(traduireLibelle('Couplet', 'en'), 'Verse');
  assert.equal(traduireLibelle('Refrain', 'en'), 'Chorus');
  assert.equal(traduireLibelle('Pont', 'en'), 'Bridge');
  assert.equal(traduireLibelle('Fin', 'en'), 'Ending');
  assert.equal(traduireLibelle('Chorus', 'fr'), 'Refrain');
  assert.equal(traduireLibelle('Verse', 'fr'), 'Couplet');
  assert.equal(traduireLibelle('Ending', 'fr'), 'Fin');
});

test("un titre déjà dans la langue du lecteur n'est pas touché", () => {
  assert.equal(traduireLibelle('Refrain', 'fr'), 'Refrain');
  assert.equal(traduireLibelle('Chorus', 'en'), 'Chorus');
  // « Bridge » est d'usage courant dans une grille française : le corriger en
  // « Pont » reviendrait à reprendre l'auteur chez lui.
  assert.equal(traduireLibelle('Bridge', 'fr'), 'Bridge');
});

test('un titre inconnu traverse sans être touché', () => {
  // Mieux vaut ne rien traduire que traduire de travers.
  assert.equal(traduireLibelle('Toute la musique', 'en'), 'Toute la musique');
  assert.equal(traduireLibelle('Solo GTR', 'en'), 'Solo GTR');
  assert.equal(traduireLibelle('', 'en'), '');
});

test('le numéro suit son titre', () => {
  assert.equal(traduireLibelle('Couplet 2', 'en'), 'Verse 2');
  assert.equal(traduireLibelle('Refrain 3', 'en'), 'Chorus 3');
});

test('les titres enchaînés se traduisent chacun pour soi', () => {
  // C'est ainsi qu'on nomme un passage dont les accords servent à plusieurs
  // endroits : « Intro / Couplet / Refrain ».
  assert.equal(traduireLibelle('Intro / Couplet / Refrain', 'en'), 'Intro / Verse / Chorus');
  assert.equal(traduireLibelle('Refrain/Outro', 'en'), 'Chorus/Outro');
});

test('la graphie compte peu : accents, casse, traits d’union', () => {
  assert.equal(traduireLibelle('COUPLET', 'en'), 'Verse');
  assert.equal(traduireLibelle('pré-refrain', 'en'), 'Pre-chorus');
  assert.equal(traduireLibelle('pre refrain', 'en'), 'Pre-chorus');
  // La faute de frappe habituelle sur « bridge ».
  assert.equal(traduireLibelle('Brigde', 'en'), 'Bridge');
});

test('une langue inconnue laisse tout en place', () => {
  assert.equal(traduireLibelle('Couplet', 'es'), 'Couplet');
});
