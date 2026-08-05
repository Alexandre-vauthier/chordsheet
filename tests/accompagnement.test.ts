import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialAccompaniment, ENSEMBLE_VISITEUR, ACCOMPANIMENT_INSTRUMENTS } from '@/lib/accompaniment';

/**
 * Ce qu'on entend au premier Play.
 *
 * Un utilisateur connu retrouve l'instrument de son sélecteur, seul : c'est le
 * sien, il sait ce qu'il veut entendre. Un visiteur, lui, découvre le site sur
 * une page d'atterrissage — il entend un ensemble, sans quoi le premier Play ne
 * dit rien de ce que fait le produit.
 */

test("un utilisateur connu n'entend que l'instrument de son sélecteur", () => {
  assert.deepEqual(initialAccompaniment('ukulele', false), { ukulele: 'block' });
});

test('un visiteur entend un ensemble', () => {
  const voix = initialAccompaniment('guitar', false, true);
  assert.deepEqual(Object.keys(voix).sort(), [...ENSEMBLE_VISITEUR].sort());
  // Toutes en plaqué : l'arpège se perd quand quatre instruments jouent ensemble.
  assert.ok(Object.values(voix).every((style) => style === 'block'));
});

test("l'ensemble du visiteur ne contient que des instruments capables d'accompagner", () => {
  // La Voix n'accompagne pas : l'y glisser produirait une voix muette au Play.
  for (const id of ENSEMBLE_VISITEUR) {
    assert.ok(ACCOMPANIMENT_INSTRUMENTS.includes(id), `${id} ne peut pas accompagner`);
  }
});

test('couper le son des accords l’emporte sur tout le reste', () => {
  // Le réglage vient du profil : il ne peut concerner qu'un utilisateur connu,
  // mais rien ne doit pouvoir le contourner.
  assert.deepEqual(initialAccompaniment('guitar', true), {});
  assert.deepEqual(initialAccompaniment('guitar', true, true), {});
});
