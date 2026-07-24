'use client';

// Suivi micro dans la consultation d'une grille.
// Deux modes :
//  - Surlignage (par défaut, robuste) : allume toutes les cellules dont l'accord
//    correspond à ce qui est joué. Aucun suivi de position.
//  - Suivi (opt-in, plus fragile) : n'allume que la prochaine cellule attendue et
//    fait défiler la grille. Avance par correspondance vers l'avant (fenêtre de
//    look-ahead) pour tolérer une détection manquée ; ne recule jamais.
// L'écoute vit dans CE composant isolé (ses mises à jour ~10 Hz ne re-rendent pas
// le sheet-viewer) et le surlignage se fait par le DOM (toggle de classe).

import { useEffect, useRef, useState } from 'react';
import { useChordListener } from '@/lib/use-chord-listener';
import { chordsMatch } from '@/lib/chord-match';

export interface FollowSeqItem {
  pos: string;   // data-pos de la cellule
  rowId: string; // data-row-id de la mesure (défilement)
  sound: string; // accord réellement entendu (forme + capo effectif)
}

const LOOKAHEAD = 4;      // combien de cellules à venir on scrute pour avancer
const NAVBAR_OFFSET = 68; // hauteur navbar + marge pour le défilement

function clearClass(cls: string) {
  document.querySelectorAll<HTMLElement>('.' + cls).forEach((el) => el.classList.remove(cls));
}

export function LiveChordFollow({ sequence }: { sequence: FollowSeqItem[] }) {
  const { listening, chord, start, stop, error } = useChordListener();
  const [followMode, setFollowMode] = useState(false);

  const seqRef = useRef<FollowSeqItem[]>(sequence);
  const posRef = useRef(-1);

  // La séquence change (transposition, capo, minimisation) → on repart de zéro.
  useEffect(() => {
    seqRef.current = sequence;
    posRef.current = -1;
  }, [sequence]);

  // Réinitialiser la position à chaque (dé)activation de l'écoute ou du suivi.
  useEffect(() => {
    posRef.current = -1;
    clearClass('chord-detected');
    clearClass('chord-current');
  }, [listening, followMode]);

  useEffect(() => {
    if (!listening || !chord) {
      clearClass('chord-detected');
      clearClass('chord-current');
      return;
    }

    if (!followMode) {
      // Mode surlignage : toutes les cellules correspondantes
      clearClass('chord-current');
      document.querySelectorAll<HTMLElement>('[data-chord]').forEach((el) => {
        el.classList.toggle('chord-detected', chordsMatch(chord, el.dataset.chord || ''));
      });
      return;
    }

    // Mode suivi : avancer vers la prochaine cellule attendue
    clearClass('chord-detected');
    const seq = seqRef.current;
    const pos = posRef.current;
    // Rester en place si l'accord courant sonne encore
    if (pos >= 0 && chordsMatch(chord, seq[pos].sound)) return;
    for (let k = 1; k <= LOOKAHEAD; k++) {
      const idx = pos + k;
      if (idx >= seq.length) break;
      if (chordsMatch(chord, seq[idx].sound)) {
        posRef.current = idx;
        clearClass('chord-current');
        const cell = document.querySelector<HTMLElement>(`[data-pos="${CSS.escape(seq[idx].pos)}"]`);
        cell?.classList.add('chord-current');
        const row = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(seq[idx].rowId)}"]`);
        if (row) {
          window.scrollTo({
            top: window.scrollY + row.getBoundingClientRect().top - NAVBAR_OFFSET,
            behavior: 'smooth',
          });
        }
        return;
      }
    }
    // Aucun accord attendu à venir ne correspond → on attend (pas de recul)
  }, [chord, listening, followMode]);

  useEffect(
    () => () => {
      clearClass('chord-detected');
      clearClass('chord-current');
    },
    [],
  );

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-end gap-3 print:hidden">
      {listening && (
        <div className="px-3 py-2 rounded-xl bg-[var(--cream)] border border-[var(--line)] shadow-lg text-center min-w-[68px]">
          <div className="text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">Écoute</div>
          <div className="text-xl font-bold text-[var(--ink)] leading-tight min-h-[1.75rem]">
            {chord || '…'}
          </div>
        </div>
      )}

      <div className="flex flex-col items-end gap-2">
        {listening && (
          <button
            onClick={() => setFollowMode((v) => !v)}
            title={
              followMode
                ? 'Suivi de position actif — n’allume que l’accord attendu et fait défiler'
                : 'Surlignage — allume tous les accords joués (cliquer pour suivre la position)'
            }
            className={`text-xs px-3 py-1.5 rounded-full border shadow-sm transition-colors ${
              followMode
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : 'bg-[var(--cream)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)]'
            }`}
          >
            {followMode ? 'Suivi' : 'Surlignage'}
          </button>
        )}

        <div className="relative">
          {error && (
            <div className="absolute bottom-full mb-2 right-0 whitespace-nowrap text-xs text-red-500 bg-[var(--cream)] border border-[var(--line)] rounded-lg px-2 py-1 shadow">
              Micro indisponible
            </div>
          )}
          <button
            onClick={listening ? stop : start}
            title={listening ? 'Arrêter le suivi micro' : 'Suivre au micro — surligne l’accord joué'}
            className={`flex items-center gap-2 h-12 px-4 rounded-full shadow-lg font-semibold text-white transition-colors ${
              listening ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--accent)] hover:bg-[#a83d25]'
            }`}
          >
            <span className={`w-3 h-3 rounded-full bg-white ${listening ? 'animate-pulse' : ''}`} />
            <span className="text-sm">{listening ? 'Stop' : 'REC'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
