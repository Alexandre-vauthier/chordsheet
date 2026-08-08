import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enLots, noteDe, sortDuGroupe, TAILLE_LOT } from '@/lib/account-deletion';
import type { GroupRole } from '@/types';

/**
 * La suppression d'un compte est définitive. Ces tests gardent les décisions qui la
 * gouvernent, parce qu'une erreur ici ne se rattrape pas : il n'y a pas de
 * corbeille, et la personne concernée n'est plus là pour signaler quoi que ce soit.
 */

const g = (memberIds: string[], roles: Record<string, GroupRole>) => ({ memberIds, roles });

/* ── Les groupes ─────────────────────────────────────────────────────────── */

test('seul membre : le groupe est supprimé', () => {
  assert.deepEqual(sortDuGroupe(g(['paul'], { paul: 'leader' }), 'paul'), { action: 'supprimer' });
});

/**
 * Le cas qui compte. Retirer le seul leader sans en promouvoir un autre laisse un
 * groupe que personne ne peut plus modifier ni ouvrir à quelqu'un : les règles
 * Firestore réservent ces droits aux leaders. Le groupe survivrait, figé, sans
 * aucune issue.
 */
test('seul leader, d’autres restent : le plus ancien est promu', () => {
  const sort = sortDuGroupe(g(['paul', 'marie', 'leo'], { paul: 'leader', marie: 'member', leo: 'member' }), 'paul');
  assert.deepEqual(sort, {
    action: 'mettre-a-jour',
    memberIds: ['marie', 'leo'],
    roles: { marie: 'leader', leo: 'member' },
    ownerId: 'marie',
  });
});

test('un autre leader reste : personne n’est promu, et le propriétaire ne bouge pas', () => {
  const sort = sortDuGroupe(g(['paul', 'marie', 'leo'], { paul: 'leader', marie: 'leader', leo: 'member' }), 'paul');
  assert.deepEqual(sort, {
    action: 'mettre-a-jour',
    memberIds: ['marie', 'leo'],
    roles: { marie: 'leader', leo: 'member' },
  });
  assert.ok(!('ownerId' in sort), 'rien ne justifie de changer de propriétaire');
});

/** Simple membre : il s'en va, rien d'autre ne change. */
test('simple membre : aucune promotion', () => {
  const sort = sortDuGroupe(g(['paul', 'marie'], { paul: 'leader', marie: 'member' }), 'marie');
  assert.deepEqual(sort, { action: 'mettre-a-jour', memberIds: ['paul'], roles: { paul: 'leader' } });
});

test('groupe où il ne figure pas : on n’y touche pas', () => {
  assert.deepEqual(sortDuGroupe(g(['marie'], { marie: 'leader' }), 'paul'), { action: 'ignorer' });
});

/** Le rôle manquant ne doit pas produire `undefined` dans la table écrite. */
test('un membre sans rôle déclaré devient simple membre', () => {
  const sort = sortDuGroupe(g(['paul', 'marie'], { paul: 'leader' }), 'paul');
  assert.deepEqual(sort, {
    action: 'mettre-a-jour', memberIds: ['marie'], roles: { marie: 'leader' }, ownerId: 'marie',
  });
});

/** Deux exécutions doivent désigner le même leader, sans quoi un rejeu diverge. */
test('la promotion est déterministe', () => {
  const groupe = g(['paul', 'marie', 'leo'], { paul: 'leader', marie: 'member', leo: 'member' });
  assert.deepEqual(sortDuGroupe(groupe, 'paul'), sortDuGroupe(groupe, 'paul'));
});

/* ── Les notes ───────────────────────────────────────────────────────────── */

test('la note se recalcule depuis les avis restants', () => {
  assert.deepEqual(noteDe([5, 4, 4]), { averageRating: 4.3, ratingCount: 3 });
});

/**
 * Sans note restante, la grille n'est pas « notée zéro » : elle n'est pas notée.
 * Écrire 0 la ferait passer pour mauvaise, et la trierait comme telle.
 */
test('plus aucun avis : la moyenne redevient nulle, pas zéro', () => {
  assert.deepEqual(noteDe([]), { averageRating: null, ratingCount: 0 });
});

/**
 * La raison d'être de cette forme. La première version soustrayait du cache : elle
 * reconstituait une somme en multipliant `averageRating` par `ratingCount`. Comme
 * la moyenne est arrondie au dixième à l'écriture, la somme reconstituée était déjà
 * fausse — 5, 4, 4 se stocke en 4,3, dont on ne retrouve jamais 13.
 *
 * Le recalcul depuis les avis ne connaît pas ce problème, et **répare** au passage
 * un cache qui aurait dérivé.
 */
test('le recalcul ne dépend pas du cache, donc ne peut pas en hériter l’erreur', () => {
  // Reconstituer la somme depuis la moyenne stockée (4,3 × 3 = 12,9) et retirer un
  // 4 donnait 4,4 ; la valeur juste est 4,5.
  assert.equal(noteDe([5, 4]).averageRating, 4.5);
});

test('un seul avis restant fait la moyenne à lui seul', () => {
  assert.deepEqual(noteDe([2]), { averageRating: 2, ratingCount: 1 });
});

/**
 * Une note absente ou corrompue en base ne doit ni compter dans le total ni faire
 * sortir `NaN`, qui se propagerait dans le document et casserait le tri.
 */
test('les valeurs non numériques sont écartées, pas propagées', () => {
  const n = noteDe([5, NaN, 3, undefined as unknown as number]);
  assert.deepEqual(n, { averageRating: 4, ratingCount: 2 });
  assert.ok(!Number.isNaN(n.averageRating), 'aucun NaN ne doit atteindre le document');
});

/* ── Le découpage en lots ────────────────────────────────────────────────── */

/**
 * Le défaut que ce découpage supprime : tout tenait dans un seul lot, et Firestore
 * en refuse un de plus de 500 écritures. Un utilisateur assidu voyait donc sa
 * suppression échouer en entier, sans que rien ne l'annonce.
 */
test('le découpage reste sous le plafond de Firestore', () => {
  assert.ok(TAILLE_LOT < 500, `${TAILLE_LOT} doit laisser de la marge sous 500`);
  const lots = enLots(Array.from({ length: 1001 }, (_, i) => i));
  assert.ok(lots.every((l) => l.length <= TAILLE_LOT), 'aucun lot ne dépasse');
  assert.equal(lots.flat().length, 1001, 'rien n’est perdu au découpage');
  assert.deepEqual(lots.flat(), Array.from({ length: 1001 }, (_, i) => i), 'ni réordonné');
});

test('une liste vide ne produit aucun lot', () => {
  assert.deepEqual(enLots([]), []);
});

test('une liste plus courte qu’un lot tient en un seul', () => {
  assert.deepEqual(enLots([1, 2, 3]), [[1, 2, 3]]);
});
