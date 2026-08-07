import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correspondAccord, normaliserRequete, filtrerAccords } from '@/lib/chord-search';
import { getChordsByInstrument, getAllExtendedChords } from '@/lib/chord-data';
import type { StringChord } from '@/types';

/**
 * La recherche dans la bibliothèque d'accords.
 *
 * Elle cherchait le texte tapé n'importe où dans le nom : « D » ramenait cent
 * vingt-six accords de guitare, dont Cadd9, Cdim et Cmadd9, où le d se trouve au
 * milieu d'un suffixe. On lit un dictionnaire par le début.
 */

const correspond = (nom: string, requete: string) => correspondAccord(nom, normaliserRequete(requete));

test('une lettre donne sa fondamentale et ses accords', () => {
  for (const nom of ['D', 'Dm', 'Dm7', 'Dsus4', 'D7', 'Dmaj7']) {
    assert.ok(correspond(nom, 'D'), `${nom} devrait répondre à « D »`);
  }
});

test('une lettre ne ramène pas les accords où elle est au milieu', () => {
  // Le défaut d'origine, mot pour mot.
  for (const nom of ['Cadd9', 'Cdim', 'Cdim7', 'Cmadd9']) {
    assert.ok(!correspond(nom, 'D'), `${nom} ne devrait pas répondre à « D »`);
  }
});

test('une lettre seule ne ramène pas les altérations : ce sont d’autres fondamentales', () => {
  assert.ok(!correspond('Db', 'D'));
  assert.ok(!correspond('Db11', 'D'));
  assert.ok(!correspond('D#m', 'D'));
  // On les demande explicitement.
  assert.ok(correspond('Db11', 'Db'));
  assert.ok(correspond('D#m', 'D#'));
  // Le si bémol ne répond pas à « B », et réciproquement le si oui.
  assert.ok(!correspond('Bb', 'B'));
  assert.ok(correspond('Bm7', 'B'));
});

test('au-delà d’une lettre, on lit depuis le début', () => {
  assert.ok(correspond('Dm7', 'dm'));
  assert.ok(correspond('Dm9', 'dm'));
  assert.ok(!correspond('Dsus4', 'dm'));
  assert.ok(!correspond('Cmadd9', 'ma'));
});

test('le nom français est accepté', () => {
  // Même traduction que la saisie d'une grille : deux tables auraient divergé.
  assert.ok(correspond('D', 'ré'));
  assert.ok(correspond('Dm7', 're'));
  assert.ok(correspond('Gm', 'solm'));
  assert.ok(correspond('F#7', 'fa#7'));
});

test('un fragment de suffixe reste trouvable', () => {
  // Rien ne commence par « sus4 » : plutôt que de rendre une liste vide, on
  // cherche le fragment n'importe où.
  const noms = ['D', 'Dsus4', 'Asus4', 'Cmaj7'];
  const trouves = filtrerAccords(noms, (n) => n, 'sus4');
  assert.deepEqual(trouves, ['Dsus4', 'Asus4']);
});

test('sur la bibliothèque réelle, « D » ne rend plus une liste interminable', () => {
  const noms = [...getChordsByInstrument('guitar'), ...getAllExtendedChords('guitar')]
    .map((c) => (c as StringChord).name);
  const avant = new Set(noms.filter((n) => n.toLowerCase().includes('d')));
  const apres = new Set(filtrerAccords(noms, (n) => n, 'D'));

  assert.ok(apres.size < avant.size / 2, `avant ${avant.size}, après ${apres.size}`);
  // Et ce qui reste est bien du ré.
  for (const nom of apres) {
    assert.ok(/^D(?![#b])/.test(nom), `${nom} n'est pas un accord de ré`);
  }
});
