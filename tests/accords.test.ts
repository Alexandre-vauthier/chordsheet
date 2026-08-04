import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chordPitchClasses, findChordVariants, getAllExtendedChords, getChordsByInstrument,
} from '@/lib/chord-data';
import type { InstrumentId, StringChord, PianoChord } from '@/types';

/**
 * Un accord doit faire entendre les notes de son nom.
 *
 * C'est la règle que la bibliothèque a violée le plus souvent et le plus
 * discrètement : douze sus de guitare qui sonnaient majeurs, vingt-trois sus de
 * banjo, vingt-deux de ukulélé, un ré bémol augmenté sans son ré bémol. Chaque
 * fois le doigté était plausible à l'œil et faux à l'oreille, et chaque fois il a
 * fallu qu'un humain le remarque.
 *
 * Ce contrôle est exactement celui qu'on écrivait à la main après coup, en
 * script jetable, et qu'on jetait ensuite.
 */

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ENHARMONIE: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

/** Intervalles en demi-tons depuis la fondamentale, par suffixe d'accord. */
const FORMULES: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mMaj7: [0, 3, 7, 11],
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], aug: [0, 4, 8], m7b5: [0, 3, 6, 10],
  sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], add9: [0, 4, 7, 2],
  madd9: [0, 3, 7, 2], '9': [0, 4, 7, 10, 2], maj9: [0, 4, 7, 11, 2], m9: [0, 3, 7, 10, 2],
  '11': [0, 4, 7, 10, 2, 5], '13': [0, 4, 7, 10, 2, 9],
  '7b5': [0, 4, 6, 10], '7#5': [0, 4, 8, 10], '7b9': [0, 4, 7, 10, 1], '7#9': [0, 4, 7, 10, 3],
};

const INSTRUMENTS: InstrumentId[] = ['guitar', 'ukulele', 'mandolin', 'banjo', 'bass', 'piano'];

function demiTon(nom: string): number {
  return NOTES.indexOf(ENHARMONIE[nom] ?? nom);
}

/** Notes attendues d'un nom d'accord, ou `null` si le suffixe n'est pas couvert. */
function attendues(nom: string): Set<number> | null {
  const m = nom.match(/^([A-G][b#]?)(.*)$/);
  const formule = m ? FORMULES[m[2]] : undefined;
  if (!m || !formule) return null;
  const racine = demiTon(m[1]);
  if (racine < 0) return null;
  return new Set(formule.map((i) => (racine + i) % 12));
}

function jouees(accord: StringChord | PianoChord, instrument: InstrumentId): Set<number> {
  return new Set(chordPitchClasses(accord, instrument).map(demiTon));
}

for (const instrument of INSTRUMENTS) {
  test(`${instrument} : aucun doigté du dictionnaire ne fait sonner de note étrangère`, () => {
    const fautifs: string[] = [];
    for (const accord of getChordsByInstrument(instrument)) {
      const att = attendues(accord.name);
      assert.ok(att, `suffixe non couvert par le contrôle : ${accord.name} (${instrument})`);
      const etrangeres = [...jouees(accord, instrument)].filter((p) => !att.has(p));
      if (etrangeres.length) fautifs.push(`${accord.name} → ${etrangeres.map((p) => NOTES[p]).join(' ')}`);
    }
    assert.deepEqual(fautifs, [], `accords qui ne sonnent pas leur nom :\n  ${fautifs.join('\n  ')}`);
  });

  test(`${instrument} : aucun doigté calculé ne fait sonner de note étrangère`, () => {
    const fautifs: string[] = [];
    for (const accord of getAllExtendedChords(instrument)) {
      const att = attendues(accord.name);
      if (!att) continue; // formules du générateur plus riches que celles contrôlées ici
      const etrangeres = [...jouees(accord, instrument)].filter((p) => !att.has(p));
      if (etrangeres.length) fautifs.push(`${accord.name} → ${etrangeres.map((p) => NOTES[p]).join(' ')}`);
    }
    assert.deepEqual(fautifs, [], `accords calculés faux :\n  ${fautifs.join('\n  ')}`);
  });
}

test('un barré ne traverse jamais une corde à vide', () => {
  const fautifs: string[] = [];
  for (const instrument of INSTRUMENTS) {
    const tous = [...getChordsByInstrument(instrument), ...getAllExtendedChords(instrument)];
    for (const a of tous as StringChord[]) {
      if (!a.barre) continue;
      const sous = (a.open ?? []).filter((s) => s >= a.barre!.fromString && s <= a.barre!.toString);
      if (sous.length) fautifs.push(`${instrument} ${a.name} : cordes ${sous.join(', ')}`);
    }
  }
  assert.deepEqual(fautifs, [], `barrés impossibles :\n  ${fautifs.join('\n  ')}`);
});

test('tout accord courant a un doigté sur chaque instrument à cordes', () => {
  const racines = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const suffixes = ['', 'm', '7', 'maj7', 'm7', 'dim', 'aug', 'sus2', 'sus4'];
  const manquants: string[] = [];
  for (const instrument of ['guitar', 'ukulele', 'mandolin', 'banjo'] as InstrumentId[]) {
    for (const r of racines) {
      for (const s of suffixes) {
        if (!findChordVariants(r + s, instrument).length) manquants.push(`${instrument} ${r}${s}`);
      }
    }
  }
  assert.deepEqual(manquants, [], `accords sans doigté :\n  ${manquants.join('\n  ')}`);
});
