'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Cell, CellSpan, InstrumentId } from '@/types';
import { findChordByName } from '@/lib/chord-data';
import { ensureAudioContext, getAudioContext, playChord, preloadInstrument, stopAllChords } from '@/lib/chord-audio';
import { Link } from '@/i18n/navigation';
import { getChordColor } from '@/lib/use-chord-color';

/**
 * Bac à sable de l'accueil : une grille réduite, éditable et jouable sans compte.
 *
 * Le pari : on décrit l'éditeur en trois lignes depuis des mois, alors qu'il suffit
 * de le laisser toucher. La grille se manipule exactement comme la vraie — même
 * découpe, même fusion, mêmes durées — pour que ce qu'on essaie ici soit ce qu'on
 * retrouve après inscription. Les formules de durée et de découpe sont donc reprises
 * telles quelles de l'éditeur plutôt que réinventées au plus simple.
 *
 * Volontairement autonome, sans les composants de `sheet/` : ceux-ci tirent le
 * contexte de la bibliothèque, la recherche d'accords et les coach marks, soit
 * beaucoup de code pour une page dont la vitesse compte.
 */

/** Les trois voix demandées, toutes en accords plaqués. */
const VOIX: InstrumentId[] = ['guitar', 'piano', 'bass'];

const BPM = 110;
const BEATS_PER_MEASURE = 4;

/** Une grille de 4/4 se lit sur 16 colonnes : chaque 0,25 de span en occupe une. */
const TOTAL_COLONNES = 16;
const colonnes = (span: CellSpan) => Math.round(span / 0.25);

// Repris tels quels du dictionnaire de l'éditeur : une valeur inventée ne s'y
// traduit pas, next-intl affiche alors la clé (« SectionLabels.Pont »).
const LABELS_SECTION = ['Couplet', 'Refrain', 'Bridge'] as const;

interface DemoSection {
  id: string;
  label: string;
  rows: Cell[][];
}

const c = (chord: string, span: CellSpan = 1): Cell => ({ chord, span });

/**
 * Deux lignes au départ, avec une durée inégale sur la seconde : une grille où tout
 * dure pareil ne montrerait pas ce que la découpe sert à faire.
 */
const DEPART: DemoSection[] = [
  {
    id: 'demo-1',
    label: 'Couplet',
    rows: [
      [c('Am'), c('F'), c('C'), c('G')],
      [c('Am'), c('F'), c('G', 2)],
    ],
  },
];

const rowVide = (): Cell[] => [c(''), c(''), c(''), c('')];

interface Pas {
  sectionIndex: number;
  rowIndex: number;
  cellIndex: number;
  dureeMs: number;
}

/**
 * Durée d'une cellule, formule de `use-playback` : un span de 1 vaut une mesure,
 * donc `beatsPerMeasure` temps. La reprendre à l'identique évite que la démo sonne
 * autrement que la vraie lecture.
 */
function construireSequence(sections: DemoSection[], beatMs: number): Pas[] {
  const pas: Pas[] = [];

  sections.forEach((section, sectionIndex) => {
    section.rows.forEach((row, rowIndex) => {
      // On s'arrête au dernier accord saisi : les cases vides de fin ne sont pas
      // du silence voulu, ce sont des cases pas encore remplies.
      let dernier = row.length - 1;
      while (dernier > 0 && !row[dernier].chord.trim()) dernier--;

      for (let cellIndex = 0; cellIndex <= dernier; cellIndex++) {
        pas.push({
          sectionIndex,
          rowIndex,
          cellIndex,
          dureeMs: row[cellIndex].span * BEATS_PER_MEASURE * beatMs,
        });
      }
    });
  });

  return pas;
}

export function TryEditor({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  const t = useTranslations('TryEditor');
  const tSection = useTranslations('SectionLabels');

  const [sections, setSections] = useState<DemoSection[]>(DEPART);
  const [enLecture, setEnLecture] = useState(false);
  const [pasActif, setPasActif] = useState<Pas | null>(null);
  // Compteur de pas : sert de clé au balayage, pour que l'animation reparte à zéro
  // à chaque passage — sans quoi une boucle d'une seule case ne balaierait qu'une fois.
  const [tour, setTour] = useState(0);
  // Case en cours de saisie : sa couleur d'accord s'efface, sinon l'ancienne bordure
  // reste visible sous l'anneau de focus et les deux se disputent la case.
  const [saisie, setSaisie] = useState<string | null>(null);

  // La boucle lit la grille par une référence, pas par la fermeture : on peut ainsi
  // changer un accord pendant qu'elle tourne et l'entendre au tour suivant.
  const sectionsRef = useRef(sections);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const amorceRef = useRef(false);

  /**
   * Charge les échantillons dès le premier contact avec la grille, pas au moment du
   * play : les trois instruments arrivent par le réseau, et attendre le clic ferait
   * entendre les premiers accords en oscillateur avant que le vrai son n'arrive.
   *
   * Amorcé depuis un geste de l'utilisateur, jamais au montage : un navigateur refuse
   * de démarrer un contexte audio sans geste, et créer un contexte pour chaque
   * visiteur qui ne fait que passer ne servirait à rien.
   */
  const amorcer = useCallback(() => {
    if (amorceRef.current) return;
    amorceRef.current = true;
    for (const voix of VOIX) preloadInstrument(voix);
  }, []);

  const arreter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    stopAllChords();
    setEnLecture(false);
    setPasActif(null);
  }, []);

  // Quitter la page pendant la lecture laisserait la boucle tourner dans le vide.
  useEffect(() => arreter, [arreter]);

  const demarrer = useCallback(async () => {
    await ensureAudioContext();
    amorcer();

    const beatMs = (60 / BPM) * 1000;
    setEnLecture(true);

    let i = 0;
    let prochainTemps = getAudioContext().currentTime;

    const avancer = () => {
      // Le contexte est redemandé à chaque pas : le navigateur le suspend sans
      // prévenir (onglet en arrière-plan, veille), `currentTime` se fige alors et la
      // boucle s'arrêterait sans un son. Le redemander le réveille.
      const ctx = getAudioContext();
      if (prochainTemps - ctx.currentTime > 2) prochainTemps = ctx.currentTime;

      const sequence = construireSequence(sectionsRef.current, beatMs);
      if (sequence.length === 0) { arreter(); return; }
      if (i >= sequence.length) i = 0;

      const pas = sequence[i];
      setPasActif(pas);
      setTour(n => n + 1);

      const cellule = sectionsRef.current[pas.sectionIndex]?.rows[pas.rowIndex]?.[pas.cellIndex];
      if (cellule?.chord.trim()) {
        // Les voix sont indépendantes dans `chord-audio` : les trois instruments
        // sonnent ensemble au lieu de se couper l'un l'autre.
        for (const voix of VOIX) {
          const accord = findChordByName(cellule.chord.trim(), voix);
          if (accord) playChord(accord, voix);
        }
      }

      i++;
      prochainTemps += pas.dureeMs / 1000;
      timeoutRef.current = setTimeout(avancer, Math.max(0, (prochainTemps - ctx.currentTime) * 1000));
    };

    avancer();
  }, [arreter, amorcer]);

  /* ── Édition ─────────────────────────────────────────────────────── */

  const majCellule = (si: number, ri: number, ci: number, chord: string) => {
    setSections(prev => prev.map((s, i) => i !== si ? s : {
      ...s,
      rows: s.rows.map((row, j) => j !== ri ? row : row.map((cell, k) => k !== ci ? cell : { ...cell, chord })),
    }));
  };

  /** Découpe en deux, formule de l'éditeur : la moitié arrondie au quart supérieur. */
  const decouper = (si: number, ri: number, ci: number) => {
    setSections(prev => prev.map((s, i) => i !== si ? s : {
      ...s,
      rows: s.rows.map((row, j) => {
        if (j !== ri) return row;
        const cell = row[ci];
        if (cell.span <= 0.25) return row;
        const spanA = (Math.ceil((cell.span / 2) / 0.25) * 0.25) as CellSpan;
        const spanB = (cell.span - spanA) as CellSpan;
        if (spanB <= 0) return row;
        const copie = [...row];
        copie.splice(ci, 1, { chord: cell.chord, span: spanA }, { chord: '', span: spanB });
        return copie;
      }),
    }));
  };

  const fusionner = (si: number, ri: number, ci: number) => {
    if (ci === 0) return;
    setSections(prev => prev.map((s, i) => i !== si ? s : {
      ...s,
      rows: s.rows.map((row, j) => {
        if (j !== ri) return row;
        const precedente = row[ci - 1];
        const courante = row[ci];
        const span = precedente.span + courante.span;
        if (span > 4) return row;
        const copie = [...row];
        copie.splice(ci - 1, 2, { chord: precedente.chord || courante.chord, span: span as CellSpan });
        return copie;
      }),
    }));
  };

  const ajouterMesure = (si: number) => {
    setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, rows: [...s.rows, rowVide()] }));
  };

  const ajouterSection = () => {
    setSections(prev => {
      if (prev.length >= LABELS_SECTION.length) return prev;
      return [...prev, { id: `demo-${prev.length + 1}`, label: LABELS_SECTION[prev.length], rows: [rowVide()] }];
    });
  };

  const reinitialiser = () => { arreter(); setSections(DEPART); };

  /* ── Rendu ───────────────────────────────────────────────────────── */

  return (
    <div className="rounded-2xl bg-[var(--paper)] border border-[var(--line)] p-4 sm:p-6 shadow-2xl">

      {sections.map((section, si) => (
        <div key={section.id} className={si > 0 ? 'mt-6 pt-5 border-t border-[var(--line)]' : ''}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--accent)]">
              {tSection(section.label)}
            </span>
            <button
              type="button"
              onClick={() => ajouterMesure(si)}
              className="text-[11px] text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              {t('addMeasure')}
            </button>
          </div>

          {section.rows.map((row, ri) => {
            // Positions cumulées, pour poser les poignées de fusion aux jointures.
            let cumul = 0;
            const jointures = row.map(cell => (cumul += colonnes(cell.span)));

            return (
              <div key={ri} className="relative mb-4 group/row">
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${TOTAL_COLONNES}, minmax(0, 1fr))` }}>
                  {row.map((cell, ci) => {
                    const actif = pasActif?.sectionIndex === si && pasActif?.rowIndex === ri && pasActif?.cellIndex === ci;
                    // Même code couleur que l'éditeur : une teinte par fondamentale,
                    // portée par la bordure, épaissie à gauche.
                    const enSaisie = saisie === `${si}-${ri}-${ci}`;
                    const couleur = enSaisie ? null : getChordColor(cell.chord);

                    return (
                      <div
                        key={ci}
                        style={{
                          gridColumn: `span ${colonnes(cell.span)}`,
                          // Largeur réservée en permanence : la couleur va et vient
                          // (saisie, case vide), la géométrie ne doit pas suivre.
                          borderLeftWidth: '5px',
                          ...(couleur ? { borderColor: couleur.border } : {}),
                          ...(actif && !couleur ? { borderColor: 'var(--accent)' } : {}),
                          // Après la couleur d'ensemble, sinon elle l'écraserait.
                          borderLeftColor: couleur ? couleur.border : 'var(--line)',
                        }}
                        className="relative rounded-lg border-2 border-[var(--line)] bg-[var(--cell-bg)] transition-colors"
                      >
                        {/* Balayage de fond sur la durée de la case : on voit passer le
                            temps plutôt que de deviner où on en est. Remonté à chaque
                            pas par sa clé, sinon l'animation ne jouerait qu'une fois. */}
                        {actif && pasActif && (
                          <div
                            key={tour}
                            className="absolute inset-0 origin-left pointer-events-none rounded-[inherit]"
                            style={{
                              background: couleur ? couleur.border.substring(0, 7) + '21' : 'rgba(200,75,47,0.13)',
                              animation: `beatSweep ${pasActif.dureeMs}ms linear forwards`,
                            }}
                          />
                        )}

                        <input
                          value={cell.chord}
                          onChange={(e) => majCellule(si, ri, ci, e.target.value)}
                          onFocus={() => { amorcer(); setSaisie(`${si}-${ri}-${ci}`); }}
                          onBlur={() => setSaisie(cur => (cur === `${si}-${ri}-${ci}` ? null : cur))}
                          aria-label={t('cellLabel', { measure: ri + 1, beat: ci + 1 })}
                          className="relative w-full h-11 sm:h-12 bg-transparent text-center font-mono font-medium
                            text-sm sm:text-base text-[var(--ink)] outline-none focus:ring-2
                            focus:ring-[var(--accent)] rounded-lg"
                        />

                        {/* Découpe : centrée sous la case, à la place qu'elle occupe
                            dans l'éditeur. Visible en permanence ici — au doigt il n'y
                            a pas de survol, et c'est justement ce qu'on vient montrer. */}
                        {cell.span > 0.25 && (
                          <button
                            type="button"
                            onClick={() => decouper(si, ri, ci)}
                            title={t('split')}
                            aria-label={t('split')}
                            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 w-6 h-6 flex items-center
                              justify-center rounded-full bg-[var(--paper)] border border-transparent
                              text-xs leading-none text-[var(--accent)] cursor-pointer transition-colors
                              hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-white"
                          >
                            /
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {row.map((cell, ci) => {
                  if (ci === 0) return null;
                  if (row[ci - 1].span + cell.span > 4) return null;

                  return (
                    <div
                      key={`fusion-${ci}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      style={{ left: `${(jointures[ci - 1] / TOTAL_COLONNES) * 100}%` }}
                    >
                      <button
                        type="button"
                        onClick={() => fusionner(si, ri, ci)}
                        title={t('merge')}
                        aria-label={t('merge')}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--paper)]
                          border border-transparent text-[var(--accent)] cursor-pointer transition-colors
                          hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-white"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 8l-4 4 4 4M16 8l4 4-4 4M4 12h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}

      {/* Commandes */}
      <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => (enLecture ? arreter() : demarrer())}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)]
            hover:bg-[#a83d25] text-white text-sm font-medium transition-colors cursor-pointer"
        >
          {enLecture ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
            </svg>
          )}
          {enLecture ? t('stop') : t('play')}
        </button>

        <span className="text-xs text-[var(--ink-faint)]">{t('voices', { bpm: BPM })}</span>

        <div className="ml-auto flex items-center gap-3">
          {sections.length < LABELS_SECTION.length && (
            <button
              type="button"
              onClick={ajouterSection}
              className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              {t('addSection')}
            </button>
          )}
          <button
            type="button"
            onClick={reinitialiser}
            className="text-xs text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            {t('reset')}
          </button>
        </div>
      </div>

      {/* Lien localisé : `next/link` enverrait un anglophone sur la version française. */}
      <Link
        href={ctaHref}
        className="mt-5 block w-full text-center px-6 py-3 rounded-lg border-2 border-[var(--accent)]
          text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white text-sm font-semibold transition-colors"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
