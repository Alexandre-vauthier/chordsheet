'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChordListener } from '@/lib/use-chord-listener';
import { INITIAL_DICTATION, stepDictation, type DictationState } from '@/lib/chord-dictation';

/**
 * Dictée d'accords au micro : le flux du détecteur devient une suite d'accords
 * discrets, un par cellule.
 *
 * La cadence de la machine à états est **la sienne**, pas celle des rendus React.
 * C'est indispensable : `chord` et `audible` sont des primitives, et pendant un
 * silence prolongé elles ne changent pas — un effet qui en dépendrait ne se
 * rejouerait jamais et les analyses de silence ne s'accumuleraient pas. On lit donc
 * la dernière valeur connue à intervalle fixe.
 */

/** Doit rester aligné sur la cadence d'analyse du détecteur (TICK_MS). */
const TICK_MS = 100;

export interface ChordDictationState {
  listening: boolean;
  /** Accord entendu, en attente du silence qui le validera. Vide sinon. */
  pending: string;
  audible: boolean;
  confidence: number;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useChordDictation(onCommit: (chord: string) => void): ChordDictationState {
  const listener = useChordListener();
  const [pending, setPending] = useState('');

  const machine = useRef<DictationState>(INITIAL_DICTATION);

  // La callback de validation change à chaque rendu de l'éditeur (elle capture la
  // grille). La garder dans une ref évite de relancer l'intervalle à chaque frappe.
  const commitRef = useRef(onCommit);
  useEffect(() => { commitRef.current = onCommit; }, [onCommit]);

  const latest = useRef({ chord: '', audible: false });
  useEffect(() => {
    latest.current = { chord: listener.chord, audible: listener.audible };
  }, [listener.chord, listener.audible]);

  useEffect(() => {
    if (!listener.listening) {
      machine.current = INITIAL_DICTATION;
      latest.current = { chord: '', audible: false };
      return;
    }

    const id = setInterval(() => {
      const { state, commit } = stepDictation(machine.current, latest.current);
      machine.current = state;
      setPending((previous) => (previous === state.pending ? previous : state.pending));
      if (commit) commitRef.current(commit);
    }, TICK_MS);

    return () => clearInterval(id);
  }, [listener.listening]);

  const listenerStop = listener.stop;
  const stop = useCallback(() => {
    listenerStop();
    machine.current = INITIAL_DICTATION;
  }, [listenerStop]);

  return {
    listening: listener.listening,
    // Dérivé plutôt que remis à zéro dans un effet : à l'arrêt, il n'y a par
    // construction plus rien en attente, inutile de le stocker pour le redire.
    pending: listener.listening ? pending : '',
    audible: listener.audible,
    confidence: listener.confidence,
    error: listener.error,
    start: listener.start,
    stop,
  };
}
