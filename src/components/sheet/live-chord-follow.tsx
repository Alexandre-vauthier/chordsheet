'use client';

// Suivi micro dans la consultation d'une grille : bouton Suivre → micro → on
// surligne l'accord courant et on fait défiler.
//
// Principe : on regroupe les cellules consécutives d'un MÊME accord (ce que la
// détection ne sait de toute façon pas distinguer) en un seul bloc. On surligne
// tout le bloc courant et on n'avance qu'au bloc suivant lors d'un vrai
// changement d'accord. Résultat : une suite F F F F ne « dérive » plus (elle est
// surlignée en entier) et le passage à l'accord suivant est net et précis.
// Avance uniquement vers l'avant, ne recule jamais, ne saute jamais un bloc.
//
// L'écoute vit dans CE composant isolé (ses mises à jour ~10 Hz ne re-rendent pas
// le sheet-viewer) ; le surlignage se fait par le DOM (toggle de classe).

import { useEffect, useRef, useState } from 'react';
import { useChordListener } from '@/lib/use-chord-listener';
import { chordsMatch } from '@/lib/chord-match';

export interface FollowSeqItem {
  pos: string;   // data-pos de la cellule
  rowId: string; // data-row-id de la mesure (défilement)
  sound: string; // accord réellement entendu (forme + capo effectif)
}

// Un bloc = suite de cellules consécutives que la détection ne distingue pas.
interface ChordGroup {
  sound: string;      // accord représentatif du bloc
  positions: string[]; // data-pos de toutes les cellules du bloc
  rowId: string;      // mesure de la première cellule (pour le défilement)
  rowIds: string[];   // toutes les mesures du bloc (pour le clignotement des répétitions)
}

const START_WINDOW = 4;    // blocs scrutés au tout début pour se caler
const NAVBAR_OFFSET = 104; // hauteur du bandeau fixe + marge de confort
const TICK_MS = 100;       // fréquence du suivi

function clearClass(cls: string) {
  document.querySelectorAll<HTMLElement>('.' + cls).forEach((el) => el.classList.remove(cls));
}

function buildGroups(seq: FollowSeqItem[]): ChordGroup[] {
  const groups: ChordGroup[] = [];
  for (const it of seq) {
    const last = groups[groups.length - 1];
    // Rejoint le bloc courant si l'accord ne s'en distingue pas (même famille+fond.).
    if (last && chordsMatch(last.sound, it.sound)) {
      last.positions.push(it.pos);
      if (!last.rowIds.includes(it.rowId)) last.rowIds.push(it.rowId);
    } else {
      groups.push({ sound: it.sound, positions: [it.pos], rowId: it.rowId, rowIds: [it.rowId] });
    }
  }
  return groups;
}

export function LiveChordFollow({
  sequence,
  onListeningChange,
  onActiveRowsChange,
  onAdvance,
  outputActive = false,
}: {
  sequence: FollowSeqItem[];
  onListeningChange?: (listening: boolean) => void;
  onActiveRowsChange?: (rowIds: string[]) => void;
  // Appelé au passage à un nouveau bloc, avec l'accord entendu (pour jouer un
  // accompagnement suivant la position détectée).
  onAdvance?: (sound: string) => void;
  // Vrai si un son sort des enceintes pendant l'écoute (boîte à rythme et/ou
  // accompagnement) : active l'annulation d'écho pour éviter le repiquage.
  outputActive?: boolean;
}) {
  const { listening, chord, start, stop, error } = useChordListener(outputActive);

  const groupsRef = useRef<ChordGroup[]>(buildGroups(sequence));
  const latestChordRef = useRef('');
  const posRef = useRef(-1); // index du bloc courant

  const [autoStopped, setAutoStopped] = useState(false);
  const prevOutputRef = useRef(outputActive);

  useEffect(() => { groupsRef.current = buildGroups(sequence); posRef.current = -1; }, [sequence]);
  useEffect(() => { latestChordRef.current = chord; }, [chord]);
  useEffect(() => { onListeningChange?.(listening); }, [listening, onListeningChange]);
  // Plus d'écoute → plus de ligne active (arrête le clignotement des répétitions).
  useEffect(() => { if (!listening) onActiveRowsChange?.([]); }, [listening, onActiveRowsChange]);

  // Si un son (boîte à rythme ou accompagnement) est activé alors que le suivi
  // tourne déjà, l'annulation d'écho n'a pas été appliquée (décidée au démarrage).
  // On coupe donc le suivi pour inviter à le relancer proprement (anti-repiquage).
  useEffect(() => {
    const outputJustEnabled = outputActive && !prevOutputRef.current;
    prevOutputRef.current = outputActive;
    if (outputJustEnabled && listening) {
      stop();
      setAutoStopped(true);
    }
  }, [outputActive, listening, stop]);

  useEffect(() => {
    if (!listening) return;
    posRef.current = -1;
    clearClass('chord-current');

    const goToGroup = (idx: number) => {
      const groups = groupsRef.current;
      posRef.current = idx;
      clearClass('chord-current');
      for (const p of groups[idx].positions) {
        document
          .querySelector<HTMLElement>(`[data-pos="${CSS.escape(p)}"]`)
          ?.classList.add('chord-current');
      }
      onActiveRowsChange?.(groups[idx].rowIds);
      onAdvance?.(groups[idx].sound);
      const row = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(groups[idx].rowId)}"]`);
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
      const groups = groupsRef.current;
      if (!groups.length) return;
      const gpos = posRef.current;

      // Pas encore calé : chercher le premier bloc correspondant au début.
      if (gpos < 0) {
        for (let k = 0; k < START_WINDOW && k < groups.length; k++) {
          if (chordsMatch(c, groups[k].sound)) { goToGroup(k); return; }
        }
        return;
      }

      // Toujours dans le bloc courant → rien à faire (déjà surligné en entier).
      if (chordsMatch(c, groups[gpos].sound)) return;

      // Changement d'accord : avancer au bloc suivant s'il correspond (jamais de saut).
      const next = groups[gpos + 1];
      if (next && chordsMatch(c, next.sound)) goToGroup(gpos + 1);
      // Sinon on attend (l'accord courant ou le suivant finira par revenir).
    }, TICK_MS);

    return () => {
      clearInterval(id);
      clearClass('chord-current');
    };
  }, [listening, onActiveRowsChange, onAdvance]);

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
            Suivi coupé : relance-le pour éviter que le son joué repique dans le micro.
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
