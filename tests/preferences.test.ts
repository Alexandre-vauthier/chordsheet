import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPreferences, PREFERENCE_KEYS, USER_PREFERENCE_DEFAULTS } from '@/lib/user-preferences';

/**
 * La lecture des préférences d'un utilisateur.
 *
 * Elles étaient énumérées à la main au chargement, et l'énumération avait fini par
 * en oublier une : `showChordSummaryByDefault` était écrite en base mais jamais
 * relue, si bien que le réglage ne survivait pas à un rechargement de page.
 */

test('une préférence enregistrée est relue', () => {
  // Le cas exact du défaut : la valeur est en base, elle doit ressortir.
  const lu = readPreferences({ showChordSummaryByDefault: false });
  assert.equal(lu.showChordSummaryByDefault, false);
});

test('toutes les préférences sont relues, sans exception', () => {
  // Le vrai garde-fou : on écrit une valeur contraire au défaut pour chacune, et
  // on vérifie qu'aucune ne se perd en route. Ajouter une préférence sans la
  // relire fera tomber ce test.
  const contraire: Record<string, unknown> = {};
  for (const key of PREFERENCE_KEYS) {
    const defaut = (USER_PREFERENCE_DEFAULTS as Record<string, unknown>)[key];
    if (typeof defaut === 'boolean') contraire[key] = !defaut;
  }
  const lu = readPreferences(contraire) as Record<string, unknown>;
  for (const [key, valeur] of Object.entries(contraire)) {
    assert.equal(lu[key], valeur, `${key} n'est pas relue`);
  }
});

test('une préférence jamais réglée retombe sur son défaut', () => {
  const lu = readPreferences({});
  assert.equal(lu.chordColorCoding, true);
  assert.equal(lu.darkMode, true);
  assert.equal(lu.defaultChordsAudio, true);
  assert.equal(lu.showInlineDiagram, false);
  // Un refus explicite n'est pas un réglage absent : il ne doit pas être écrasé.
  assert.equal(readPreferences({ chordColorCoding: false }).chordColorCoding, false);
});

test("l'instrument n'a pas de défaut : absent veut dire pas encore choisi", () => {
  // Retomber sur « guitare » ferait croire à un choix que personne n'a fait.
  assert.equal(readPreferences({}).preferredInstrument, undefined);
  assert.equal(readPreferences({ preferredInstrument: 'ukulele' }).preferredInstrument, 'ukulele');
  assert.ok(PREFERENCE_KEYS.includes('preferredInstrument'));
});
