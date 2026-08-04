import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chordVariants } from '@/lib/use-chord-variants';
import { findChordVariants } from '@/lib/chord-data';
import type { InstrumentId, PianoChord, StringChord } from '@/types';

/**
 * Ce qu'on entend doit être ce que la grille montre.
 *
 * La bibliothèque distingue deux choses qui se ressemblent : une **surcharge**
 * remplace le doigté de référence, un **ajout** vient en plus. La lecture d'une
 * grille avait sa propre copie de cet ordre et préférait l'ajout — le fa de
 * guitare s'entendait donc en barré de huitième case, une octave au-dessus de
 * celui affiché, et personne ne pouvait le deviner en lisant l'écran.
 *
 * L'ordre vit désormais dans une seule fonction. Ces tests le figent.
 */

const GUITARE: InstrumentId = 'guitar';

function accordFactice(nom: string, case_: number): StringChord {
  return {
    id: `factice-${nom}-${case_}`, name: nom, full: nom, category: 'major',
    fingers: [[1, case_, 1]], open: [], muted: [], startFret: case_,
  };
}

type Surcharges = Map<string, { chord: StringChord | PianoChord }>;
type Ajouts = { instrumentId: InstrumentId; chord: StringChord | PianoChord }[];

test('sans surcharge ni ajout, la bibliothèque fait foi', () => {
  const variantes = chordVariants('F', GUITARE, new Map() as Surcharges, [] as Ajouts);
  assert.deepEqual(variantes, findChordVariants('F', GUITARE));
});

test('un ajout vient après le doigté de référence, jamais à sa place', () => {
  const ajout = accordFactice('F', 8);
  const variantes = chordVariants('F', GUITARE, new Map() as Surcharges,
    [{ instrumentId: GUITARE, chord: ajout }]);

  assert.equal(variantes[0], findChordVariants('F', GUITARE)[0],
    "le doigté de la bibliothèque doit rester en tête : c'est lui que la lecture joue");
  assert.ok(variantes.includes(ajout), "l'ajout doit rester proposé, en variante");
});

test('une surcharge remplace le doigté de référence', () => {
  const surcharge = accordFactice('F', 8);
  const surcharges = new Map([['f-guitar', { chord: surcharge }]]) as Surcharges;
  const variantes = chordVariants('F', GUITARE, surcharges, [] as Ajouts);

  assert.equal(variantes[0], surcharge);
  assert.ok(!variantes.some((v) => v.id === findChordVariants('F', GUITARE)[0].id),
    'le doigté remplacé ne doit plus être proposé');
});

test('une grille écrite en dièses retrouve la surcharge posée en bémols', () => {
  // La bibliothèque écrit les altérations en bémols, et c'est sous ce nom que les
  // surcharges sont enregistrées. Une grille, elle, peut être écrite en dièses :
  // sans cette correspondance, le doigté choisi par l'administrateur serait ignoré
  // pour la moitié des façons d'écrire le même accord.
  const surcharge = accordFactice('Db', 4);
  const surcharges = new Map([['db-guitar', { chord: surcharge }]]) as Surcharges;
  assert.equal(chordVariants('C#', GUITARE, surcharges, [] as Ajouts)[0], surcharge);
});

test('un ajout pour un autre instrument ne déborde pas', () => {
  const ajout = accordFactice('F', 8);
  const variantes = chordVariants('F', GUITARE, new Map() as Surcharges,
    [{ instrumentId: 'ukulele', chord: ajout }]);
  assert.ok(!variantes.includes(ajout));
});

test('un nom vide ne rend rien', () => {
  assert.deepEqual(chordVariants('  ', GUITARE, new Map() as Surcharges, [] as Ajouts), []);
});
