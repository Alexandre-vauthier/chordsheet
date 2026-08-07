import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choisirResultat, correspond, normaliserTexte } from '@/lib/itunes-pick';
import { artworkKey } from '@/lib/use-artwork';

/**
 * Le choix du morceau dans les résultats iTunes.
 *
 * La route prenait `results[0]`, sans vérifier l'artiste. Mesuré sur 28 grilles du
 * catalogue : un résultat correct existait dans les 25 renvoyés pour 24 d'entre
 * elles, et le premier n'était le bon que 23 fois.
 */

const piste = (artistName: string, trackName: string) => ({ artistName, trackName });

test('la requête nomme l’artiste avant le titre', () => {
  assert.equal(artworkKey('Édith Piaf', 'La Vie En Rose'), 'Édith Piaf La Vie En Rose');
});

test('l’artiste seul, ou le titre seul, restent des requêtes valides', () => {
  assert.equal(artworkKey('Queen', undefined), 'Queen');
  assert.equal(artworkKey(undefined, 'Bohemian Rhapsody'), 'Bohemian Rhapsody');
  assert.equal(artworkKey(undefined, undefined), '');
});

/** Le cas mesuré : la reprise passe devant l'original. */
test('la reprise ne l’emporte pas sur l’artiste demandé', () => {
  const resultats = [
    piste('Louis Armstrong and His Orchestra', 'La vie en rose (Single Version)'),
    piste('Édith Piaf', 'La vie en rose'),
  ];
  assert.equal(choisirResultat(resultats, 'Edith Piaf', 'La Vie En Rose')?.artistName, 'Édith Piaf');
});

test('les deux critères l’emportent sur un seul', () => {
  const resultats = [
    piste('Un Autre', 'Yesterday'),                   // le titre seul
    piste('The Beatles', 'Yesterday (Remastered)'),   // les deux
  ];
  assert.equal(choisirResultat(resultats, 'Beatles', 'Yesterday')?.artistName, 'The Beatles');
});

/**
 * Le départage quand aucun résultat ne réunit les deux critères, c'est-à-dire
 * quand iTunes n'a pas le morceau : on reste sur l'artiste demandé. C'est la même
 * règle que les pages artiste, qui cherchent par artiste seul, et c'est le sens de
 * la correction — une pochette de reprise est ce qu'on voulait éviter.
 */
test('à défaut des deux, l’artiste passe avant le titre', () => {
  const resultats = [
    piste('Un Autre', 'Yesterday'),        // le titre seul
    piste('The Beatles', 'Let It Be'),     // l'artiste seul
  ];
  assert.equal(choisirResultat(resultats, 'Beatles', 'Yesterday')?.artistName, 'The Beatles');
});

test('sans correspondance, le classement d’iTunes est conservé', () => {
  const resultats = [piste('Quelqu’un', 'Un titre'), piste('Un autre', 'Autre chose')];
  assert.equal(choisirResultat(resultats, 'Artiste Inconnu', 'Titre Inconnu'), resultats[0]);
});

test('une recherche par artiste seul retient cet artiste', () => {
  const resultats = [piste('Autre Groupe', 'Chanson'), piste('Radiohead', 'Creep')];
  assert.equal(choisirResultat(resultats, 'Radiohead', undefined)?.artistName, 'Radiohead');
});

test('sans critère, le premier résultat est rendu tel quel', () => {
  const resultats = [piste('A', 'X'), piste('B', 'Y')];
  assert.equal(choisirResultat(resultats, undefined, undefined), resultats[0]);
  assert.equal(choisirResultat([], 'A', 'X'), undefined);
});

test('accents, casse et ponctuation ne séparent pas deux mêmes noms', () => {
  assert.equal(normaliserTexte('Édith Piaf'), 'edith piaf');
  assert.ok(correspond('Édith Piaf', 'edith piaf'));
  assert.ok(correspond('Sinéad O’Connor', "Sinead O'Connor"));
});

test('les mentions entre parenthèses ne comptent pas', () => {
  assert.ok(correspond('Yesterday (Remastered 2009)', 'Yesterday'));
  assert.ok(correspond('Bohemian Rhapsody', 'Bohemian Rhapsody [Live]'));
});

test('une abréviation courante est reconnue dans les deux sens', () => {
  assert.ok(correspond('The Beatles', 'Beatles'));
  assert.ok(correspond('Beatles', 'The Beatles'));
});

/**
 * Le plancher de l'inclusion. Sans lui, « U2 » correspondrait à tout nom contenant
 * ces deux caractères — et il y en a.
 */
test('un nom très court ne correspond pas par inclusion', () => {
  assert.ok(!correspond('U2', 'Bu2ck'));
  assert.ok(correspond('U2', 'u2'), 'l’égalité stricte reste vraie');
});

test('un nom vide ne correspond à rien', () => {
  assert.ok(!correspond('', 'Queen'));
  assert.ok(!correspond('Queen', undefined));
});

/**
 * Les apostrophes, telles qu'on les saisit vraiment. Relevé dans le catalogue :
 * « Whats My Age Again », « Lhomme Pressé ». La ponctuation devenant une espace,
 * ces titres ne rejoignaient pas leur original.
 */
test('un titre saisi sans apostrophe rejoint le titre qui en porte une', () => {
  assert.ok(correspond("What's My Age Again?", 'Whats My Age Again'));
  assert.ok(correspond('Lhomme Pressé', "L'homme pressé"));
  assert.ok(correspond('Dont Stop Me Now', "Don't Stop Me Now"));
});

test('les mots séparés restent reconnus quand l’autre les colle', () => {
  assert.ok(correspond("rock'n'roll", 'rock n roll'));
});

test('coller la ponctuation ne fait pas correspondre n’importe quoi', () => {
  assert.ok(!correspond('Yesterday', 'Tomorrow'));
  assert.ok(!correspond('Louis Attaque', 'Louise Attaque'), 'une faute de frappe reste une faute');
});
