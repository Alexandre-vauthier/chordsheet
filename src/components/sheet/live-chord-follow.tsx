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

import { useEffect, useRef } from 'react';
import { suivreMesure } from '@/lib/follow-scroll';
import { useTranslations } from 'next-intl';
import { useChordListener } from '@/lib/use-chord-listener';
import { chordsMatch } from '@/lib/chord-match';

export interface FollowSeqItem {
  pos: string;         // data-pos de la cellule
  rowId: string;       // data-row-id de la mesure (défilement)
  sound: string;       // accord réellement entendu (forme + capo effectif)
  beats: number;       // durée de la cellule en temps
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
  onListeningChange,
  onActiveRowsChange,
}: {
  sequence: FollowSeqItem[];
  onListeningChange?: (listening: boolean) => void;
  onActiveRowsChange?: (rows: ActiveRow[]) => void;
}) {
  const t = useTranslations('LiveFollow');
  /**
   * Pendant le suivi, l'application ne sort aucun son : ni boîte à rythme, ni
   * accompagnement. Le micro n'a donc rien d'autre à entendre que le joueur.
   *
   * Faute de quoi il se repique lui-même : l'accompagnement entre dans le micro,
   * la détection y voit des accords qui ne sont pas ceux du joueur, et le suivi
   * part en avant. L'annulation d'écho aidait sans régler — elle est prévue pour
   * la parole, pas pour distinguer deux guitares. Rien ne permet, depuis un
   * navigateur, de savoir si l'utilisateur porte un casque : autant se taire.
   */
  const { listening, chord, start, stop, error } = useChordListener(false);

  const groupsRef = useRef<ChordGroup[]>(buildGroups(sequence));
  const latestChordRef = useRef('');
  const posRef = useRef(-1); // index du bloc courant
  // Dernière section traversée, pour ne recadrer qu'aux changements de section.
  const derniereSectionRef = useRef<string | null>(null);



  useEffect(() => { groupsRef.current = buildGroups(sequence); posRef.current = -1; }, [sequence]);
  useEffect(() => { latestChordRef.current = chord; }, [chord]);
  useEffect(() => { onListeningChange?.(listening); }, [listening, onListeningChange]);
  // Plus d'écoute → plus de ligne active (arrête le clignotement des répétitions).
  useEffect(() => { if (!listening) onActiveRowsChange?.([]); }, [listening, onActiveRowsChange]);

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
      onActiveRowsChange?.(groups[idx].rows);
      // Même règle que la lecture : on cadre la section, on ne suit la mesure que
      // lorsqu'elle sort de l'écran. Sans quoi une section répétée fait remonter la
      // grille sous les yeux du joueur, en plein morceau.
      suivreMesure(groups[idx].rowId, derniereSectionRef);
    };

    const id = setInterval(() => {
      // `c` peut être vide : silence, attaque, note étouffée, ou accord non
      // reconnu. Dans tous ces cas on reste où on est.
      const c = latestChordRef.current;
      const groups = groupsRef.current;
      if (!groups.length) return;
      const gpos = posRef.current;

      // Pas encore calé : il faut une vraie détection pour se caler.
      if (gpos < 0) {
        if (!c) return;
        for (let k = 0; k < START_WINDOW && k < groups.length; k++) {
          if (chordsMatch(c, groups[k].sound)) { goToGroup(k); return; }
        }
        return;
      }

      const next = groups[gpos + 1];

      if (c) {
        // Toujours dans le bloc courant → rien à faire (déjà surligné en entier).
        if (chordsMatch(c, groups[gpos].sound)) return;
        // Changement d'accord entendu : avancer au bloc suivant (jamais de saut).
        if (next && chordsMatch(c, next.sound)) { goToGroup(gpos + 1); return; }
      }

      /**
       * Rien de reconnaissable au micro : on attend, sans avancer.
       *
       * Le suivi rattrapait ici à l'horloge, dès la durée attendue écoulée, dès
       * lors qu'il entendait du son sans y reconnaître d'accord. L'intention
       * était de survivre à un accord mal joué ; l'effet, quand le micro entend
       * autre chose que la grille — l'accompagnement de l'application, un bruit
       * de pièce, une guitare mal captée — était de défiler tout le morceau
       * d'un bloc à l'autre sans jamais se recaler.
       *
       * Rester en place le temps que le joueur soit reconnu se voit et se
       * corrige ; galoper jusqu'à la fin de la grille, non.
       */
    }, TICK_MS);

    return () => {
      clearInterval(id);
      clearClass('chord-current');
    };
  }, [listening, onActiveRowsChange]);

  useEffect(() => () => clearClass('chord-current'), []);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-end gap-3 print:hidden">
      {listening && (
        <div className="px-3 py-2 rounded-xl bg-[var(--cream)] border border-[var(--line)] shadow-lg text-center min-w-[68px]">
          <div className="text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">{t('listening')}</div>
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
        {listening && (
          <div className="absolute bottom-full mb-2 right-0 max-w-[220px] text-xs text-[var(--ink-light)] bg-[var(--cream)] border border-[var(--line)] rounded-lg px-2 py-1 shadow">
            {t('muted')}
          </div>
        )}
        <button
          onClick={listening ? stop : start}
          title={listening ? t('stop') : t('start')}
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
