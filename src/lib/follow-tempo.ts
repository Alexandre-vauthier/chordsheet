/**
 * Horloge du suivi micro : elle estime le tempo réellement joué à partir des
 * changements d'accord entendus, pour pouvoir avancer même quand la détection
 * rate un accord (mal joué, étouffé, noyé dans le bruit).
 *
 * L'estimation ne se nourrit que des avances **confirmées** par le micro. Une
 * avance décidée par l'horloge elle-même n'alimente pas l'estimation, sinon
 * celle-ci dériverait sur ses propres prédictions.
 */

/** 300 BPM : plus rapide, c'est un artefact de détection. */
export const MIN_MS_PER_BEAT = 200;
/** 40 BPM : plus lent, c'est une pause, pas un tempo. */
export const MAX_MS_PER_BEAT = 1500;

/**
 * Fraction de la durée attendue au bout de laquelle on bascule sur l'accord
 * suivant sans l'avoir entendu. Sous 1, le suivi devance légèrement le joueur :
 * l'accord suivant est déjà surligné quand il l'attaque.
 */
export const ANTICIPATION = 0.9;

/** Nombre d'avances non confirmées consécutives au-delà duquel on coupe le suivi. */
export const MAX_UNCONFIRMED = 2;

export function clampMsPerBeat(value: number): number {
  return Math.min(MAX_MS_PER_BEAT, Math.max(MIN_MS_PER_BEAT, value));
}

/**
 * Nouvelle estimation après un changement d'accord entendu, en moyenne mobile
 * exponentielle. Une mesure aberrante (joueur qui s'arrête puis reprend) est
 * ramenée dans les bornes avant d'être intégrée, et son poids reste modéré.
 */
export function updateMsPerBeat(current: number, elapsedMs: number, beats: number, alpha = 0.4): number {
  if (beats <= 0 || elapsedMs <= 0) return current;
  const observed = clampMsPerBeat(elapsedMs / beats);
  return clampMsPerBeat(current * (1 - alpha) + observed * alpha);
}

/** Durée attendue d'un bloc, au tempo estimé. */
export function expectedBlockMs(beats: number, msPerBeat: number): number {
  return Math.max(0, beats) * msPerBeat;
}

/**
 * Faut-il basculer sur le bloc suivant alors que rien n'a été entendu ?
 * Vrai dès que la durée attendue est écoulée à `ANTICIPATION` près.
 */
export function shouldAnticipate(elapsedMs: number, beats: number, msPerBeat: number, lead = ANTICIPATION): boolean {
  const expected = expectedBlockMs(beats, msPerBeat);
  if (expected <= 0) return false;
  return elapsedMs >= expected * lead;
}
