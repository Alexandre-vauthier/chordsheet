import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deplacer } from '@/lib/grid-navigation';
import { reduireHistorique, type EtatHistorique } from '@/lib/history';

/* ── Navigation aux flèches ──────────────────────────────────────────────────
 *
 * Une ligne porte quatre mesures quand elle est pleine, mais couper et fusionner
 * les rendent inégales : c'est le cas que ces tests surveillent.
 */

const PLEINE = [4, 4, 4]; // trois lignes de quatre mesures

test('gauche et droite parcourent les mesures de la ligne', () => {
  assert.deepEqual(deplacer(PLEINE, { rowIndex: 1, cellIndex: 1 }, 'right'), { rowIndex: 1, cellIndex: 2 });
  assert.deepEqual(deplacer(PLEINE, { rowIndex: 1, cellIndex: 1 }, 'left'), { rowIndex: 1, cellIndex: 0 });
});

test('droite au bout d’une ligne passe au début de la suivante', () => {
  assert.deepEqual(deplacer(PLEINE, { rowIndex: 0, cellIndex: 3 }, 'right'), { rowIndex: 1, cellIndex: 0 });
});

test('gauche au début d’une ligne revient à la fin de la précédente', () => {
  assert.deepEqual(deplacer(PLEINE, { rowIndex: 1, cellIndex: 0 }, 'left'), { rowIndex: 0, cellIndex: 3 });
});

test('haut et bas changent de ligne en gardant la colonne', () => {
  assert.deepEqual(deplacer(PLEINE, { rowIndex: 0, cellIndex: 2 }, 'down'), { rowIndex: 1, cellIndex: 2 });
  assert.deepEqual(deplacer(PLEINE, { rowIndex: 2, cellIndex: 2 }, 'up'), { rowIndex: 1, cellIndex: 2 });
});

/** Le cas produit par la fusion : la ligne d'en dessous a moins de mesures. */
test('descendre vers une ligne plus courte tombe sur sa dernière mesure', () => {
  assert.deepEqual(deplacer([4, 2], { rowIndex: 0, cellIndex: 3 }, 'down'), { rowIndex: 1, cellIndex: 1 });
});

test('remonter vers une ligne plus longue garde la colonne', () => {
  assert.deepEqual(deplacer([4, 2], { rowIndex: 1, cellIndex: 1 }, 'up'), { rowIndex: 0, cellIndex: 1 });
});

/**
 * Les bords. Une flèche ne crée jamais rien : sortir de la section ne fait rien,
 * là où Tab ajoute une mesure.
 */
test('aux quatre bords, on ne bouge pas', () => {
  assert.equal(deplacer(PLEINE, { rowIndex: 0, cellIndex: 0 }, 'up'), null);
  assert.equal(deplacer(PLEINE, { rowIndex: 0, cellIndex: 0 }, 'left'), null);
  assert.equal(deplacer(PLEINE, { rowIndex: 2, cellIndex: 3 }, 'down'), null);
  assert.equal(deplacer(PLEINE, { rowIndex: 2, cellIndex: 3 }, 'right'), null);
});

test('une position hors de la section ne mène nulle part', () => {
  assert.equal(deplacer(PLEINE, { rowIndex: 9, cellIndex: 0 }, 'down'), null);
  assert.equal(deplacer([], { rowIndex: 0, cellIndex: 0 }, 'right'), null);
});

/* ── Annuler / refaire ───────────────────────────────────────────────────────
 *
 * L'historique porte l'état entier de la grille : c'est ce qui rend annulable
 * indifféremment une saisie, une duplication ou un déplacement de section.
 */

const depart = <T,>(present: T): EtatHistorique<T> => ({ present, passe: [], futur: [] });
const poser = <T,>(etat: EtatHistorique<T>, maj: T | ((p: T) => T), historique = true) =>
  reduireHistorique(etat, { type: 'poser', maj, historique, limite: 60 });

test('annuler rend l’état précédent, refaire le reprend', () => {
  let e = depart('a');
  e = poser(e, 'b');
  e = poser(e, 'c');
  e = reduireHistorique(e, { type: 'annuler' });
  assert.equal(e.present, 'b');
  e = reduireHistorique(e, { type: 'annuler' });
  assert.equal(e.present, 'a');
  e = reduireHistorique(e, { type: 'refaire' });
  assert.equal(e.present, 'b');
});

test('sans rien à annuler ni à refaire, l’état ne bouge pas', () => {
  const e = depart('a');
  assert.equal(reduireHistorique(e, { type: 'annuler' }), e);
  assert.equal(reduireHistorique(e, { type: 'refaire' }), e);
});

test('une action neuve coupe ce qui avait été annulé', () => {
  let e = poser(poser(depart('a'), 'b'), 'c');
  e = reduireHistorique(e, { type: 'annuler' });
  e = poser(e, 'd');
  assert.equal(e.present, 'd');
  assert.equal(e.futur.length, 0, 'refaire ne doit plus mener à « c »');
});

/**
 * Le recalcul automatique de la difficulté passe par le même état que les gestes.
 * Empilé, il ferait qu'un premier Ctrl+Z ne défasse rien de visible.
 */
test('une écriture hors historique ne s’empile pas', () => {
  let e = poser(depart('a'), 'b');
  e = poser(e, 'auto', false);
  assert.equal(e.present, 'auto');
  e = reduireHistorique(e, { type: 'annuler' });
  assert.equal(e.present, 'a', 'annuler saute par-dessus l’écriture automatique');
});

test('une mise à jour qui ne change rien ne s’empile pas', () => {
  const e = poser(depart('a'), (p) => p);
  assert.equal(e.passe.length, 0);
});

test('la mise à jour reçoit l’état courant', () => {
  const e = poser(depart(2), (p) => p * 5);
  assert.equal(e.present, 10);
  assert.deepEqual(e.passe, [2]);
});

test('la pile est bornée, et ce sont les plus anciens qui tombent', () => {
  let e: EtatHistorique<number> = depart(0);
  for (let i = 1; i <= 10; i++) e = reduireHistorique(e, { type: 'poser', maj: i, historique: true, limite: 3 });
  assert.equal(e.passe.length, 3);
  assert.deepEqual(e.passe, [7, 8, 9], 'les trois états qui précèdent le présent');
});

test('réinitialiser efface les deux piles', () => {
  let e = poser(poser(depart('a'), 'b'), 'c');
  e = reduireHistorique(e, { type: 'reinitialiser', valeur: 'z' });
  assert.deepEqual(e, { present: 'z', passe: [], futur: [] });
});

/**
 * L'usage réel : ce n'est pas une pile de commandes mais une pile d'états, donc
 * une suppression de section s'annule comme une saisie d'accord, sans code dédié.
 */
test('n’importe quelle action s’annule, sans la décrire', () => {
  type Grille = { sections: string[] };
  let e = depart<Grille>({ sections: ['Intro', 'Couplet', 'Refrain'] });
  e = poser(e, (g) => ({ sections: g.sections.filter((s) => s !== 'Couplet') }));      // suppression
  e = poser(e, (g) => ({ sections: [...g.sections, g.sections[0]] }));                  // duplication
  e = poser(e, (g) => ({ sections: [...g.sections].reverse() }));                       // déplacement
  assert.deepEqual(e.present.sections, ['Intro', 'Refrain', 'Intro']);
  e = reduireHistorique(e, { type: 'annuler' });
  assert.deepEqual(e.present.sections, ['Intro', 'Refrain', 'Intro'].reverse());
  e = reduireHistorique(e, { type: 'annuler' });
  assert.deepEqual(e.present.sections, ['Intro', 'Refrain']);
  e = reduireHistorique(e, { type: 'annuler' });
  assert.deepEqual(e.present.sections, ['Intro', 'Couplet', 'Refrain']);
});
