import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alternateLanguages, buildAlternates, localeUrl } from '@/lib/seo';
import { routing } from '@/i18n/routing';

/**
 * Les annonces de langue.
 *
 * Le `<head>` des pages et le sitemap calculaient chacun leur jeu d'alternates, et
 * ils avaient divergé : le sitemap omettait `x-default` sur ses 1974 entrées. Google
 * lit les deux sources et attend les mêmes annonces. Une seule fonction les produit
 * désormais, et ces tests gardent ce qu'elle doit contenir.
 */

test('chaque langue déclarée a son adresse, plus x-default', () => {
  const langues = alternateLanguages('/explore');
  for (const l of routing.locales) {
    assert.equal(langues[l], localeUrl(l, '/explore'), `${l} manque ou pointe ailleurs`);
  }
  assert.ok('x-default' in langues, 'x-default manque : c’est ce qui manquait au sitemap');
  assert.equal(Object.keys(langues).length, routing.locales.length + 1);
});

/** `x-default` sert qui ne demande aucune de nos langues : la langue par défaut. */
test('x-default pointe vers la langue par défaut', () => {
  assert.equal(alternateLanguages('/explore')['x-default'], localeUrl(routing.defaultLocale, '/explore'));
});

/**
 * La réciprocité : la page française et la page anglaise doivent annoncer **le même**
 * jeu d'adresses. Une annonce non réciproque est ignorée par Google.
 */
test('les deux langues annoncent le même jeu d’adresses', () => {
  const fr = buildAlternates('fr', '/chords/banjo/d7');
  const en = buildAlternates('en', '/chords/banjo/d7');
  assert.deepEqual(fr!.languages, en!.languages);
});

/** Le canonique se désigne lui-même, jamais l'autre langue. */
test('le canonique de chaque langue pointe sur elle-même', () => {
  for (const l of routing.locales) {
    assert.equal(buildAlternates(l, '/explore')!.canonical, localeUrl(l, '/explore'));
  }
});

/** Aucune adresse annoncée ne doit être dépourvue de préfixe de langue. */
test('toutes les adresses annoncées portent un préfixe de langue', () => {
  for (const url of Object.values(alternateLanguages('/explore'))) {
    assert.match(new URL(url).pathname, /^\/(fr|en)(\/|$)/, `${url} n’a pas de préfixe`);
  }
});

test('la racine du site reste préfixée elle aussi', () => {
  for (const url of Object.values(alternateLanguages(''))) {
    assert.match(new URL(url).pathname, /^\/(fr|en)$/, `${url} devrait être /fr ou /en`);
  }
});

/**
 * Une seule source d'annonces de langue.
 *
 * next-intl en posait un second jeu dans un en-tête HTTP `Link:`, et les deux ne
 * disaient pas la même chose : le `x-default` de l'en-tête pointait vers l'adresse
 * **sans préfixe** — `/explore` plutôt que `/fr/explore` — c'est-à-dire vers une URL
 * qui redirige. Google accepte trois méthodes mais attend qu'on en tienne une, et
 * deux valeurs contradictoires peuvent le faire ignorer l'ensemble.
 */
test('les annonces de langue ne sont pas dupliquées en en-tête HTTP', () => {
  assert.equal(
    routing.alternateLinks,
    false,
    'l’en-tête Link réapparaîtrait, avec un x-default sans préfixe de langue',
  );
});
