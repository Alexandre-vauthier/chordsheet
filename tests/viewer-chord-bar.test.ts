import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controlesBarreAccords, type EtatBarreAccords } from '@/lib/viewer-chord-bar';

/**
 * Les règles d'affichage des réglages d'une grille consultée.
 *
 * Ce que ces tests gardent, ce sont les trois défauts qu'on vient de corriger. Un
 * contrôle qui disparaît ne lève aucune erreur — il manque, et personne ne le voit
 * avant de le chercher.
 */

const BASE: EtatBarreAccords = {
  instrumentId: 'guitar',
  concertMode: false,
  aUneStructure: false,
  hasRepeatedSections: false,
};

const avec = (modif: Partial<EtatBarreAccords>) => controlesBarreAccords({ ...BASE, ...modif });

/* ── La sortie du mode Voix ──────────────────────────────────────────────── */

/**
 * Le piège de tout ce réagencement.
 *
 * Le sélecteur d'instrument vivait dans la barre de lecture, toujours affichée ; il
 * vit maintenant dans le bandeau des accords, qui s'efface en mode Voix. S'il
 * s'effaçait avec lui, la Voix deviendrait un cul-de-sac : plus rien à l'écran ne
 * permettrait de revenir à la guitare.
 */
test('en mode Voix, la rangée d’instruments reste — c’est la seule sortie', () => {
  const c = avec({ instrumentId: 'voice' });
  assert.equal(c.instrument, true, 'sans elle, on est enfermé dans les paroles');
  assert.equal(c.diagrammes, false);
  assert.equal(c.recapitulatif, false);
});

test('en mode Voix, ni vue ni minimisation : il n’y a pas de grille', () => {
  const c = avec({ instrumentId: 'voice', aUneStructure: true, hasRepeatedSections: true });
  assert.equal(c.vue, false);
  assert.equal(c.minimiser, false);
  assert.equal(c.rangeeStructure, false, 'une rangée vide ne doit pas laisser sa marge');
});

/* ── Le découplage ───────────────────────────────────────────────────────── */

/**
 * « Diagrammes » agit sur les cases de la grille, « Accords utilisés » ouvre un
 * panneau : deux choses sans rapport, et pourtant la première était un enfant
 * conditionnel de la seconde. Replier le récapitulatif retirait de l'écran le seul
 * moyen de rallumer les diagrammes.
 *
 * La propriété est tenue par la signature elle-même : l'ouverture du récapitulatif
 * n'est pas un paramètre, la fonction ne peut donc pas en dépendre. Ce test dit
 * qu'aucun champ de l'état ne joue ce rôle par la bande.
 */
test('la bascule des diagrammes ne dépend d’aucun état d’ouverture', () => {
  const champs: Partial<EtatBarreAccords>[] = [
    {}, { aUneStructure: true }, { hasRepeatedSections: true },
    { aUneStructure: true, hasRepeatedSections: true },
  ];
  for (const modif of champs) {
    assert.equal(avec(modif).diagrammes, true, `échoue avec ${JSON.stringify(modif)}`);
  }
});

test('les diagrammes et le récapitulatif s’affichent ou non ensemble, par l’instrument seul', () => {
  for (const instrumentId of ['guitar', 'ukulele', 'piano', 'bass'] as const) {
    const c = avec({ instrumentId });
    assert.equal(c.diagrammes, true, instrumentId);
    assert.equal(c.recapitulatif, true, instrumentId);
  }
});

/* ── La rangée de structure ──────────────────────────────────────────────── */

/**
 * « Minimiser » y arrive depuis la barre des accords, où il n'avait rien à faire.
 * Les deux contrôles qu'elle porte ont des conditions indépendantes : la rangée
 * doit donc tenir avec l'un, avec l'autre, et disparaître sans les deux.
 */
test('la rangée de structure tient avec l’un ou l’autre de ses contrôles', () => {
  const seuleVue = avec({ aUneStructure: true });
  assert.deepEqual(
    { vue: seuleVue.vue, minimiser: seuleVue.minimiser, rangee: seuleVue.rangeeStructure },
    { vue: true, minimiser: false, rangee: true },
  );

  const seuleMinim = avec({ hasRepeatedSections: true });
  assert.deepEqual(
    { vue: seuleMinim.vue, minimiser: seuleMinim.minimiser, rangee: seuleMinim.rangeeStructure },
    { vue: false, minimiser: true, rangee: true },
  );
});

test('sans structure ni répétition, la rangée disparaît', () => {
  assert.equal(avec({}).rangeeStructure, false);
});

/* ── Le mode concert ─────────────────────────────────────────────────────── */

/**
 * Sur scène, l'ancien emplacement du sélecteur était masqué avec toute la barre de
 * lecture. Le déplacer ne doit pas le faire réapparaître au milieu d'un morceau.
 */
test('sur scène, la rangée d’instruments s’efface', () => {
  assert.equal(avec({ concertMode: true }).instrument, false);
});

/** Mais le reste du bandeau était visible sur scène, et le reste. */
test('sur scène, le récapitulatif et les diagrammes restent atteignables', () => {
  const c = avec({ concertMode: true, aUneStructure: true, hasRepeatedSections: true });
  assert.equal(c.diagrammes, true);
  assert.equal(c.recapitulatif, true);
  assert.equal(c.rangeeStructure, true);
});
