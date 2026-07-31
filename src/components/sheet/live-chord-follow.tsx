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
import {
  clampMsPerBeat, updateMsPerBeat, shouldAnticipate, MAX_UNCONFIRMED,
} from '@/lib/follow-tempo';

export interface FollowSeqItem {
  pos: string;         // data-pos de la cellule
  rowId: string;       // data-row-id de la mesure (défilement)
  sound: string;       // accord réellement entendu (forme + capo effectif)
  beats: number;       // durée de la cellule en temps (sert à l'horloge du suivi)
  repeatIndex: number; // passage courant de la mesure répétée (0-based)
  rowRepeat: number;   // nombre total de passages de la mesure
}

// Ligne active pendant le suivi, avec le passage de répétition courant.
export interface ActiveRow {
  rowId: string;
  repeatIndex: number;
  rowRepeat: number;
}

// Un bloc = suite de cellules consécutives que la détection ne distingue pas.
interface ChordGroup {
  sound: string;       // accord représentatif du bloc
  beats: number;       // durée cumulée du bloc en temps
  positions: string[]; // data-pos de toutes les cellules du bloc
  rowId: string;       // mesure de la première cellule (pour le défilement)
  rows: ActiveRow[];   // mesures du bloc + passage de répétition (badges)
}

const START_WINDOW = 4;    // blocs scrutés au tout début pour se caler
const NAVBAR_OFFSET = 104; // hauteur du bandeau fixe + marge de confort
const TICK_MS = 100;       // fréquence du suivi

function clearClass(cls: string) {
  document.querySelectorAll<HTMLElement>('.' + cls).forEach((el) => el.classList.remove(cls));
}

function buildGroups(seq: FollowSeqItem[]): ChordGroup[] {
  const groups: ChordGroup[] = [];
  const addRow = (g: ChordGroup, it: FollowSeqItem) => {
    const existing = g.rows.find((r) => r.rowId === it.rowId);
    // Si la même mesure apparaît à plusieurs passages dans le bloc (ligne d'un
    // seul accord répété), on garde le plus petit passage → badge non décrémenté.
    if (existing) existing.repeatIndex = Math.min(existing.repeatIndex, it.repeatIndex);
    else g.rows.push({ rowId: it.rowId, repeatIndex: it.repeatIndex, rowRepeat: it.rowRepeat });
  };
  for (const it of seq) {
    const last = groups[groups.length - 1];
    // Rejoint le bloc courant si l'accord ne s'en distingue pas (même famille+fond.).
    if (last && chordsMatch(last.sound, it.sound)) {
      last.positions.push(it.pos);
      last.beats += it.beats;
      addRow(last, it);
    } else {
      const g: ChordGroup = { sound: it.sound, beats: it.beats, positions: [it.pos], rowId: it.rowId, rows: [] };
      addRow(g, it);
      groups.push(g);
    }
  }
  return groups;
}

export function LiveChordFollow({
  sequence,
  bpm,
  onListeningChange,
  onActiveRowsChange,
  onAdvance,
  outputActive = false,
}: {
  sequence: FollowSeqItem[];
  // Tempo de la grille : amorce l'horloge avant d'avoir observé le joueur.
  bpm: number;
  onListeningChange?: (listening: boolean) => void;
  onActiveRowsChange?: (rows: ActiveRow[]) => void;
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

  // Horloge : tempo estimé du joueur, instant d'entrée dans le bloc courant, et
  // nombre d'avances consécutives décidées sans confirmation du micro.
  const msPerBeatRef = useRef(clampMsPerBeat(60000 / (bpm || 90)));
  // Le BPM passe par une ref : éditer le champ tempo pendant l'écoute ne doit pas
  // relancer l'effet de suivi, qui remettrait la position à zéro.
  const bpmRef = useRef(bpm);
  const enteredAtRef = useRef(0);
  const unconfirmedRef = useRef(0);
  // Le micro a-t-il entendu QUELQUE CHOSE depuis l'entrée dans le bloc courant ?
  // Sert à distinguer « le joueur s'est arrêté » de « on l'entend mais on n'a pas
  // su reconnaître l'accord » : seul le premier cas doit couper le suivi.
  const heardRef = useRef(false);

  const [autoStopped, setAutoStopped] = useState(false);
  const prevOutputRef = useRef(outputActive);

  useEffect(() => { groupsRef.current = buildGroups(sequence); posRef.current = -1; }, [sequence]);
  useEffect(() => { latestChordRef.current = chord; }, [chord]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
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
    enteredAtRef.current = 0;
    unconfirmedRef.current = 0;
    heardRef.current = false;
    msPerBeatRef.current = clampMsPerBeat(60000 / (bpmRef.current || 90));
    clearClass('chord-current');

    // 'heard'     : changement d'accord reconnu au micro → le suivi est calé.
    // 'unmatched' : on entend le joueur, mais rien ne correspond (accord mal joué,
    //               ou confusion classique du détecteur, par exemple une mineure
    //               prise pour sa relative majeure). On avance sans pénaliser.
    // 'silent'    : rien entendu du tout pendant tout le bloc → le joueur a décroché.
    type Outcome = 'heard' | 'unmatched' | 'silent';

    const goToGroup = (idx: number, outcome: Outcome) => {
      const groups = groupsRef.current;
      const now = Date.now();

      // Le tempo ne s'apprend que sur les changements réellement entendus : une
      // avance décidée par l'horloge ne doit pas nourrir sa propre estimation.
      if (outcome === 'heard' && posRef.current >= 0 && enteredAtRef.current > 0) {
        msPerBeatRef.current = updateMsPerBeat(
          msPerBeatRef.current, now - enteredAtRef.current, groups[posRef.current].beats,
        );
      }
      if (outcome === 'heard') unconfirmedRef.current = 0;
      else if (outcome === 'silent') unconfirmedRef.current += 1;
      // 'unmatched' : compteur inchangé, on ne coupe pas un joueur qui joue.

      enteredAtRef.current = now;
      heardRef.current = false;

      posRef.current = idx;
      clearClass('chord-current');
      for (const p of groups[idx].positions) {
        document
          .querySelector<HTMLElement>(`[data-pos="${CSS.escape(p)}"]`)
          ?.classList.add('chord-current');
      }
      onActiveRowsChange?.(groups[idx].rows);
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
      // `c` peut être vide (silence, attaque, note étouffée). On ne s'en sert que
      // pour les comparaisons : l'horloge, elle, doit tourner même sans rien
      // entendre, sinon un joueur qui s'arrête laisserait le suivi figé au lieu
      // d'être coupé.
      const c = latestChordRef.current;
      const groups = groupsRef.current;
      if (!groups.length) return;
      const gpos = posRef.current;

      // Pas encore calé : il faut une vraie détection pour se caler, l'horloge
      // n'a pas de point de départ tant qu'on ne sait pas où on en est.
      if (gpos < 0) {
        if (!c) return;
        for (let k = 0; k < START_WINDOW && k < groups.length; k++) {
          if (chordsMatch(c, groups[k].sound)) { goToGroup(k, 'heard'); return; }
        }
        return;
      }

      const next = groups[gpos + 1];

      if (c) {
        heardRef.current = true;
        // Toujours dans le bloc courant → rien à faire (déjà surligné en entier).
        if (chordsMatch(c, groups[gpos].sound)) return;
        // Changement d'accord entendu : avancer au bloc suivant (jamais de saut).
        if (next && chordsMatch(c, next.sound)) { goToGroup(gpos + 1, 'heard'); return; }
      }

      // Rien d'exploitable au micro. Si la durée attendue du bloc courant est
      // écoulée (au devancement près), on bascule quand même : l'accord a été mal
      // joué, mal détecté, ou le joueur s'est arrêté.
      if (!next) return;
      if (!shouldAnticipate(Date.now() - enteredAtRef.current, groups[gpos].beats, msPerBeatRef.current)) return;

      const silencieux = !heardRef.current;
      goToGroup(gpos + 1, silencieux ? 'silent' : 'unmatched');

      // On ne coupe que sur du vrai silence enchaîné : deux blocs sans que le micro
      // ait capté quoi que ce soit. Une suite d'accords entendus mais non reconnus
      // fait avancer le suivi sans jamais l'interrompre.
      if (unconfirmedRef.current >= MAX_UNCONFIRMED) stop();
    }, TICK_MS);

    return () => {
      clearInterval(id);
      clearClass('chord-current');
    };
  }, [listening, onActiveRowsChange, onAdvance, stop]);

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
