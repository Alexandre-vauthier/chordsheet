'use client';

// Suivi micro dans la consultation d'une grille : bouton REC → micro → on
// n'allume que la prochaine cellule attendue et on fait défiler.
// Piloté par un intervalle (et non par le seul changement d'accord) pour gérer
// les suites d'un MÊME accord : sur un changement d'accord on avance tout de
// suite ; sur une répétition du même accord on avance au tempo (durée de la
// cellule), ce qui resynchronise à chaque changement. Avance uniquement vers
// l'avant, ne recule jamais.
// L'écoute vit dans CE composant isolé (ses mises à jour ~10 Hz ne re-rendent pas
// le sheet-viewer) ; le surlignage se fait par le DOM (toggle de classe).

import { useEffect, useRef, useState } from 'react';
import { useChordListener } from '@/lib/use-chord-listener';
import { chordsMatch } from '@/lib/chord-match';

export interface FollowSeqItem {
  pos: string;        // data-pos de la cellule
  rowId: string;      // data-row-id de la mesure (défilement)
  sound: string;      // accord réellement entendu (forme + capo effectif)
  durationMs: number; // durée de la cellule au tempo courant
}

const START_WINDOW = 4;    // cellules scrutées au tout début pour se caler
const NAVBAR_OFFSET = 104; // hauteur du bandeau fixe + marge de confort
const TICK_MS = 100;       // fréquence du suivi
const DWELL_RATIO = 0.85;  // fraction de la durée d'une cellule avant d'avancer sur un accord répété

function clearClass(cls: string) {
  document.querySelectorAll<HTMLElement>('.' + cls).forEach((el) => el.classList.remove(cls));
}

export function LiveChordFollow({
  sequence,
  onListeningChange,
  grooveActive = false,
}: {
  sequence: FollowSeqItem[];
  onListeningChange?: (listening: boolean) => void;
  grooveActive?: boolean;
}) {
  // Annulation d'écho activée si la boîte à rythme joue (évite le repiquage).
  const { listening, chord, start, stop, error } = useChordListener(grooveActive);

  const seqRef = useRef<FollowSeqItem[]>(sequence);
  const latestChordRef = useRef('');
  const posRef = useRef(-1);
  const enteredAtRef = useRef(0);

  const [autoStopped, setAutoStopped] = useState(false);
  const prevGrooveRef = useRef(grooveActive);

  useEffect(() => { seqRef.current = sequence; posRef.current = -1; }, [sequence]);
  useEffect(() => { latestChordRef.current = chord; }, [chord]);
  useEffect(() => { onListeningChange?.(listening); }, [listening, onListeningChange]);

  // Si on active la boîte à rythme alors que le suivi tourne déjà, l'annulation
  // d'écho n'a pas été appliquée (elle est décidée au démarrage). On coupe donc
  // le suivi pour inviter à le relancer proprement (anti-repiquage).
  useEffect(() => {
    const grooveJustEnabled = grooveActive && !prevGrooveRef.current;
    prevGrooveRef.current = grooveActive;
    if (grooveJustEnabled && listening) {
      stop();
      setAutoStopped(true);
    }
  }, [grooveActive, listening, stop]);

  useEffect(() => {
    if (!listening) return;
    posRef.current = -1;
    enteredAtRef.current = 0;
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
        for (let k = 0; k < START_WINDOW && k < seq.length; k++) {
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

      // Changement d'accord : n'avancer QUE d'une cellule (jamais de saut).
      // Sinon un accord détecté par erreur (ex. Am7 contient un do majeur → C)
      // pourrait faire bondir vers un C beaucoup plus loin dans la grille.
      const next = seq[pos + 1];
      if (next && chordsMatch(c, next.sound)) advanceTo(pos + 1);
      // Sinon on attend (l'accord courant ou le suivant finira par revenir).
    }, TICK_MS);

    return () => {
      clearInterval(id);
      clearClass('chord-current');
    };
  }, [listening]);

  useEffect(() => () => clearClass('chord-current'), []);

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

      <div className="relative">
        {error && (
          <div className="absolute bottom-full mb-2 right-0 whitespace-nowrap text-xs text-red-500 bg-[var(--cream)] border border-[var(--line)] rounded-lg px-2 py-1 shadow">
            Micro indisponible
          </div>
        )}
        {autoStopped && !listening && (
          <div className="absolute bottom-full mb-2 right-0 max-w-[220px] text-xs text-[var(--ink-light)] bg-[var(--cream)] border border-[var(--line)] rounded-lg px-2 py-1 shadow">
            Suivi coupé : relance-le pour éviter que la boîte à rythme repique dans le micro.
          </div>
        )}
        <button
          onClick={listening ? stop : () => { setAutoStopped(false); start(); }}
          title={listening ? 'Arrêter le suivi micro' : 'Suivre au micro — surligne l’accord joué et fait défiler'}
          className={`flex items-center gap-2 h-12 px-4 rounded-full shadow-lg font-semibold text-white transition-colors ${
            listening ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--accent)] hover:bg-[#a83d25]'
          }`}
        >
          <span className={`w-3 h-3 rounded-full bg-white ${listening ? 'animate-pulse' : ''}`} />
          <span className="text-sm">{listening ? 'Stop' : 'Suivre'}</span>
        </button>
      </div>
    </div>
  );
}
