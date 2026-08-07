import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  buildPrimaryNav, buildAccountNav, buildToolsGroup, collectHrefs, resolveHref, isActive,
  type NavContext, type NavEntry, type NavGroup, type NavSection,
} from '@/components/layout/nav-items';

/**
 * La navigation, déclarée une seule fois.
 *
 * La barre entretenait deux arborescences parallèles, une par largeur d'écran, et
 * elles avaient divergé : `/chords` était filtré du mobile, `/sets` n'existait que
 * sur grand écran, « À valider » nulle part ailleurs. Ces tests figent l'invariant
 * que la structure unique rend possible — et que rien ne garantissait avant.
 */

const CONTEXTES: Record<string, NavContext> = {
  visiteur: { signedIn: false, isAdmin: false, isPro: false },
  gratuit: { signedIn: true, isAdmin: false, isPro: false },
  pro: { signedIn: true, isAdmin: false, isPro: true },
  admin: { signedIn: true, isAdmin: true, isPro: true },
};

const toutesLesEntrees = (ctx: NavContext): NavEntry[] => {
  const out: NavEntry[] = [];
  const visiter = (n: NavEntry | NavGroup | NavSection) => {
    if ('href' in n) out.push(n);
    else if ('sections' in n) n.sections.forEach(visiter);
    else n.entries.forEach(visiter);
  };
  buildPrimaryNav(ctx).forEach(visiter);
  buildAccountNav(ctx).forEach(visiter);
  return out;
};

test('chaque libellé existe dans les deux langues', () => {
  // Ce test seul aurait attrapé les « Grilles » / « Artistes » codés en dur en
  // français dans le dropdown mobile, que personne n'avait vus.
  const fr = JSON.parse(readFileSync('messages/fr.json', 'utf8')).Navbar;
  const en = JSON.parse(readFileSync('messages/en.json', 'utf8')).Navbar;

  for (const ctx of Object.values(CONTEXTES)) {
    for (const entree of toutesLesEntrees(ctx)) {
      assert.ok(fr[entree.labelKey], `fr.json n'a pas Navbar.${entree.labelKey}`);
      assert.ok(en[entree.labelKey], `en.json n'a pas Navbar.${entree.labelKey}`);
    }
    for (const noeud of buildPrimaryNav(ctx)) {
      if ('labelKey' in noeud && !('href' in noeud)) {
        assert.ok(fr[noeud.labelKey] && en[noeud.labelKey], `Navbar.${noeud.labelKey} manque`);
      }
    }
  }
});

test('chaque adresse correspond à une page qui existe', () => {
  // Attrape le lien mort le jour où une page est renommée.
  for (const entree of toutesLesEntrees(CONTEXTES.admin)) {
    const segment = entree.href.split('?')[0].replace(/^\//, '');
    if (!segment) continue;
    const candidats = [
      `src/app/[locale]/(main)/${segment}/page.tsx`,
      `src/app/[locale]/(main)/${segment}/[id]/page.tsx`, // /user mène à /user/{id}
    ];
    assert.ok(candidats.some(existsSync), `aucune page pour ${entree.href}`);
  }
});

test('les identifiants sont uniques', () => {
  const ids = toutesLesEntrees(CONTEXTES.admin).map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, `doublon parmi : ${ids.join(', ')}`);
});

test('un visiteur ne voit rien qui exige un compte', () => {
  const hrefs = collectHrefs(buildPrimaryNav(CONTEXTES.visiteur));
  for (const prive of ['/dashboard', '/groups', '/sets', '/profile', '/session']) {
    assert.ok(!hrefs.includes(prive), `${prive} ne devrait pas être proposé à un visiteur`);
  }
  // Et son menu « moi » est vide : il n'a pas de compte.
  assert.deepEqual(buildAccountNav(CONTEXTES.visiteur), []);
});

test('la boîte à rythme ne sort jamais hors administration', () => {
  // Page non indexée, absente du pied de page et du sitemap : c'est un banc
  // d'essai, la montrer promettrait une fonctionnalité.
  for (const nom of ['visiteur', 'gratuit', 'pro']) {
    const hrefs = collectHrefs(buildPrimaryNav(CONTEXTES[nom]));
    assert.ok(!hrefs.includes('/groove-box'), `visible pour ${nom}`);
  }
  assert.ok(collectHrefs(buildPrimaryNav(CONTEXTES.admin)).includes('/groove-box'));
});

test("l'offre payante n'est proposée qu'à qui n'y est pas", () => {
  assert.ok(collectHrefs(buildAccountNav(CONTEXTES.gratuit)).includes('/pricing'));
  assert.ok(!collectHrefs(buildAccountNav(CONTEXTES.pro)).includes('/pricing'));
  // Un visiteur la voit dans la barre, pas dans un menu de compte qu'il n'a pas.
  assert.ok(collectHrefs(buildPrimaryNav(CONTEXTES.visiteur)).includes('/pricing'));
});

test('une entrée à mur d’authentification retient sa destination', () => {
  const entree: NavEntry = { id: 'x', href: '/dashboard', labelKey: 'book', visibility: 'signedIn', authWall: true };
  assert.equal(resolveHref(entree, CONTEXTES.visiteur), '/login?next=%2Fdashboard');
  assert.equal(resolveHref(entree, CONTEXTES.gratuit), '/dashboard');
});

test('l’entrée active se reconnaît, requête comprise', () => {
  const bibliotheque: NavEntry = { id: 'a', href: '/chords', labelKey: 'chords', visibility: 'always' };
  assert.ok(isActive(bibliotheque, '/chords'));
  assert.ok(isActive(bibliotheque, '/chords/guitar'));
  assert.ok(!isActive(bibliotheque, '/chord-detect'));

  // Le chercheur porte une requête : il ne doit pas s'allumer sur /chords, sinon
  // deux entrées du même menu seraient actives ensemble.
  const chercheur = buildToolsGroup(CONTEXTES.gratuit)
    .sections.flatMap((s) => s.entries).find((e) => e.id === 'chordByNotes')!;
  assert.ok(!isActive(chercheur, '/chords'));
});
