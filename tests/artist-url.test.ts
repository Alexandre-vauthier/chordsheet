import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artistPath, artistSlug, artistesDuSlug, nomCanonique } from '@/lib/artist-url';

/**
 * L'adresse d'un artiste.
 *
 * Le nom brut était mis tel quel dans l'URL, donc pourcent-encodé : sur les 214
 * adresses d'artiste du sitemap, **154 portaient au moins une séquence `%xx`** —
 * `/en/artist/Angus%20%26%20Julia%20Stone`. Illisible, mal partagé, mal copié.
 *
 * Différence de fond avec les grilles : un artiste n'a pas d'identifiant, son nom
 * *est* la clé. Le slug doit donc se résoudre contre le catalogue.
 */

test('les espaces et l’esperluette disparaissent de l’adresse', () => {
  assert.equal(artistPath('Angus & Julia Stone'), '/artist/angus-julia-stone');
  assert.equal(artistPath('Kool & The Gang'), '/artist/kool-the-gang');
  assert.equal(artistPath('4 Non Blondes'), '/artist/4-non-blondes');
});

test('les accents sont translittérés, pas retirés', () => {
  assert.equal(artistSlug('Claude François'), 'claude-francois');
  assert.equal(artistSlug('Téléphone'), 'telephone');
  assert.equal(artistSlug('Angèle'), 'angele');
  assert.equal(artistSlug('Vanupié'), 'vanupie');
});

test('la ponctuation ne laisse pas de tiret orphelin', () => {
  assert.equal(artistSlug('Dr. Dre'), 'dr-dre');
  assert.equal(artistSlug('Ben E.king'), 'ben-e-king');
  assert.equal(artistSlug('AC/DC'), 'ac-dc');
});

test('un nom vide ou sans lettre latine ne donne pas de slug', () => {
  assert.equal(artistSlug(''), '');
  assert.equal(artistSlug(null), '');
  assert.equal(artistSlug('中文'), '');
});

/* ── La résolution ───────────────────────────────────────────────────────── */

const CATALOGUE = ['Angus & Julia Stone', 'Claude François', 'Francis Cabrel', 'Françis Cabrel'];

test('un slug retrouve le nom du catalogue', () => {
  assert.deepEqual(artistesDuSlug('angus-julia-stone', CATALOGUE), ['Angus & Julia Stone']);
  assert.deepEqual(artistesDuSlug('claude-francois', CATALOGUE), ['Claude François']);
});

/** L'ancienne forme, celle des liens déjà partagés et déjà indexés. */
test('le nom brut d’une ancienne adresse se résout aussi', () => {
  assert.deepEqual(artistesDuSlug('Angus & Julia Stone', CATALOGUE), ['Angus & Julia Stone']);
  assert.deepEqual(artistesDuSlug('Claude François', CATALOGUE), ['Claude François']);
});

/**
 * Le cas relevé dans le catalogue : une faute de frappe coupait l'artiste en deux.
 * Le slug les réunit plutôt que d'élire l'un et de rendre l'autre inatteignable.
 */
test('deux orthographes voisines se réunissent sous un seul slug', () => {
  assert.deepEqual(artistesDuSlug('francis-cabrel', CATALOGUE), ['Francis Cabrel', 'Françis Cabrel']);
});

test('un slug inconnu ne désigne personne', () => {
  assert.deepEqual(artistesDuSlug('artiste-inexistant', CATALOGUE), []);
  assert.deepEqual(artistesDuSlug('', CATALOGUE), []);
});

/* ── L'orthographe affichée ──────────────────────────────────────────────── */

test('c’est l’orthographe la plus représentée qui s’affiche', () => {
  /*
   * Le nombre passe avant l'alphabet, et l'exemple le montre : en français la
   * minuscule précède la majuscule, donc l'alphabet seul choisirait « the beatles ».
   * C'est « The Beatles » qui porte les grilles, et c'est lui qui doit s'afficher.
   * Avec « Francis » et « Françis », les deux critères donnaient la même réponse et
   * le test ne prouvait rien — c'est la variante de casse qui les sépare.
   */
  const compte = (n: string) => (n === 'The Beatles' ? 5 : 1);
  assert.equal(nomCanonique(['the beatles', 'The Beatles'], compte), 'The Beatles');
  assert.equal(nomCanonique(['The Beatles', 'the beatles'], compte), 'The Beatles');
});

/** À égalité, l'ordre alphabétique : sinon le titre changerait au gré des lectures. */
test('à égalité, l’ordre alphabétique tranche', () => {
  assert.equal(nomCanonique(['Françis Cabrel', 'Francis Cabrel'], () => 1), 'Francis Cabrel');
});

test('sans nom, rien à afficher', () => {
  assert.equal(nomCanonique([], () => 0), '');
});

/**
 * L'aller-retour : toute adresse émise se résout sur le nom qui l'a produite.
 * C'est ce qui garantit qu'aucun lien du site ne mène à une page vide.
 */
test('toute adresse émise se résout sur son artiste', () => {
  for (const nom of CATALOGUE) {
    const slug = artistPath(nom).replace('/artist/', '');
    assert.ok(artistesDuSlug(slug, CATALOGUE).includes(nom), `${nom} → ${slug}`);
  }
});
