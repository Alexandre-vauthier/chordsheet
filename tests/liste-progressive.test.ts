import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTEUR, nombreDeClics, PREMIER_LOT, prochainSeuil } from '@/lib/liste-progressive';

/**
 * Ce qui a motivé ce module : « j'ai trop souvent le bouton *Voir les X grilles
 * suivantes* ». La question à laquelle ces tests répondent n'est donc pas « le
 * calcul est-il juste » mais « combien de fois vais-je encore le voir ».
 */

/** Le plafond de lecture du serveur (`public-sheet-index`), donc la plus grande
 *  liste qu'une page puisse recevoir. */
const PLAFOND_SERVEUR = 5000;

test('les listes du catalogue d’aujourd’hui tiennent en un clic au plus', () => {
  // 258 grilles publiques, regroupées par morceau : moins de 258 entrées.
  for (const taille of [27, 129, 258]) {
    assert.ok(nombreDeClics(taille) <= 1, `${taille} entrées demandent ${nombreDeClics(taille)} clics`);
  }
});

/** Les pages thématiques n'affichaient que vingt-quatre vignettes ; elles tiennent
 *  maintenant d'un seul écran, sans aucun bouton. */
test('une liste courte n’affiche aucun bouton', () => {
  for (const taille of [0, 1, 24, 27, PREMIER_LOT]) {
    assert.equal(nombreDeClics(taille), 0, `${taille} entrées ne devraient rien demander`);
  }
});

test('le bouton apparaît dès qu’il reste quelque chose à montrer', () => {
  assert.equal(nombreDeClics(PREMIER_LOT + 1), 1);
});

/**
 * La propriété qui remplace le pas fixe. Un pas réglé sur la taille du jour
 * vieillit mal : les 48 d'hier demandaient déjà deux clics sur le catalogue actuel,
 * et en auraient demandé cent au plafond du serveur. En multipliant, le nombre de
 * clics croît comme un logarithme.
 */
test('même au plafond du serveur, le bouton ne se voit pas plus de quatre fois', () => {
  assert.ok(nombreDeClics(PLAFOND_SERVEUR) <= 4, `${nombreDeClics(PLAFOND_SERVEUR)} clics`);

  // Et la propriété tient sur toute la plage, pas seulement à ses extrémités.
  for (let taille = 1; taille <= PLAFOND_SERVEUR; taille += 37) {
    assert.ok(nombreDeClics(taille) <= 4, `${taille} entrées demandent ${nombreDeClics(taille)} clics`);
  }
});

/** L'ancien pas, pour mémoire : ce que le même catalogue coûtait avant. */
test('c’est strictement mieux que le pas fixe qu’on remplace', () => {
  const avecPasFixe = (total: number, pas: number) => Math.max(0, Math.ceil((total - pas) / pas));
  for (const taille of [129, 258, 1000, PLAFOND_SERVEUR]) {
    assert.ok(
      nombreDeClics(taille) <= avecPasFixe(taille, 48),
      `${taille} : ${nombreDeClics(taille)} clics contre ${avecPasFixe(taille, 48)} avec un pas de 48`,
    );
  }
});

/* ── Le seuil lui-même ───────────────────────────────────────────────────── */

test('le seuil ne recule jamais', () => {
  let seuil = PREMIER_LOT;
  for (let i = 0; i < 6; i++) {
    const suivant = prochainSeuil(seuil);
    assert.ok(suivant > seuil, `${seuil} → ${suivant}`);
    seuil = suivant;
  }
});

/**
 * `setMontrees(prochainSeuil)` passe la valeur courante : un seuil déjà supérieur
 * au premier lot doit continuer de croître depuis là, et non repartir du début.
 */
test('le seuil part de la valeur courante, pas du premier lot', () => {
  assert.equal(prochainSeuil(PREMIER_LOT), PREMIER_LOT * FACTEUR);
  assert.equal(prochainSeuil(PREMIER_LOT * FACTEUR), PREMIER_LOT * FACTEUR * FACTEUR);
});

/** Un état incohérent — zéro, négatif — ne doit pas figer la liste sur place. */
test('un seuil aberrant repart du premier lot', () => {
  assert.equal(prochainSeuil(0), PREMIER_LOT * FACTEUR);
  assert.equal(prochainSeuil(-10), PREMIER_LOT * FACTEUR);
});
