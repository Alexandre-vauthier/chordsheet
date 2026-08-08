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

/**
 * La règle a changé, et c'est un renversement assumé.
 *
 * Elle disait : un visiteur ne voit rien qui exige un compte. « Mon book » était
 * donc retiré de sa barre, qui affichait *Explorer · Outils · Tarifs* — un
 * catalogue et une facture, alors que l'essentiel du produit est gratuit et qu'on
 * vient ici pour écrire ses grilles.
 *
 * Elle dit maintenant : un visiteur peut voir une entrée qui exige un compte, à
 * condition qu'elle **mène à l'inscription** et non à une page fermée. Ce qui
 * compte n'est plus la présence de l'entrée, c'est l'adresse où elle dépose.
 */
const PRIVES = ['/dashboard', '/groups', '/sets', '/profile', '/session'];

test('un visiteur n’est jamais déposé sur une page qui exige un compte', () => {
  for (const entree of toutesLesEntrees(CONTEXTES.visiteur)) {
    const cible = resolveHref(entree, CONTEXTES.visiteur);
    assert.ok(!PRIVES.includes(cible), `${entree.id} dépose le visiteur sur ${cible}`);
  }
  // Et son menu « moi » est vide : il n'a pas de compte.
  assert.deepEqual(buildAccountNav(CONTEXTES.visiteur), []);
});

/**
 * « Mon book » n'ouvre rien à l'instant où on le voit sans compte : il annonce que
 * le produit en a un. C'est pour cela qu'il mène à l'inscription et non à la
 * connexion — demander à quelqu'un qui n'a jamais rien créé de se souvenir d'un
 * mot de passe est une porte fermée déguisée en porte.
 */
test('sans compte, « Mon book » invite à s’inscrire', () => {
  const book = buildPrimaryNav(CONTEXTES.visiteur)
    .find((n): n is NavEntry => 'href' in n && n.id === 'book');
  assert.ok(book, 'l’entrée doit être visible d’un visiteur');
  assert.equal(resolveHref(book, CONTEXTES.visiteur), '/register?next=%2Fdashboard');
  assert.equal(resolveHref(book, CONTEXTES.gratuit), '/dashboard');
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
});

/**
 * Elle y était, en troisième position, et c'est ce qu'un visiteur lisait en
 * dernier : « Tarifs » annonçait un service payant à quelqu'un qui n'avait encore
 * rien essayé, alors que l'essentiel du produit est gratuit. Le pied de page la
 * porte toujours, et les pages qui butent sur une limite y renvoient au moment où
 * la question se pose vraiment.
 */
test('la barre d’un visiteur ne parle pas d’argent', () => {
  assert.ok(!collectHrefs(buildPrimaryNav(CONTEXTES.visiteur)).includes('/pricing'));
});

test('une entrée à mur d’authentification retient sa destination', () => {
  const base = { id: 'x', href: '/dashboard', labelKey: 'book' } as const;
  const versConnexion: NavEntry = { ...base, visibility: 'signedIn', authWall: 'login' };
  const versInscription: NavEntry = { ...base, visibility: 'signedIn', authWall: 'register' };

  // La porte est nommée, et les deux ne s'adressent pas à la même personne : on
  // revient se connecter, on ne « revient » pas s'inscrire.
  assert.equal(resolveHref(versConnexion, CONTEXTES.visiteur), '/login?next=%2Fdashboard');
  assert.equal(resolveHref(versInscription, CONTEXTES.visiteur), '/register?next=%2Fdashboard');
  assert.equal(resolveHref(versConnexion, CONTEXTES.gratuit), '/dashboard');
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
