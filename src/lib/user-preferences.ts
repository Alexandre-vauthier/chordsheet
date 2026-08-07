import type { UserPreferences } from '@/types';

/**
 * Défauts et lecture des préférences utilisateur.
 *
 * Le type vit dans `@/types` ; ce module porte ce qui s'exécute. Ensemble ils
 * remplacent quatre listes qui avaient fini par diverger — notamment
 * `showChordSummaryByDefault`, qui était écrite en base mais jamais relue, si bien
 * que le réglage ne survivait pas à un rechargement.
 */

/**
 * Ce que vaut une préférence qu'un compte n'a jamais réglée.
 *
 * Ces valeurs faisaient double emploi entre la page de profil et le contexte, et
 * deux d'entre elles s'y contredisaient : le contexte donnait `true` au code
 * couleur et au mode sombre, la page `false`. Un compte neuf n'obtenait donc pas
 * la même chose selon qui répondait le premier.
 *
 * Une préférence absente de cette table n'a pas de défaut : `preferredInstrument`
 * vide veut dire « pas encore choisi », ce qui n'est pas la même chose que guitare.
 */
export const USER_PREFERENCE_DEFAULTS: UserPreferences = {
  notationPreference: 'american',
  // Activé par défaut. Le champ n'est absent que pour les comptes créés avant que
  // ce défaut existe : un refus explicite est stocké en `false` et n'est donc
  // jamais écrasé ici.
  chordColorCoding: true,
  showInlineDiagram: false,
  darkMode: true,
  minimizeRepeatedSections: false,
  printMinimizeRepeatedSections: false,
  printChordDiagrams: false,
  showChordSummaryByDefault: true,
  defaultMetronome: false,
  defaultGrooveBox: false,
  defaultChordsAudio: true,
  defaultCountIn: false,
};

/**
 * Les noms des préférences, pour les parcourir.
 *
 * `preferredInstrument` n'a pas de défaut, il n'apparaît donc pas dans la table
 * ci-dessus : on l'ajoute ici à la main pour que la liste reste complète.
 */
export const PREFERENCE_KEYS: (keyof UserPreferences)[] = [
  'preferredInstrument',
  ...(Object.keys(USER_PREFERENCE_DEFAULTS) as (keyof UserPreferences)[]),
];

/**
 * Les préférences d'un document Firestore, chacune ramenée à son défaut si absente.
 *
 * Une boucle plutôt qu'une énumération : c'est ce qui rend l'oubli impossible.
 */
export function readPreferences(data: Record<string, unknown>): UserPreferences {
  const out = { ...USER_PREFERENCE_DEFAULTS };
  for (const key of PREFERENCE_KEYS) {
    const valeur = data[key];
    if (valeur !== undefined && valeur !== null) {
      (out as Record<string, unknown>)[key] = valeur;
    }
  }
  return out;
}

/** Cette clé est-elle une préférence ? Sert à trier ce qui part vers Firebase Auth. */
export function isPreferenceKey(key: string): key is keyof UserPreferences {
  return (PREFERENCE_KEYS as string[]).includes(key);
}
