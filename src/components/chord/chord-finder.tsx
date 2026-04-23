'use client';

import { useState, useCallback, useMemo } from 'react';
import type { InstrumentId, StringChord, PianoChord, FingerPosition, ChordBarre } from '@/types';
import { playChord, playNote, OPEN_FREQS, noteNameToFreq } from '@/lib/chord-audio';
import { selectionToPitchClasses, pianoPitchClasses, findMatchingChords, type ChordMatch } from '@/lib/chord-finder';
import { ChordDiagram } from './chord-diagram';
import { PianoKeyboard } from './piano-keyboard';

const INSTRUMENT_CONFIG: Record<Exclude<InstrumentId, 'piano'>, { strings: number; frets: number }> = {
  guitar:   { strings: 6, frets: 5 },
  ukulele:  { strings: 4, frets: 5 },
  mandolin: { strings: 4, frets: 5 },
  banjo:    { strings: 5, frets: 5 },
};

const PIANO_NOTES = [
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
  'C6',
];

const INSTRUMENTS: { id: InstrumentId; label: string }[] = [
  { id: 'guitar',   label: 'Guitare' },
  { id: 'ukulele',  label: 'Ukulélé' },
  { id: 'piano',    label: 'Piano' },
  { id: 'mandolin', label: 'Mandoline' },
  { id: 'banjo',    label: 'Banjo' },
];

interface ChordFinderProps {
  initialInstrument?: InstrumentId;
  allChords: (StringChord | PianoChord)[];
  onClose: () => void;
}

export function ChordFinder({ initialInstrument = 'guitar', allChords, onClose }: ChordFinderProps) {
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(initialInstrument);
  const isPiano = instrumentId === 'piano';
  const config = !isPiano ? INSTRUMENT_CONFIG[instrumentId as Exclude<InstrumentId, 'piano'>] : null;

  // État cordes
  const [fingers, setFingers] = useState<FingerPosition[]>([]);
  const [barre, setBarre] = useState<ChordBarre | null>(null);
  const [openStrings, setOpenStrings] = useState<number[]>(() =>
    config ? Array.from({ length: config.strings }, (_, i) => i + 1) : []
  );
  const [mutedStrings, setMutedStrings] = useState<number[]>([]);
  const [startFret, setStartFret] = useState(1);
  // État piano
  const [pianoNotes, setPianoNotes] = useState<string[]>([]);

  const handleInstrumentChange = (id: InstrumentId) => {
    setInstrumentId(id);
    setFingers([]);
    setBarre(null);
    setPianoNotes([]);
    setMutedStrings([]);
    setStartFret(1);
    if (id !== 'piano') {
      const c = INSTRUMENT_CONFIG[id as Exclude<InstrumentId, 'piano'>];
      setOpenStrings(Array.from({ length: c.strings }, (_, i) => i + 1));
    } else {
      setOpenStrings([]);
    }
  };

  const handleFretClick = useCallback((stringNum: number, fret: number) => {
    const openFreq = OPEN_FREQS[instrumentId]?.[stringNum];
    if (openFreq) playNote(openFreq * Math.pow(2, fret / 12));
    setOpenStrings(prev => prev.filter(s => s !== stringNum));
    setMutedStrings(prev => prev.filter(s => s !== stringNum));
    const existingIndex = fingers.findIndex(([s, f]) => s === stringNum && f === fret);
    if (existingIndex >= 0) {
      setFingers(prev => prev.filter((_, i) => i !== existingIndex));
      setOpenStrings(prev => [...prev, stringNum]);
    } else {
      setFingers(prev => {
        const filtered = prev.filter(([s]) => s !== stringNum);
        return [...filtered, [stringNum, fret, filtered.length + 1] as FingerPosition];
      });
    }
  }, [fingers, instrumentId]);

  const toggleOpenString = useCallback((stringNum: number) => {
    const openFreq = OPEN_FREQS[instrumentId]?.[stringNum];
    if (openFreq) playNote(openFreq);
    setFingers(prev => prev.filter(([s]) => s !== stringNum));
    setMutedStrings(prev => prev.filter(s => s !== stringNum));
    setOpenStrings(prev =>
      prev.includes(stringNum) ? prev.filter(s => s !== stringNum) : [...prev, stringNum]
    );
  }, [instrumentId]);

  const toggleMutedString = useCallback((stringNum: number) => {
    setFingers(prev => prev.filter(([s]) => s !== stringNum));
    setOpenStrings(prev => prev.filter(s => s !== stringNum));
    setMutedStrings(prev =>
      prev.includes(stringNum) ? prev.filter(s => s !== stringNum) : [...prev, stringNum]
    );
  }, []);

  const togglePianoNote = useCallback((note: string) => {
    const freq = noteNameToFreq(note);
    if (freq) playNote(freq, true);
    setPianoNotes(prev =>
      prev.includes(note)
        ? prev.filter(n => n !== note)
        : [...prev, note].sort((a, b) => PIANO_NOTES.indexOf(a) - PIANO_NOTES.indexOf(b))
    );
  }, []);

  const handleClear = () => {
    setFingers([]);
    setBarre(null);
    setPianoNotes([]);
    setMutedStrings([]);
    if (config) setOpenStrings(Array.from({ length: config.strings }, (_, i) => i + 1));
  };

  const handlePlay = () => {
    if (isPiano) {
      if (!pianoNotes.length) return;
      playChord({ id: 'preview', name: '', full: '', category: 'custom', notes: pianoNotes }, 'piano');
    } else {
      playChord({
        id: 'preview', name: '', full: '', category: 'custom',
        fingers, barre: barre ?? undefined, open: openStrings, muted: mutedStrings, startFret,
      }, instrumentId);
    }
  };

  // Pitch classes de la sélection courante
  const selectionPcs = useMemo(() => {
    if (isPiano) return pianoPitchClasses(pianoNotes);
    return selectionToPitchClasses(instrumentId, fingers, openStrings, barre);
  }, [isPiano, pianoNotes, instrumentId, fingers, openStrings, barre]);

  // Matching en temps réel
  const matches = useMemo<ChordMatch[]>(() => {
    const chordsForInstrument = allChords.filter(c =>
      isPianoChord(c) ? instrumentId === 'piano' : instrumentId !== 'piano'
    );
    return findMatchingChords(selectionPcs, chordsForInstrument, instrumentId);
  }, [selectionPcs, allChords, instrumentId]);

  const hasSelection = isPiano ? pianoNotes.length > 0 : fingers.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--paper)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink)]">Identifier un accord</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-0.5">
              Cliquez sur les cases ou les notes — les accords correspondants s&apos;affichent en temps réel
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-xl leading-none">×</button>
        </div>

        <div className="p-6 flex flex-col gap-6 md:flex-row md:items-start">
          {/* Panneau gauche : sélecteur + fretboard */}
          <div className="flex-shrink-0 w-full md:w-72">
            {/* Instrument */}
            <div className="mb-4">
              <p className="text-xs text-[var(--ink-faint)] mb-2">Instrument</p>
              <div className="flex flex-wrap gap-1">
                {INSTRUMENTS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => handleInstrumentChange(id)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                      instrumentId === id
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--cell-bg)] text-[var(--ink-light)] border-[var(--line)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fretboard ou piano */}
            {isPiano ? (
              <FinderPianoEditor notes={pianoNotes} onToggleNote={togglePianoNote} />
            ) : config ? (
              <>
                <FinderStringEditor
                  config={config}
                  fingers={fingers}
                  barre={barre}
                  openStrings={openStrings}
                  mutedStrings={mutedStrings}
                  startFret={startFret}
                  onFretClick={handleFretClick}
                  onToggleOpen={toggleOpenString}
                  onToggleMuted={toggleMutedString}
                />
                {/* Contrôles */}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-[var(--ink-light)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!barre}
                      onChange={() => setBarre(b => b ? null : { fret: 1, fromString: 1, toString: config.strings })}
                      className="rounded"
                    />
                    Barré
                  </label>
                  {barre && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[var(--ink-faint)]">Case</label>
                      <input type="number" min={1} max={12} value={barre.fret}
                        onChange={e => setBarre(b => b ? { ...b, fret: parseInt(e.target.value) || 1 } : b)}
                        className="w-12 px-1.5 py-0.5 border border-[var(--line)] rounded text-xs"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[var(--ink-faint)]">Départ</label>
                    <input type="number" min={1} max={12} value={startFret}
                      onChange={e => setStartFret(parseInt(e.target.value) || 1)}
                      className="w-12 px-1.5 py-0.5 border border-[var(--line)] rounded text-xs"
                    />
                  </div>
                </div>
              </>
            ) : null}

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handlePlay}
                disabled={!hasSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-[#b54a2a] transition-colors"
              >
                ▶ Jouer
              </button>
              <button
                onClick={handleClear}
                className="px-3 py-1.5 border border-[var(--line)] text-[var(--ink-light)] rounded-lg text-xs hover:bg-[var(--cell-hover)] transition-colors"
              >
                Effacer
              </button>
            </div>
          </div>

          {/* Panneau droit : résultats */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--ink-faint)] mb-3">
              {hasSelection
                ? matches.length > 0
                  ? `${matches.length} accord${matches.length > 1 ? 's' : ''} trouvé${matches.length > 1 ? 's' : ''}`
                  : 'Aucun accord ne correspond — essayez d\'autres positions'
                : 'Cliquez sur le manche pour commencer…'}
            </p>
            <div className="space-y-2">
              {matches.map(({ chord, score }) => (
                <MatchCard key={chord.id} chord={chord} instrumentId={instrumentId} score={score} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Carte de résultat ────────────────────────────────────────────────────────

function isPianoChord(chord: StringChord | PianoChord): chord is PianoChord {
  return 'notes' in chord;
}

function MatchCard({ chord, instrumentId, score }: { chord: StringChord | PianoChord; instrumentId: InstrumentId; score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] cursor-pointer hover:border-[var(--accent)] transition-colors group"
      onClick={() => playChord(chord, instrumentId)}
      title="Cliquer pour écouter"
    >
      <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center group-hover:opacity-80 transition-opacity">
        {isPianoChord(chord) ? (
          <PianoKeyboard chord={chord} />
        ) : (
          <ChordDiagram chord={chord} size="xs" numStrings={isPianoChord(chord) ? 0 : (instrumentId === 'guitar' ? 6 : instrumentId === 'banjo' ? 5 : 4)} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono font-semibold text-[var(--ink)]">{chord.name}</p>
        <div className="mt-1 flex items-center gap-1">
          <div className="h-1 rounded-full bg-[var(--line)] flex-1 max-w-[80px] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--ink-faint)]">{pct}%</span>
        </div>
      </div>
      <span className="text-[var(--ink-faint)] text-xs group-hover:text-[var(--accent)] transition-colors">▶</span>
    </div>
  );
}

// ─── Fretboard (cordes) ───────────────────────────────────────────────────────

interface FinderStringEditorProps {
  config: { strings: number; frets: number };
  fingers: FingerPosition[];
  barre: ChordBarre | null;
  openStrings: number[];
  mutedStrings: number[];
  startFret: number;
  onFretClick: (s: number, f: number) => void;
  onToggleOpen: (s: number) => void;
  onToggleMuted: (s: number) => void;
}

function FinderStringEditor({ config, fingers, barre, openStrings, mutedStrings, startFret, onFretClick, onToggleOpen, onToggleMuted }: FinderStringEditorProps) {
  const { strings, frets } = config;
  const cellW = 36, cellH = 40, topPad = 30, leftPad = 30;
  const width = leftPad + strings * cellW + 20;
  const height = topPad + frets * cellH + 20;
  const getFinger = (s: number, f: number) => fingers.find(([fs, ff]) => fs === s && ff === f);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[280px] mx-auto">
      {/* Numéros de cases */}
      {Array.from({ length: frets }, (_, i) => (
        <text key={i} x={12} y={topPad + i * cellH + cellH / 2 + 4} className="text-[10px] fill-[var(--ink-faint)]" textAnchor="middle">
          {startFret + i}
        </text>
      ))}
      {/* Open / muted */}
      {Array.from({ length: strings }, (_, i) => {
        const s = strings - i;
        const x = leftPad + i * cellW;
        const isOpen = openStrings.includes(s);
        const isMuted = mutedStrings.includes(s);
        return (
          <g key={s}>
            {isOpen && <circle cx={x} cy={14} r={6} fill="none" stroke="var(--ink)" strokeWidth={1.5} />}
            {isMuted && <text x={x} y={18} textAnchor="middle" className="text-sm fill-[var(--ink)]">✕</text>}
            <rect x={x - 12} y={2} width={24} height={22} fill="transparent" className="cursor-pointer"
              onClick={() => isOpen ? onToggleMuted(s) : isMuted ? onToggleMuted(s) : onToggleOpen(s)} />
          </g>
        );
      })}
      {/* Sillet */}
      {startFret === 1 && (
        <rect x={leftPad} y={topPad - 4} width={cellW * (strings - 1)} height={4} fill="var(--ink)" />
      )}
      {/* Frettes */}
      {Array.from({ length: frets + 1 }, (_, i) => (
        <line key={i} x1={leftPad} y1={topPad + i * cellH} x2={leftPad + (strings - 1) * cellW} y2={topPad + i * cellH} stroke="var(--ink-faint)" strokeWidth={1} />
      ))}
      {/* Cordes */}
      {Array.from({ length: strings }, (_, i) => (
        <line key={i} x1={leftPad + i * cellW} y1={topPad} x2={leftPad + i * cellW} y2={topPad + frets * cellH} stroke="var(--ink-light)" strokeWidth={strings - i <= 2 ? 1 : 1.5} />
      ))}
      {/* Barré */}
      {barre && (
        <rect
          x={leftPad + (strings - Math.max(barre.fromString, barre.toString)) * cellW - 8}
          y={topPad + (barre.fret - startFret) * cellH + cellH / 2 - 8}
          width={(Math.abs(barre.fromString - barre.toString) + 1) * cellW - cellW + 16}
          height={16} rx={8} fill="var(--ink)"
        />
      )}
      {/* Doigts + zones cliquables */}
      {Array.from({ length: strings }, (_, si) => {
        const s = strings - si;
        const x = leftPad + si * cellW;
        return Array.from({ length: frets }, (_, fi) => {
          const f = startFret + fi;
          const y = topPad + fi * cellH;
          const finger = getFinger(s, f);
          return (
            <g key={`${s}-${f}`}>
              {finger && <circle cx={x} cy={y + cellH / 2} r={12} fill="var(--accent)" />}
              <rect x={x - cellW / 2 + 2} y={y + 2} width={cellW - 4} height={cellH - 4}
                fill="transparent" className="cursor-pointer hover:fill-[var(--accent-soft)]"
                onClick={() => onFretClick(s, f)} />
            </g>
          );
        });
      })}
    </svg>
  );
}

// ─── Piano (touches) ──────────────────────────────────────────────────────────

function FinderPianoEditor({ notes, onToggleNote }: { notes: string[]; onToggleNote: (n: string) => void }) {
  const whiteNotes = PIANO_NOTES.filter(n => !n.includes('#'));
  const blackNotes = PIANO_NOTES.filter(n => n.includes('#'));
  const blackKeyPositions = [0.7, 1.7, 3.7, 4.7, 5.7, 7.7, 8.7, 10.7, 11.7, 12.7];
  const wW = 28, wH = 100, bW = 18, bH = 60;
  const width = whiteNotes.length * wW;

  return (
    <svg viewBox={`0 0 ${width} ${wH + 10}`} className="w-full max-w-[420px] mx-auto">
      {whiteNotes.map((note, i) => {
        const active = notes.includes(note);
        return (
          <rect key={note} x={i * wW} y={0} width={wW - 2} height={wH}
            fill={active ? 'var(--accent)' : 'white'} stroke="var(--line)" strokeWidth={1}
            className="cursor-pointer" onClick={() => onToggleNote(note)} />
        );
      })}
      {blackNotes.map((note, i) => {
        const active = notes.includes(note);
        const pos = blackKeyPositions[i] ?? 0;
        return (
          <rect key={note} x={pos * wW + 2} y={0} width={bW} height={bH}
            fill={active ? 'var(--accent)' : 'var(--ink)'} rx={2}
            className="cursor-pointer" onClick={() => onToggleNote(note)} />
        );
      })}
    </svg>
  );
}
