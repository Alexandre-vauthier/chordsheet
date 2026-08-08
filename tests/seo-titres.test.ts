import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Les titres et descriptions des pages d'accord.
 *
 * Mesuré sur une semaine de Search Console : les requêtes françaises se classent en
 * position 34 quand les anglaises sont à 51, et plusieurs pages sont déjà en
 * première page — « fm accord » en 4, « db7 guitare » en 9. Pourtant **zéro clic
 * sur 283 impressions** : ce n'était pas le classement qui manquait, c'était une
 * raison de cliquer.
 *
 * Ces tests gardent les deux propriétés qui font cette raison : le nom français doit
 * y figurer, et rien ne doit dépasser ce que Google affiche.
 */

const messages = (langue: string) =>
  JSON.parse(readFileSync(`messages/${langue}.json`, 'utf8')).Seo.pages.chord;

/**
 * Deux cas, et deux seuils.
 *
 * Le **courant** : un accord de une à trois lettres, une guitare. C'est la quasi
 * totalité des pages, et là rien ne doit être coupé.
 *
 * Le **pire** : l'accord au nom le plus long de la bibliothèque (six caractères,
 * `F#sus4`, `Ebadd9`) sur l'instrument à la forme longue la plus grande. Ceux-là
 * dépassent, et c'est assumé : Google coupe l'affichage, il ne pénalise pas, et ce
 * qui est coupé est la fin de la promesse, pas les mots qui font correspondre la
 * page à la requête. Le second seuil garde seulement cette dégradation dans des
 * bornes raisonnables plutôt que de la laisser filer.
 */
const CAS: Record<string, { courant: Record<string, string>; pire: Record<string, string> }> = {
  fr: {
    courant: { chord: 'Bb', frenchChord: 'Sib', instrumentAt: 'à la guitare', instrumentLower: 'guitare',
               notes: 'Bb, D, F', frenchNotes: 'Sib, Ré, Fa' },
    pire: { chord: 'F#sus4', frenchChord: 'Fa#sus4', instrumentAt: 'à la mandoline', instrumentLower: 'mandoline',
            notes: 'F#, B, C#', frenchNotes: 'Fa#, Si, Do#' },
  },
  en: {
    courant: { chord: 'Bb', frenchChord: 'Sib', instrumentAt: 'on guitar', instrumentLower: 'guitar',
               notes: 'Bb, D, F', frenchNotes: 'Sib, Ré, Fa' },
    pire: { chord: 'F#sus4', frenchChord: 'Fa#sus4', instrumentAt: 'on mandolin', instrumentLower: 'mandolin',
            notes: 'F#, B, C#', frenchNotes: 'Fa#, Si, Do#' },
  },
};

const rendre = (gabarit: string, valeurs: Record<string, string>) =>
  gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? `{${cle}}`);

/** Google coupe un titre au-delà d'environ soixante caractères, suffixe compris. */
const TITRE = 60;
/** Et une description au-delà d'environ cent cinquante-cinq. */
const DESCRIPTION = 155;
/** Ce qu'on tolère aux noms les plus longs, où la coupe est assumée. */
const TITRE_EXTREME = 70;
const DESCRIPTION_EXTREME = 170;
const SUFFIXE = ' | Alviena';

for (const langue of ['fr', 'en']) {
  const m = messages(langue);

  test(`${langue} — le titre courant tient dans ce que Google affiche`, () => {
    const rendu = rendre(m.title, CAS[langue].courant) + SUFFIXE;
    assert.ok(rendu.length <= TITRE, `${rendu.length} caractères : « ${rendu} »`);
  });

  test(`${langue} — la description courante tient dans ce que Google affiche`, () => {
    const rendu = rendre(m.description, CAS[langue].courant);
    assert.ok(rendu.length <= DESCRIPTION, `${rendu.length} caractères : « ${rendu} »`);
  });

  test(`${langue} — même le nom le plus long ne dérape pas`, () => {
    const titre = rendre(m.title, CAS[langue].pire) + SUFFIXE;
    const desc = rendre(m.description, CAS[langue].pire);
    assert.ok(titre.length <= TITRE_EXTREME, `titre ${titre.length} : « ${titre} »`);
    assert.ok(desc.length <= DESCRIPTION_EXTREME, `description ${desc.length} : « ${desc} »`);
  });

  test(`${langue} — aucun paramètre ne reste non substitué`, () => {
    for (const cle of ['title', 'description']) {
      assert.doesNotMatch(rendre(m[cle], CAS[langue].courant), /\{\w+\}/, `${cle} porte un paramètre inconnu`);
    }
  });
}

/**
 * Le nom français est l'avantage réel sur ce marché : les concurrents anglo-saxons
 * ne l'ont pas, et « dm correspondance accord francais » se cherche vraiment.
 */
test('fr — le nom français figure au titre et la correspondance à la description', () => {
  assert.match(messages('fr').title, /\{frenchChord\}/, 'le titre doit porter le nom français');
  assert.match(messages('fr').description, /\{frenchChord\}/);
  assert.match(messages('fr').description, /\{frenchNotes\}/, 'les notes françaises font la correspondance');
});

/**
 * La description promettait « et les grilles du site qui l'utilisent ». Sur les
 * 1 424 pages d'accord, 135 seulement ont une grille : la promesse était fausse neuf
 * fois sur dix, et une description démentie par la page coûte la confiance autant
 * que le clic.
 */
test('aucune description ne promet des grilles que la page n’a pas', () => {
  for (const langue of ['fr', 'en']) {
    assert.doesNotMatch(messages(langue).description, /grilles|chord charts/i, langue);
  }
});
