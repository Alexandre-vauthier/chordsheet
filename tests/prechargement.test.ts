import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fichiersDeLaPage } from '@/lib/use-offline';

/**
 * Ce que le préchargement doit rapporter d'une page.
 *
 * Une page en cache sans son code s'affiche un dixième de seconde puis meurt.
 * Encore faut-il demander les bons fichiers : l'extraction coupait les adresses
 * à la première parenthèse fermante, alors que les dossiers de routes de Next
 * s'appellent `(main)`. Le fichier de la page des grilles était donc demandé
 * tronqué — 404, jamais mis en cache — et le vrai n'était jamais demandé.
 *
 * Deux symptômes en découlaient, et ils ont resisté à cinq corrections : le
 * bouton n'annonçait jamais « disponible hors ligne », et la grille mourait
 * aussitôt affichée.
 */

test('une adresse contenant un dossier de route entre parenthèses est prise entière', () => {
  const html = '<script src="/_next/static/chunks/app/%5Blocale%5D/(main)/sheet/%5Bid%5D/page-abc.js?dpl=x" async=""></script>';
  assert.deepEqual(fichiersDeLaPage(html),
    ['/_next/static/chunks/app/%5Blocale%5D/(main)/sheet/%5Bid%5D/page-abc.js?dpl=x']);
});

test('les feuilles de style, les scripts et les polices sont tous pris', () => {
  const html = `
    <link rel="stylesheet" href="/_next/static/css/a.css?dpl=x"/>
    <script src="/_next/static/chunks/b.js?dpl=x"></script>
    <link rel="preload" href="/_next/static/media/c-s.p.woff2?dpl=x" as="font"/>
  `;
  assert.deepEqual(fichiersDeLaPage(html).sort(), [
    '/_next/static/chunks/b.js?dpl=x',
    '/_next/static/css/a.css?dpl=x',
    '/_next/static/media/c-s.p.woff2?dpl=x',
  ]);
});

test('un même fichier cité deux fois n\'est demandé qu\'une fois', () => {
  const html = '<script src="/_next/static/chunks/b.js"></script><script src="/_next/static/chunks/b.js"></script>';
  assert.equal(fichiersDeLaPage(html).length, 1);
});

test('une page sans fichier de build ne rend rien', () => {
  assert.deepEqual(fichiersDeLaPage('<html><body>rien</body></html>'), []);
});
