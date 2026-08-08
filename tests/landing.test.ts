import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPrimaryNav, collectHrefs } from '@/components/layout/nav-items';

/**
 * Ce que la page d'accueil ne doit pas redevenir.
 *
 * Trois défauts corrigés, et trois défauts qui reviendraient sans bruit : une barre
 * faite d'ancres, une promesse que le produit ne tient pas, et un compteur qui
 * n'est que le plafond de sa propre requête. Aucun des trois ne lève d'erreur.
 */

const RACINE = join(import.meta.dirname, '..');
const source = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8');
const messages = (langue: string) => JSON.parse(source(`messages/${langue}.json`));

const LANGUES = ['fr', 'en'] as const;
const ACCUEIL = 'src/app/[locale]/landing-client.tsx';

/* ── La navigation ───────────────────────────────────────────────────────── */

/**
 * L'accueil portait sa **propre** barre, faite de cinq ancres internes : ni
 * Explorer, ni création, et rien du tout en dessous de 640 px. Elle est remplacée
 * par la barre du reste du site.
 */
test('l’accueil rend la barre globale, et non une barre à lui', () => {
  const s = source(ACCUEIL);
  assert.match(s, /from '@\/components\/layout\/navbar'/, 'la barre globale doit être importée');
  assert.match(s, /<Navbar \/>/, 'et rendue');
});

/**
 * La propriété qui compte vraiment : plus aucun lien de navigation ne doit être une
 * ancre. Une ancre ne mène nulle part hors de la page, et c'est ce qui donnait à
 * l'accueil son air de site en une seule page.
 */
test('aucun lien de navigation n’est une ancre interne', () => {
  const ancres = [...source(ACCUEIL).matchAll(/href="(#[\w-]*)"/g)].map((m) => m[1]);
  assert.deepEqual(ancres, [], `ancres restantes : ${ancres.join(', ')}`);
});

/** Et ce que la barre apporte, qui manquait : la découverte et la création. */
test('un visiteur de l’accueil a Explorer et la création sous les yeux', () => {
  const hrefs = collectHrefs(buildPrimaryNav({ signedIn: false, isAdmin: false, isPro: false }));
  assert.ok(hrefs.includes('/explore'), 'Explorer doit être atteignable');
  assert.ok(hrefs.includes('/dashboard'), '« Mon book » doit être visible, même sans compte');
});

/* ── Ce qu'on promet ─────────────────────────────────────────────────────── */

/**
 * La promesse était fausse, et vérifiable comme telle : le tableau de bord filtre
 * explicitement `!s.groupId`, les grilles d'un groupe ne se consultent que depuis
 * le groupe. On annonçait donc quelque chose que le produit ne fait pas.
 */
test('la promesse « chacun a les grilles dans son propre book » a disparu', () => {
  for (const langue of LANGUES) {
    const bands = messages(langue).Landing?.bands ?? {};
    assert.ok(!('musicItem2' in bands), `${langue} : la clé est revenue`);
    const textes = JSON.stringify(bands).toLowerCase();
    assert.ok(
      !/propre book|own book/.test(textes),
      `${langue} : la promesse est revenue sous une autre clé`,
    );
  }
});

/**
 * Le compteur affichait « 40+ grilles » parce que la requête portait `limit(40)` :
 * un plafond de lecture présenté comme une donnée, sur un catalogue qui en compte
 * plus de deux cents. Il est désormais servi par le serveur, et son libellé attend
 * deux nombres — s'il redevenait une chaîne à « + », le test tomberait.
 */
test('le chiffre du catalogue est un vrai décompte, pas un plafond', () => {
  for (const langue of LANGUES) {
    const hero = messages(langue).Landing?.hero ?? {};
    assert.ok(!('sheetCount' in hero), `${langue} : l’ancien compteur plafonné est revenu`);
    assert.match(hero.catalogue ?? '', /\{grilles\}/, `${langue} : le libellé doit porter le décompte`);
    assert.match(hero.catalogue ?? '', /\{artistes\}/, `${langue} : et celui des artistes`);
  }
});

/* ── Ce qu'on a retiré ───────────────────────────────────────────────────── */

/**
 * Trois sous-arbres n'ont plus aucun lecteur : la barre propre à l'accueil, la
 * rubrique « Comment ça marche », et un pied de page mort depuis longtemps. Les
 * laisser coûterait à **toutes** les pages du site : l'accueil étant client, tout
 * `Landing` transite dans le payload de traduction.
 */
test('les sous-arbres sans lecteur ne reviennent pas', () => {
  for (const langue of LANGUES) {
    const landing = messages(langue).Landing ?? {};
    for (const mort of ['nav', 'how', 'footer']) {
      assert.ok(!(mort in landing), `${langue} : Landing.${mort} est revenu sans lecteur`);
    }
  }
});

/**
 * Douze tuiles occupaient 3,6 écrans de téléphone à elles seules. Six restent, et
 * chacune doit avoir son texte dans les deux langues — une tuile ajoutée sans
 * traduction afficherait le nom de sa clé.
 */
test('chaque tuile affichée a son texte dans les deux langues', () => {
  const ids = [...source(ACCUEIL).matchAll(/\{ id: '(\w+)', href:/g)].map((m) => m[1]);
  assert.equal(ids.length, 6, `${ids.length} tuiles : le compte a changé`);
  for (const langue of LANGUES) {
    const feats = messages(langue).Landing?.features ?? {};
    for (const id of ids) {
      assert.equal(typeof feats[id]?.title, 'string', `${langue} : features.${id}.title manque`);
      assert.equal(typeof feats[id]?.text, 'string', `${langue} : features.${id}.text manque`);
    }
  }
});

/** Les quatre profils du bloc « Pour qui » sont lus par une clé calculée : le
 *  contrôle général des traductions ne peut pas les voir. */
test('les quatre profils ont leur texte dans les deux langues', () => {
  for (const langue of LANGUES) {
    const who = messages(langue).Landing?.who ?? {};
    for (const profil of ['solo', 'band', 'teacher', 'choir']) {
      assert.equal(typeof who[profil]?.title, 'string', `${langue} : who.${profil}.title manque`);
      assert.equal(typeof who[profil]?.text, 'string', `${langue} : who.${profil}.text manque`);
    }
  }
});
