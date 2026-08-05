'use client';

import { getAudioContext } from './chord-audio';
import type { Voice } from './use-groove-box';

/**
 * Kits de batterie locaux, en plus du LM-2 chargé depuis le CDN.
 *
 * Un kit est un dossier de `public/drums/`, un fichier par voix, nommé comme la
 * voix : `kick.wav`, `snare.wav`, `hihatClosed.wav`… Rien à déclarer voix par
 * voix : on demande les quinze fichiers au chargement, et ce que le serveur ne
 * rend pas est simplement absent — cette voix retombe alors sur le LM-2.
 *
 * Ce fonctionnement rend une faute de frappe visible plutôt que silencieuse :
 * un `hithatOpen.wav` mal orthographié apparaît comme un charleston ouvert
 * manquant sur la page d'essai, au lieu de sonner autre chose sans prévenir.
 *
 * Les fichiers ne sont demandés qu'à la sélection du kit, et gardés en mémoire
 * ensuite : on ne télécharge rien tant que personne ne choisit un kit.
 */

export interface Kit {
  id: string;
  label: string;
}

/** Le LM-2 n'est pas dans cette liste : c'est le défaut, servi par `smplr`. */
export const KITS: Kit[] = [
  { id: 'classic', label: 'Classic' },
];

const MEMOIRE = 'alviena.kitBatterie';

type Etat = {
  buffers: Map<Voice, AudioBuffer>;
  absentes: Set<Voice>;
  chargement: Promise<void> | null;
};

const etats = new Map<string, Etat>();
let kitCourantId: string | null = null;

function etat(kitId: string): Etat {
  let e = etats.get(kitId);
  if (!e) { e = { buffers: new Map(), absentes: new Set(), chargement: null }; etats.set(kitId, e); }
  return e;
}

/**
 * Charge les échantillons d'un kit. Rejoue la même promesse si déjà en cours :
 * cliquer trois fois sur un pad pendant le chargement ne déclenche pas trois
 * téléchargements.
 */
export function chargerKit(kitId: string, voix: readonly Voice[]): Promise<void> {
  const e = etat(kitId);
  if (e.chargement) return e.chargement;

  const ctx = getAudioContext();
  e.chargement = Promise.all(
    voix.map(async (v) => {
      try {
        const rep = await fetch(`/drums/${kitId}/${v}.wav`);
        if (!rep.ok) { e.absentes.add(v); return; }
        e.buffers.set(v, await ctx.decodeAudioData(await rep.arrayBuffer()));
      } catch {
        // Fichier absent, illisible, ou hors ligne : la voix retombe sur le LM-2.
        e.absentes.add(v);
      }
    }),
  ).then(() => undefined);

  return e.chargement;
}

/** Échantillon local pour cette voix, ou `null` si le kit ne la couvre pas. */
export function echantillon(voice: Voice): AudioBuffer | null {
  if (!kitCourantId) return null;
  return etats.get(kitCourantId)?.buffers.get(voice) ?? null;
}

/** Voix que le kit courant couvre réellement, une fois chargé. */
export function voixDisponibles(kitId: string): Set<Voice> {
  return new Set(etats.get(kitId)?.buffers.keys() ?? []);
}

export function kitCourant(): string | null {
  return kitCourantId;
}

/** `null` remet le LM-2. Le choix survit au rechargement de la page. */
export function choisirKit(kitId: string | null): void {
  kitCourantId = kitId;
  try {
    if (kitId) localStorage.setItem(MEMOIRE, kitId);
    else localStorage.removeItem(MEMOIRE);
  } catch {
    // Navigation privée ou stockage refusé : le choix vaut pour la session.
  }
}

/**
 * Kit à employer faute de choix explicite.
 *
 * Ne mémorise rien : c'est un défaut, pas une décision de l'utilisateur. Un
 * visiteur de passage ne doit pas repartir avec un réglage inscrit dans son
 * navigateur, qu'il retrouverait le jour où il se crée un compte.
 *
 * Sans effet si un kit est déjà en place, choisi ou restauré : un défaut ne
 * remplace jamais une décision.
 */
export function kitParDefaut(kitId: string): boolean {
  if (kitCourantId) return false;
  if (!KITS.some((k) => k.id === kitId)) return false;
  kitCourantId = kitId;
  return true;
}

/** Restaure le choix mémorisé. À appeler une fois, côté navigateur. */
export function restaurerKit(): string | null {
  try {
    const id = localStorage.getItem(MEMOIRE);
    if (id && KITS.some((k) => k.id === id)) { kitCourantId = id; return id; }
  } catch {
    // idem
  }
  return null;
}
