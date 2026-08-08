import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { INSTRUMENTS } from '@/types';

/**
 * Les pictogrammes d'instruments.
 *
 * Le défaut d'origine n'était pas qu'un dessin manquait : c'est que **deux
 * instruments portaient le même symbole**. Le ukulélé et le banjo partageaient
 * l'emoji 🪕, la guitare et la basse 🎸 — deux entrées du menu qu'on ne pouvait
 * pas distinguer l'une de l'autre. C'est donc l'unicité, autant que la présence,
 * que ces tests gardent.
 *
 * Ils lisent le fichier source plutôt que d'importer le composant : on vérifie
 * les tracés eux-mêmes, sans avoir besoin d'un rendu React.
 */

const SOURCE = readFileSync('src/components/chord/instrument-icon.tsx', 'utf8');

/** Le tracé de chaque instrument, découpé depuis la table du composant. */
function traces(): Map<string, string> {
  const table = SOURCE.slice(SOURCE.indexOf('const TRACES'), SOURCE.indexOf('export function InstrumentIcon'));
  const m = new Map<string, string>();
  for (const bloc of table.matchAll(/^ {2}(\w+): \(\n([\s\S]*?)\n {2}\),$/gm)) {
    m.set(bloc[1], bloc[2]);
  }
  return m;
}

test('chaque instrument a son dessin', () => {
  const dessins = traces();
  for (const id of INSTRUMENTS) {
    assert.ok(dessins.has(id), `« ${id} » n'a pas de tracé : il s'afficherait vide`);
  }
  assert.equal(dessins.size, INSTRUMENTS.length, 'un tracé sans instrument correspondant');
});

/** Le défaut d'origine, réduit à sa forme la plus simple. */
test('deux instruments ne partagent jamais le même dessin', () => {
  const dessins = traces();
  const vus = new Map<string, string>();
  for (const [id, trace] of dessins) {
    const jumeau = vus.get(trace);
    assert.equal(jumeau, undefined, `« ${id} » et « ${jumeau} » ont le même dessin`);
    vus.set(trace, id);
  }
});

/**
 * La guitare et le ukulélé sont de la même famille, et c'est la paire qui se
 * confondait le plus. Ce qui les sépare est le rapport entre le manche et la
 * caisse : chez le ukulélé la caisse domine. Si un jour on retouche l'un des
 * deux, ce test dit lequel doit rester le plus trapu.
 */
test('le ukulélé a le manche plus court que la guitare', () => {
  const dessins = traces();
  const manche = (id: string) => {
    const m = dessins.get(id)!.match(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/);
    return Number(m![2]);
  };
  assert.ok(
    manche('ukulele') < manche('guitar') - 3,
    `manche du ukulélé ${manche('ukulele')}, de la guitare ${manche('guitar')} : trop proches pour se distinguer`,
  );
});

/** Le code sans ses commentaires : un emoji cité dans une explication n'est pas un défaut. */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Le sélecteur n'est plus un menu natif.
 *
 * C'est ce qui imposait les emoji : les `<option>` d'un `<select>` ne peuvent
 * contenir que du texte. Si quelqu'un le ramène à un menu natif, les emoji
 * reviendront avec — et ce test tombera avant.
 */
test('le sélecteur d’instrument n’est pas un menu natif', () => {
  assert.ok(
    !codeSeul('src/components/chord/instrument-selector.tsx').includes('<select'),
    'le sélecteur est redevenu un `<select>`, où aucun dessin n’entre',
  );
});

/**
 * Aucun fichier ne fait plus correspondre un instrument à un emoji.
 *
 * C'est le motif exact du défaut — `guitar: '🎸'`, `ukulele: '🪕'` — et non la
 * présence d'un emoji quelque part : une guitare décorative sur la page des
 * groupes ne prétend identifier aucun instrument, et n'a rien à faire ici.
 *
 * `chord-editor.tsx` est la seule exception : il porte encore cette table mais
 * n'est importé nulle part. C'est du code mort, et le supprimer est une décision
 * à part ; l'exception est donc nommée pour qu'elle se voie.
 */
test('aucune table ne fait correspondre un instrument à un emoji', () => {
  const MORTS = ['src/components/chord/chord-editor.tsx'];
  const TABLE = new RegExp(
    `\\b(${INSTRUMENTS.join('|')})\\s*:\\s*'[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}]`,
    'u',
  );

  const fichiers: string[] = [];
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.tsx?$/.test(chemin)) fichiers.push(chemin);
    }
  };
  parcourir('src');

  const fautifs = fichiers.filter((f) => !MORTS.includes(f)).filter((f) => TABLE.test(codeSeul(f)));
  assert.deepEqual(fautifs, [], `un instrument est encore associé à un emoji dans : ${fautifs.join(', ')}`);
});
