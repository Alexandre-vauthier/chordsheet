/**
 * Lecture des extraits de 30 secondes (iTunes).
 *
 * Un seul élément audio pour tout le site. C'est ce qui garantit qu'un extrait
 * lancé depuis une carte s'arrête quand on en lance un autre, ou quand on quitte
 * l'écran — le lecteur de la page de consultation avait sa propre instance, sans
 * arrêt au démontage : l'extrait continuait après le changement de page.
 *
 * Le module vit hors des composants pour que tous partagent la même instance :
 * défini dans un composant, chacun aurait la sienne.
 */

/**
 * Niveau des extraits.
 *
 * Les fichiers d'iTunes sont masterisés fort, et lus à plein volume ils arrivent
 * nettement au-dessus du reste : le son de l'accompagnement, celui de la boîte à
 * rythmes, et le lecteur d'Apple lui-même, qui est plus discret. On les atténue d'un
 * peu plus de quatre décibels pour rester dans le même registre.
 */
const VOLUME = 0.6;

let current: HTMLAudioElement | null = null;
let onStopped: (() => void) | null = null;

function clear() {
  current = null;
  const callback = onStopped;
  onStopped = null;
  callback?.();
}

/** Lance un extrait. Coupe le précédent, et prévient son appelant qu'il s'est arrêté. */
export function playPreviewAudio(url: string, onStop: () => void) {
  stopPreviewAudio();

  const audio = new Audio(url);
  audio.volume = VOLUME;
  current = audio;
  onStopped = onStop;

  audio.play().catch(clear);
  audio.onended = clear;
}

/** Coupe l'extrait en cours, s'il y en a un. Sans effet sinon. */
export function stopPreviewAudio() {
  current?.pause();
  if (current) clear();
}

/** Y a-t-il un extrait en cours ? */
export function isPreviewPlaying(): boolean {
  return current !== null;
}
