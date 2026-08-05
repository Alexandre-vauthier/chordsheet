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
  assert.equal(normaliserLibelle('Solo (fin)'), 'Solo (fin)');
});

test('un libellé vide le reste', () => {
  assert.equal(normaliserLibelle('   '), '');
});

test('une barre oblique enchaîne des titres, chacun avec sa capitale', () => {
  // « Intro / Couplet / Refrain » n'est pas une phrase mais trois titres : c'est
  // ainsi qu'on nomme un passage dont les accords servent à plusieurs endroits.
  assert.equal(normaliserLibelle('INTRO / COUPLET / REFRAIN'), 'Intro / Couplet / Refrain');
  assert.equal(normaliserLibelle('REFRAIN/OUTRO'), 'Refrain/Outro');
  assert.equal(normaliserLibelle('intro/couplet'), 'Intro/Couplet');
  // Chaque titre se normalise pour lui-même : sinon le premier garderait son cri.
  assert.equal(normaliserLibelle('COUPLET/refrain'), 'Couplet/Refrain');
});

test('la règle converge : les quatre orthographes tombent sur la même', () => {
  // Sans cela elle ne servirait à rien : c'est tout l'objet du rattrapage.
  const formes = ['refrain', 'Refrain', 'REFRAIN', ' refrain  '];
  assert.equal(new Set(formes.map(normaliserLibelle)).size, 1);
  assert.equal(normaliserLibelle('refrain'), 'Refrain');
});

test("appliquer la règle deux fois ne change rien de plus", () => {
  // Les champs la posent à chaque sortie de champ : elle doit être stable, sinon
  // un libellé dériverait à chaque passage.
  for (const libelle of ['REFRAIN/OUTRO', 'Toute la musique', 'Solo GTR', 'Pré-refrain', 'OK']) {
    assert.equal(normaliserLibelle(normaliserLibelle(libelle)), normaliserLibelle(libelle));
  }
});
