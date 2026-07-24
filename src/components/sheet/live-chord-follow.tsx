'use client';

// Suivi micro dans la consultation d'une grille.
// Deux modes :
//  - Surlignage (par défaut, robuste) : allume toutes les cellules dont l'accord
//    correspond à ce qui est joué. Aucun suivi de position.
//  - Suivi (opt-in, plus fragile) : n'allume que la prochaine cellule attendue et
//    fait défiler. Piloté par un intervalle (et non par le seul changement
//    d'accord) pour gérer les suites d'un MÊME accord : sur un changement
//    d'accord on avance tout de suite ; sur une répétition du même accord on
//    avance au tempo (durée de la cellule), ce qui resynchronise à chaque
//    changement. Avance uniquement vers l'avant, ne recule jamais.
// L'écoute vit dans CE composant isolé (ses mises à jour ~10 Hz ne re-rendent pas
// le sheet-viewer) et le surlignage se fait par le DOM (toggle de classe).

import { useEffect, useRef, useState } from 'react';
import { useChordListener } from '@/lib/use-chord-listener';
import { chordsMatch } from '@/lib/chord-match';

export interface FollowSeqItem {
  pos: string;      // data-pos de la cellule
  rowId: string;    // data-row-id de la mesure (défilement)
  sound: string;    // accord réellement entendu (forme + capo effectif)
  durationMs: number; // durée de la cellule au tempo courant
}

const LOOKAHEAD = 4;       // cellules à venir scrutées pour un changement d'accord
const NAVBAR_OFFSET = 104; // hauteur du bandeau fixe + marge de confort au-dessus de la cellule
const TICK_MS = 100;       // fréquence du suivi
const DWELL_RATIO = 0.85;  // fraction de la durée d'une cellule avant d'avancer sur un accord répété

function clearClass(cls: string) {
  document.querySelectorAll<HTMLElement>('.' + cls).forEach((el) => el.classList.remove(cls));
}

export function LiveChordFollow({ sequence }: { sequence: FollowSeqItem[] }) {
  const { listening, chord, start, stop, error } = useChordListener();
  const [followMode, setFollowMode] = useState(false);

  const seqRef = useRef<FollowSeqItem[]>(sequence);
  const latestChordRef = useRef('');
  const posRef = useRef(-1);
  const enteredAtRef = useRef(0);

  useEffect(() => { seqRef.current = sequence; posRef.current = -1; }, [sequence]);
  useEffect(() => { latestChordRef.current = chord; }, [chord]);

  // Mode surlignage (piloté par le changement d'accord) — allume toutes les
  // cellules correspondantes. Désactivé quand le mode suivi est actif.
  useEffect(() => {
    if (followMode) return;
    if (!listening || !chord) { clearClass('chord-detected'); return; }
    clearClass('chord-current');
    document.querySelectorAll<HTMLElement>('[data-chord]').forEach((el) => {
      el.classList.toggle('chord-detected', chordsMatch(chord, el.dataset.chord || ''));
    });
  }, [chord, listening, followMode]);

  // Mode suivi (piloté par intervalle) — avance dans la grille.
  useEffect(() => {
    if (!listening || !followMode) return;
    posRef.current = -1;
    enteredAtRef.current = 0;
    clearClass('chord-detected');
    clearClass('chord-current');

    const advanceTo = (idx: number) => {
      const seq = seqRef.current;
      posRef.current = idx;
      enteredAtRef.current = performance.now();
      clearClass('chord-current');
      document
        .querySelector<HTMLElement>(`[data-pos="${CSS.escape(seq[idx].pos)}"]`)
        ?.classList.add('chord-current');
      const row = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(seq[idx].rowId)}"]`);
      if (row) {
        window.scrollTo({
          top: window.scrollY + row.getBoundingClientRect().top - NAVBAR_OFFSET,
          behavior: 'smooth',
        });
      }
    };

    const id = setInterval(() => {
      const c = latestChordRef.current;
      if (!c) return;
      const seq = seqRef.current;
      if (!seq.length) return;
      const pos = posRef.current;

      // Pas encore calé : chercher le premier accord correspondant au début.
      if (pos < 0) {
        for (let k = 0; k < LOOKAHEAD && k < seq.length; k++) {
          if (chordsMatch(c, seq[k].sound)) { advanceTo(k); return; }
        }
        return;
      }

      // L'accord courant sonne encore.
      if (chordsMatch(c, seq[pos].sound)) {
        const next = seq[pos + 1];
        // Suite du même accord : avancer au tempo (durée de la cellule écoulée).
        if (next && chordsMatch(c, next.sound) &&
            performance.now() - enteredAtRef.current >= seq[pos].durationMs * DWELL_RATIO) {
          advanceTo(pos + 1);
        }
        return;
      }

      // Changement d'accord : avancer vers la prochaine cellule qui correspond.
      for (let k = 1; k <= LOOKAHEAD; k++) {
        const idx = pos + k;
        if (idx >= seq.length) break;
        if (chordsMatch(c, seq[idx].sound)) { advanceTo(idx); return; }
      }
      // Rien devant ne correspond → on attend (pas de recul).
    }, TICK_MS);

    return () => {
      clearInterval(id);
      clearClass('chord-current');
    };
  }, [listening, followMode]);

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
