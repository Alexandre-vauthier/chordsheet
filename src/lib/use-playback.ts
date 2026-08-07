import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Section, Cell, InstrumentId, StringChord, PianoChord, StructureEntry } from '@/types';
// Réexport : PlayStyle et ACCOMPANIMENT_INSTRUMENTS vivent dans accompaniment.ts
// (sans dépendance React), les appelants historiques les importent d'ici.
import { ACCOMPANIMENT_INSTRUMENTS, type PlayStyle } from '@/lib/accompaniment';
export { ACCOMPANIMENT_INSTRUMENTS, type PlayStyle };
import { parseChordInput } from '@/lib/chord-data';
import { chordVariants } from '@/lib/use-chord-variants';
import { playChord, playArpeggio, playMetronomeTick, getAudioContext } from '@/lib/chord-audio';

/**
 * Ecart au-dela duquel on considere que le contexte audio a ete suspendu.
 *
 * Une derive ordinaire de `setTimeout` se compte en dizaines de millisecondes ; deux
 * secondes de retard ne s'expliquent que par une horloge figee.
 */
const SUSPENSION_THRESHOLD_S = 2;

/**
 * De combien le minuteur se réveille avant l'instant qu'il vise.
 *
 * Assez pour absorber son propre retard, assez peu pour qu'un arrêt reste
 * immédiat à l'oreille. La boîte à rythme regarde 100 ms devant elle, on se tient
 * dans le même ordre de grandeur.
 */
const AVANCE_S = 0.06;
import { useLibraryChords } from '@/lib/library-chords-context';
import { deroulerStructure, positionCellule, positionMesure, type Bloc } from '@/lib/sheet-structure';

export interface PlayStep {
  sectionId: string;
  /**
   * Rang du passage de cette section dans le morceau déroulé.
   *
   * Sans lui, la vue ne peut pas savoir *lequel* des trois couplets est en train
   * d'être joué : elle les surlignait tous les trois en même temps.
   */
  occurrence: number;
  rowIndex: number;
  cellIndex: number;
  durationMs: number;
  rowRepeatIndex: number;
  /**
   * Temps par mesure de la section jouée.
   *
   * Le métronome le lisait sur la **première** section de la grille et le gardait
   * pour tout le morceau : sur une grille qui change de métrique en cours de
   * route, il continuait de compter en trois là où la musique était en quatre.
   */
  beatsPerMeasure: number;
  /**
   * Passage en cours dans la répétition de la section (0 pour le premier).
   *
   * La mesure avait son compteur, pas la section : rien ne permettait de dire à la
   * lecture combien de passages restaient sur un « ×3 » de section.
   */
  sectionRepeatIndex: number;
}

/** Un temps du métronome : son instant sur l'horloge audio, et s'il ouvre la mesure. */
export interface Battement {
  instant: number;
  premier: boolean;
}

/**
 * Le calendrier des temps, déduit des mesures qu'on va jouer.
 *
 * Une mesure, ici, est une instance de ligne : la même ligne répétée deux fois en
 * compte deux. On additionne les durées de ses cellules, on en déduit combien de
 * temps elle dure, et on pose son premier temps sur son propre instant de départ.
 *
 * C'est ce ré-ancrage à chaque mesure qui rend le décompte juste sans qu'aucun
 * compteur n'ait à connaître la métrique : une section en trois donne des mesures
 * de trois temps, la suivante en quatre en donne de quatre, et l'accent tombe à
 * chaque fois sur le premier temps parce qu'il est calculé depuis lui.
 */
export function construireBattements(steps: PlayStep[], debut: number, beatMs: number): Battement[] {
  if (beatMs <= 0) return [];
  const cle = (s: PlayStep) =>
    `${s.sectionId}|${s.occurrence}|${s.sectionRepeatIndex}|${s.rowIndex}|${s.rowRepeatIndex}`;

  const battements: Battement[] = [];
  let instant = debut;
  let i = 0;
  while (i < steps.length) {
    const courante = cle(steps[i]);
    let dureeMs = 0;
    while (i < steps.length && cle(steps[i]) === courante) dureeMs += steps[i++].durationMs;
    // Au moins un temps : une mesure dont les cellules ne remplissent pas la
    // métrique garde son premier temps plutôt que de disparaître du décompte.
    const nombre = Math.max(1, Math.round(dureeMs / beatMs));
    for (let b = 0; b < nombre; b++) {
      battements.push({ instant: instant + (b * beatMs) / 1000, premier: b === 0 });
    }
    instant += dureeMs / 1000;
  }
  return battements;
}

export function parseTempo(tempoStr: string | undefined): number {
  if (!tempoStr) return 90;
  const match = tempoStr.match(/(\d+)/);
  if (!match) return 90;
  return Math.max(40, Math.min(300, parseInt(match[1])));
}

// Span = nombre de mesures (1 = 1 mesure, 0.5 = demi-mesure, etc.)
// Durée = span × beatsPerMeasure × beatMs (3 en ternaire, 4 en binaire).
// Exportée : c'est elle qui fixe l'ordre de lecture et les compteurs de passage,
// autant pouvoir la vérifier sans passer par un rendu React.
export function buildSequence(blocs: Bloc[], beatMs: number): PlayStep[] {
  const steps: PlayStep[] = [];
  for (const bloc of blocs) {
    const section = bloc.section;
    const bpm = section.beatsPerMeasure || 4;
    for (let rep = 0; rep < bloc.repeat; rep++) {
      for (let r = 0; r < section.rows.length; r++) {
        const rowRepeat = section.rowRepeats?.[r] ?? 1;
        for (let rr = 0; rr < rowRepeat; rr++) {
          const row = section.rows[r];
          // Trouver le dernier index avec un accord non vide
          let lastNonEmpty = row.length - 1;
          while (lastNonEmpty > 0 && !row[lastNonEmpty].chord.trim()) {
            lastNonEmpty--;
          }
          for (let c = 0; c <= lastNonEmpty; c++) {
            steps.push({
              sectionId: section.id,
              occurrence: bloc.occurrence,
              rowIndex: r,
              cellIndex: c,
              durationMs: row[c].span * bpm * beatMs,
              beatsPerMeasure: bpm,
              rowRepeatIndex: rr,
              sectionRepeatIndex: rep,
            });
          }
        }
      }
    }
  }
  return steps;
}

export interface ChordSeqItem {
  sectionId: string;
  rowIndex: number;
  cellIndex: number;
  rowId: string;       // data-row-id de la mesure (pour le défilement)
  pos: string;         // data-pos de la cellule (pour le surlignage ciblé)
  chord: string;
  span: number;        // durée en mesures (pour calculer la durée d'une cellule)
  beats: number;       // temps par mesure de la section (3 ou 4)
  repeatIndex: number; // passage courant de la mesure répétée (0-based)
  rowRepeat: number;   // nombre total de passages de la mesure
}

// Séquence ordonnée des cellules porteuses d'accord, dans l'ordre de lecture
// (sections, répétitions de section puis de mesure). Base du suivi micro.
export function buildChordSequence(blocs: Bloc[]): ChordSeqItem[] {
  const seq: ChordSeqItem[] = [];
  for (const bloc of blocs) {
    const section = bloc.section;
    for (let rep = 0; rep < bloc.repeat; rep++) {
      for (let r = 0; r < section.rows.length; r++) {
        const rowRepeat = section.rowRepeats?.[r] ?? 1;
        for (let rr = 0; rr < rowRepeat; rr++) {
          const row = section.rows[r];
          for (let c = 0; c < row.length; c++) {
            const chord = row[c].chord?.trim();
            if (!chord) continue;
            seq.push({
              sectionId: section.id,
              rowIndex: r,
              cellIndex: c,
              rowId: positionMesure(bloc, r),
              pos: positionCellule(bloc, r, c),
              chord,
              span: row[c].span,
              beats: section.beatsPerMeasure || 4,
              repeatIndex: rr,
              rowRepeat,
            });
          }
        }
      }
    }
  }
  return seq;
}

type TempoUnit = 'quarter' | 'eighth';

const TEMPO_UNIT_FACTOR: Record<TempoUnit, number> = {
  quarter: 1,
  eighth: 0.5,
};

/**
 * Le tempo de la boîte à rythme, déduit de celui de la grille.
 *
 * Les motifs sont écrits en doubles croches sur deux mesures : une mesure de
 * batterie doit donc durer exactement une mesure d'accords. D'où deux choses.
 *
 * **L'unité de tempo compte.** Une grille notée à la croche fait battre les
 * accords deux fois plus vite que son chiffre ne le dit ; lire le chiffre nu
 * faisait jouer la boîte à la moitié de leur vitesse.
 *
 * **Pas de demi-tempo.** Un demi-tempo appliqué à l'horloge ne donne pas un
 * half-time : il double la durée de la mesure de batterie, si bien que la phrase
 * de deux mesures du motif s'étale sur quatre mesures d'accords. Les cymbales, les
 * charlestons ouverts de fin de phrase et les relances tombent alors de plus en
 * plus loin de leur place. C'était la règle de mai 2026 pour les tempos rapides ;
 * elle visait la mitraille de charleston, mais elle réglait une question de motif
 * avec une horloge. Un motif trop dense se remplace par un motif plus aéré, pas
 * par une horloge qui ralentit.
 */
export function grooveBpmFor(tempo: string | undefined, tempoUnit: TempoUnit | undefined): number {
  return parseTempo(tempo) / TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
}


export interface PlaybackVoice {
  id: InstrumentId;
  style: PlayStyle;
}

// Instruments d'accompagnement proposés (ceux qui ont un son jouable).
// Partagé entre le lecteur (sheet-viewer) et l'éditeur (config de lecture par défaut).


interface UsePlaybackOptions {
  sections: Section[];
  /**
   * Ordre d'enchaînement du morceau. Absente, les sections se lisent dans leur
   * ordre : la lecture doit dérouler la même chose que ce que la page affiche,
   * sinon on entend un couplet que l'écran ne montre pas.
   */
  structure?: StructureEntry[];
  tempo: string | undefined;
  tempoUnit?: TempoUnit;
  instrumentId: InstrumentId;
  // Voix jouées simultanément à chaque accord (accompagnement), chacune avec son
  // style (plaqué / arpège). Défaut : le seul instrument principal, plaqué.
  playbackInstruments?: PlaybackVoice[];
  customChords?: Record<string, unknown>;
  selectedChords?: Record<string, StringChord | PianoChord>;
  metronomeEnabled?: boolean;
  chordsEnabled?: boolean;
  capo?: number;
}

export function usePlayback({ sections, structure, tempo, tempoUnit, instrumentId, playbackInstruments, customChords, selectedChords, metronomeEnabled, chordsEnabled = true, capo = 0 }: UsePlaybackOptions) {
  const { overrides, additions } = useLibraryChords();
  // Le déroulé, une fois pour toutes : la lecture ne connaît que des blocs.
  const blocs = useMemo(() => deroulerStructure(sections, structure), [sections, structure]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState<PlayStep | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Le minuteur du surlignage, décalé de l'avance pour tomber avec le son. */
  const visuelRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * L'instant, sur l'horloge audio, où la lecture en cours a commencé.
   *
   * Partagé avec la boîte à rythme : elle se cale dessus au lieu de démarrer
   * quand son effet React s'exécute, ce qui arrivait après le premier accord,
   * d'un écart qui changeait à chaque lecture.
   */
  const debutRef = useRef<number | null>(null);
  const metronomeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs pour que le useEffect métronome accède aux valeurs courantes
  const factor = TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
  const beatMsRef = useRef<number>((60 / parseTempo(tempo)) * 1000 * factor);
  /**
   * Les temps du métronome, déduits des mesures elles-mêmes (voir
   * `construireBattements`), et le rang du prochain à programmer.
   *
   * Le métronome comptait auparavant pour son compte : un `beat` incrémenté
   * modulo une métrique tenue à jour à part, et une ligne de temps ancrée à
   * l'instant où son effet React s'exécutait — donc quelques dizaines de
   * millisecondes après le premier accord, d'un écart qui changeait à chaque
   * lecture. Il ne pouvait pas non plus suivre un changement de métrique : le
   * drapeau qui demandait de repartir à un était posé soixante millisecondes
   * avant le son, alors que la boucle programmait cent millisecondes à l'avance,
   * si bien que la remise à un tombait un temps trop tard une fois sur deux.
   *
   * Il ne compte plus. Chaque mesure porte l'instant de son premier temps, et le
   * métronome ne fait que jouer ce calendrier : même horloge et même source que
   * les accords, ré-ancré à chaque mesure, juste en trois comme en quatre.
   */
  const battementsRef = useRef<Battement[]>([]);
  const battementRef = useRef(0);
  /** Décalage accumulé par les reprises après suspension du contexte audio. */
  const decalageRef = useRef(0);
  const chordsEnabledRef = useRef(chordsEnabled);
  // Voix d'accompagnement, lues sans redémarrer la lecture en cours.
  const playbackVoicesRef = useRef<PlaybackVoice[]>(playbackInstruments ?? [{ id: instrumentId, style: 'block' }]);
  useEffect(() => {
    playbackVoicesRef.current = playbackInstruments ?? [{ id: instrumentId, style: 'block' }];
  }, [playbackInstruments, instrumentId]);

  // Mettre à jour les refs quand tempo/tempoUnit/sections changent
  useEffect(() => {
    beatMsRef.current = (60 / parseTempo(tempo)) * 1000 * TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
  }, [tempo, tempoUnit]);

  // Refs pour que les ticks accèdent aux flags sans redémarrer
  const metronomeEnabledRef = useRef(metronomeEnabled ?? false);
  useEffect(() => {
    metronomeEnabledRef.current = metronomeEnabled ?? false;
  }, [metronomeEnabled]);
  useEffect(() => {
    chordsEnabledRef.current = chordsEnabled;
  }, [chordsEnabled]);

  // Le métronome tourne dès que isPlaying — le toggle ne fait que mute/unmute.
  // Il ne connaît ni tempo ni métrique : il programme les instants que
  // `runSteps` a posés, avec le même look-ahead de 100 ms que la boîte à rythme.
  useEffect(() => {
    if (metronomeRef.current) {
      clearInterval(metronomeRef.current);
      metronomeRef.current = null;
    }
    if (isPlaying) {
      const tick = () => {
        // Contexte redemande a chaque tick, pour la meme raison que la lecture :
        // suspendu, son horloge se fige et la boucle ne planifierait plus rien.
        const ctx = getAudioContext();
        const liste = battementsRef.current;
        while (battementRef.current < liste.length) {
          const battement = liste[battementRef.current];
          const instant = battement.instant + decalageRef.current;
          if (instant > ctx.currentTime + 0.1) break;
          // Un temps dépassé de plus d'un demi-temps ne se rattrape pas : le
          // jouer en retard s'entendrait plus que son absence.
          const retard = ctx.currentTime - instant;
          if (metronomeEnabledRef.current && retard < beatMsRef.current / 2000) {
            playMetronomeTick(battement.premier, Math.max(instant, ctx.currentTime));
          }
          battementRef.current++;
        }
      };
      tick();
      metronomeRef.current = setInterval(tick, 25);
    }
    return () => {
      if (metronomeRef.current) {
        clearInterval(metronomeRef.current);
        metronomeRef.current = null;
      }
    };
  }, [isPlaying]);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    // Le surlignage programmé pour l'instant à venir : sans cela il se posait
    // après l'arrêt, sur une case qui ne sonnera jamais.
    if (visuelRef.current) clearTimeout(visuelRef.current);
    visuelRef.current = null;
    debutRef.current = null;
    setIsPlaying(false);
    setActiveStep(null);
  }, []);

  // Stop on unmount (navigation)
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (metronomeRef.current) clearInterval(metronomeRef.current);
    };
  }, []);

  const resolveChord = useCallback((rawChordName: string, inst: InstrumentId): StringChord | PianoChord | undefined => {
    const chordName = parseChordInput(rawChordName).chord;
    const selected = selectedChords?.[chordName] ?? selectedChords?.[rawChordName];
    const customKey = `${chordName.toLowerCase()}-${inst}`;
    const custom = customChords?.[customKey];
    /**
     * Ce qu'on entend doit être ce que la grille montre.
     *
     * Cette résolution avait sa propre copie de l'ordre des variantes, et elle
     * préférait un **ajout** de la bibliothèque au doigté de référence — alors
     * qu'un ajout vient en plus, pas à la place. Le fa de guitare s'entendait donc
     * une octave au-dessus de celui affiché. L'ordre vit maintenant dans
     * `chordVariants`, que la grille utilise aussi.
     *
     * Restent prioritaires, dans cet ordre : la variante que l'utilisateur navigue,
     * puis celle que l'auteur a fixée dans sa grille.
     */
    return (
      selected ??
      (custom as StringChord | PianoChord | undefined) ??
      chordVariants(chordName, inst, overrides, additions)[0]
    );
  }, [customChords, selectedChords, overrides, additions]);

  const runSteps = useCallback((steps: PlayStep[], getCellFn: (step: PlayStep) => Cell | undefined) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (visuelRef.current) clearTimeout(visuelRef.current);
    if (!steps.length) return;
    setIsPlaying(true);
    /**
     * Ligne de temps sur l'horloge audio, et son avance.
     *
     * Chaque pas vise un instant absolu, recalculé depuis `ctx.currentTime` : la
     * dérive ne s'accumule pas. Mais viser ne suffisait pas — l'accord était
     * *joué* au réveil du minuteur, donc avec son retard. Le minuteur se réveille
     * maintenant en avance et **programme** l'accord à l'instant exact, comme la
     * boîte à rythme. Le surlignage, lui, attend l'instant : il ne doit pas
     * devancer ce qu'on entend.
     */
    const debut = getAudioContext().currentTime + AVANCE_S;
    debutRef.current = debut;
    // Le calendrier du métronome, posé avant que sa boucle ne tourne. Remis à
    // zéro ici et non dans son effet : lancer une autre section pendant qu'on
    // lit ne change pas `isPlaying`, l'effet ne se rejouerait donc pas.
    battementsRef.current = construireBattements(steps, debut, beatMsRef.current);
    battementRef.current = 0;
    decalageRef.current = 0;
    let nextTime = debut;
    let i = 0;
    const advance = () => {
      if (i >= steps.length) { setIsPlaying(false); setActiveStep(null); return; }

      /**
       * Le contexte est redemande a chaque pas, et non capture une fois.
       *
       * Le navigateur le suspend sans prevenir — onglet en arriere-plan, veille de la
       * machine — et `currentTime` se fige alors. La ligne de temps, elle, continue
       * d'avancer : l'ecart grandit, les delais deviennent enormes et la lecture
       * s'arrete sans un son, sans que rien ne le signale. Redemander le contexte le
       * reveille (`getAudioContext` appelle `resume`).
       */
      const ctx = getAudioContext();

      // Retard trop grand pour etre du a une derive ordinaire : le contexte a ete
      // suspendu. On rattache la ligne de temps a l'horloge plutot que de rattraper
      // un retard qui prendrait autant de temps que la pause elle-meme.
      const retard = nextTime - ctx.currentTime;
      if (retard > SUSPENSION_THRESHOLD_S) {
        // Le métronome suit le même saut, sans quoi il rejouerait d'un coup tous
        // les temps de la pause — ou les tairait, ce qui revient au même.
        decalageRef.current += ctx.currentTime - nextTime;
        nextTime = ctx.currentTime;
      }

      const step = steps[i];
      const instant = nextTime;

      // Le surlignage à l'instant du son, pas à celui du réveil.
      if (visuelRef.current) clearTimeout(visuelRef.current);
      const attente = Math.max(0, (instant - ctx.currentTime) * 1000);
      if (attente < 4) setActiveStep(step);
      else visuelRef.current = setTimeout(() => setActiveStep(step), attente);

      const cell = getCellFn(step);
      if (cell?.chord && chordsEnabledRef.current) {
        // Jouer l'accord sur chaque voix d'accompagnement (voix indépendantes),
        // plaqué ou en arpège calé au tempo (croches sur la durée de la cellule).
        const eighthMs = beatMsRef.current / 2;
        for (const voice of playbackVoicesRef.current) {
          const chordData = resolveChord(cell.chord, voice.id);
          if (!chordData) continue;
          if (voice.style === 'arpeggio') {
            const steps = Math.max(1, Math.round(step.durationMs / eighthMs));
            playArpeggio(chordData, voice.id, capo, eighthMs, steps, instant);
          } else {
            playChord(chordData, voice.id, capo, instant);
          }
        }
      }
      i++;
      // Prochain pas calé sur l'horloge audio, avec correction de la dérive.
      nextTime += step.durationMs / 1000;
      // Réveil en avance : il faut le temps de programmer, pas de jouer.
      const delayMs = Math.max(0, (nextTime - AVANCE_S - ctx.currentTime) * 1000);
      timeoutRef.current = setTimeout(advance, delayMs);
    };
    advance();
  }, [resolveChord, capo]);

  const playSequence = useCallback((targetBlocs: Bloc[]) => {
    const bpm = parseTempo(tempo);
    const factor = TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
    const beatMs = (60 / bpm) * 1000 * factor;
    const steps = buildSequence(targetBlocs, beatMs);
    runSteps(steps, (step) =>
      targetBlocs.find((b) => b.section.id === step.sectionId)?.section.rows[step.rowIndex]?.[step.cellIndex]
    );
  }, [tempo, tempoUnit, runSteps]);

  // `occurrence` : quel passage de la section on écoute, quand la même section
  // apparaît plusieurs fois dans le déroulé. C'est lui qui décide de la mesure
  // surlignée à l'écran.
  const playRow = useCallback((sectionId: string, rowIndex: number, occurrence = 0) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    const bpm = parseTempo(tempo);
    const factor = TEMPO_UNIT_FACTOR[tempoUnit ?? 'quarter'];
    const beatMs = (60 / bpm) * 1000 * factor;
    const bpmeasure = section.beatsPerMeasure || 4;
    const rowRepeat = section.rowRepeats?.[rowIndex] ?? 1;
    const row = section.rows[rowIndex];
    if (!row) return;
    const steps: PlayStep[] = [];
    for (let rr = 0; rr < rowRepeat; rr++) {
      let lastNonEmpty = row.length - 1;
      while (lastNonEmpty > 0 && !row[lastNonEmpty].chord.trim()) lastNonEmpty--;
      for (let c = 0; c <= lastNonEmpty; c++) {
        // Lecture d'une seule mesure : la section n'est pas répétée, on est donc
        // toujours au premier passage.
        steps.push({ sectionId, occurrence, rowIndex, cellIndex: c, durationMs: row[c].span * bpmeasure * beatMs, beatsPerMeasure: bpmeasure, rowRepeatIndex: rr, sectionRepeatIndex: 0 });
      }
    }
    runSteps(steps, (step) => section.rows[step.rowIndex]?.[step.cellIndex]);
  }, [sections, tempo, tempoUnit, runSteps]);

  const play = useCallback(() => {
    playSequence(blocs);
  }, [blocs, playSequence]);

  /**
   * Reprendre à un passage donné.
   *
   * Repéré par son rang dans le déroulé et non par l'identifiant de sa section :
   * avec une structure, le même couplet apparaît à plusieurs endroits, et « joue
   * à partir d'ici » doit partir d'ici, pas du premier des trois.
   */
  const playFromBloc = useCallback((index: number) => {
    if (index >= 0 && index < blocs.length) playSequence(blocs.slice(index));
  }, [blocs, playSequence]);

  const togglePlay = useCallback(() => {
    if (isPlaying) stop(); else play();
  }, [isPlaying, stop, play]);

  return { isPlaying, activeStep, play, stop, playFromBloc, playRow, togglePlay, blocs, debutRef };
}
