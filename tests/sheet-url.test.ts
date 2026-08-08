import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetIdFromSegment, sheetPath, sheetSegment, sheetSlug } from '@/lib/sheet-url';

/**
 * L'adresse d'une grille : un slug lisible, puis son identifiant.
 *
 * La règle qui gouverne tout : **l'identifiant reste la seule clé de résolution**.
 * Le slug est décoratif, il peut être périmé, faux ou absent sans qu'un lien cesse
 * de fonctionner. Ces tests gardent surtout cette propriété-là.
 */

const ID = 'UiqCi71Sn9CWBVM8Exm2'; // vingt caractères, comme tous ceux du catalogue

/* ── Le slug ─────────────────────────────────────────────────────────────── */

test('le slug joint le titre et l’artiste', () => {
  assert.equal(sheetSlug('Wonderwall', 'Oasis'), 'wonderwall-oasis');
});

/** Le catalogue est francophone : les accents se translittèrent, ils ne disparaissent pas. */
test('les accents deviennent leur lettre', () => {
  assert.equal(sheetSlug('Éléonore', 'Zaz'), 'eleonore-zaz');
  assert.equal(sheetSlug('Où est passé l’été', 'Renaud'), 'ou-est-passe-l-ete-renaud');
});

/** `NFD` ne décompose pas les ligatures : sans traitement, « cœur » donnait `c-ur`. */
test('les ligatures que l’Unicode ne décompose pas sont traitées', () => {
  assert.equal(sheetSlug('Cœur de pirate', ''), 'coeur-de-pirate');
  assert.equal(sheetSlug('Æther', ''), 'aether');
});

test('la ponctuation et les espaces se compactent en un seul tiret', () => {
  assert.equal(sheetSlug('Hey !!!   Jude', 'The Beatles'), 'hey-jude-the-beatles');
  assert.equal(sheetSlug('Rock & Roll', 'AC/DC'), 'rock-roll-ac-dc');
});

test('aucun tiret ne traîne au début ni à la fin', () => {
  assert.equal(sheetSlug('  — Ainsi soit-il —  ', ''), 'ainsi-soit-il');
  assert.equal(sheetSlug('!?', 'Queen'), 'queen');
});

test('les chiffres sont conservés', () => {
  assert.equal(sheetSlug('99 Luftballons', 'Nena'), '99-luftballons-nena');
});

/* ── Les cas dégradés ────────────────────────────────────────────────────── */

test('un titre ou un artiste manquant donne un slug partiel', () => {
  assert.equal(sheetSlug('Wonderwall', ''), 'wonderwall');
  assert.equal(sheetSlug('', 'Oasis'), 'oasis');
  assert.equal(sheetSlug('Wonderwall', null), 'wonderwall');
  assert.equal(sheetSlug(undefined, undefined), '');
});

/** Sans rien d'exploitable, l'adresse se réduit à l'identifiant. Laid, mais juste. */
test('sans slug, l’adresse est l’identifiant seul', () => {
  assert.equal(sheetSegment(ID, '', ''), ID);
  assert.equal(sheetPath({ id: ID }), `/sheet/${ID}`);
  assert.equal(sheetSlug('中文', '日本語'), '', 'un titre sans caractère latin ne donne pas de slug');
});

/** Une adresse de trois cents caractères se partage mal : les messageries la coupent. */
test('un titre très long est tronqué à une frontière de mot', () => {
  const slug = sheetSlug('a'.repeat(40) + ' ' + 'b'.repeat(40) + ' ' + 'c'.repeat(40), 'Artiste');
  assert.ok(slug.length <= 80, `${slug.length} caractères`);
  assert.ok(!slug.endsWith('-'), 'pas de tiret en fin de troncature');
  assert.ok(!slug.includes('bbbb-'), 'la coupe tombe entre deux mots, pas au milieu');
});

/* ── L'identifiant, seule clé de résolution ──────────────────────────────── */

test('l’identifiant se lit derrière le slug', () => {
  assert.equal(sheetIdFromSegment(`wonderwall-oasis-${ID}`), ID);
});

/** L'ancienne forme, celle des liens déjà partagés. */
test('un segment sans tiret est l’identifiant lui-même', () => {
  assert.equal(sheetIdFromSegment(ID), ID);
});

/**
 * La propriété qui compte : **le slug est ignoré**. Un titre renommé, un slug
 * tronqué à la main, un slug inventé — tant que l'identifiant est là, la grille se
 * retrouve.
 */
test('le slug n’est jamais lu : n’importe lequel mène à la même grille', () => {
  for (const slug of ['wonderwall-oasis', 'nimporte-quoi', 'a', 'un-tres-long-slug-invente']) {
    assert.equal(sheetIdFromSegment(`${slug}-${ID}`), ID, `échoue avec « ${slug} »`);
  }
});

/**
 * Un segment qui ne finit pas par un identifiant est rendu tel quel : la page dira
 * qu'elle ne trouve rien, plutôt que d'aller chercher une grille nommée « bizarre ».
 */
test('un segment sans identifiant reconnaissable est rendu tel quel', () => {
  assert.equal(sheetIdFromSegment('un-truc-bizarre'), 'un-truc-bizarre');
  assert.equal(sheetIdFromSegment('trop-court-ABC'), 'trop-court-ABC');
});

test('un segment encodé est décodé avant lecture', () => {
  assert.equal(sheetIdFromSegment(`c%C5%93ur-${ID}`), ID);
});

/**
 * L'aller-retour : ce que la fabrique produit, la lecture le résout. C'est
 * l'invariant qui garantit qu'aucune adresse émise par le site ne peut être
 * illisible par le site.
 */
test('toute adresse produite se relit sur son identifiant', () => {
  const cas: [string, string][] = [
    ['Wonderwall', 'Oasis'],
    ['Éléonore', 'Zaz'],
    ['Cœur de pirate', ''],
    ['', ''],
    ['!?', '!?'],
    ['中文', ''],
  ];
  for (const [titre, artiste] of cas) {
    const segment = sheetSegment(ID, titre, artiste);
    assert.equal(sheetIdFromSegment(segment), ID, `« ${titre} / ${artiste} » → ${segment}`);
  }
});
