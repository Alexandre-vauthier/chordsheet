'use client';

import { useState, useCallback } from 'react';
import type { InstrumentId, StringChord, PianoChord, FingerPosition, ChordBarre } from '@/types';
import { INSTRUMENTS } from '@/types';
import { playChord } from '@/lib/chord-audio';

// Configuration par instrument
const INSTRUMENT_CONFIG: Record<Exclude<InstrumentId, 'piano'>, { strings: number; frets: number; label: string }> = {
  guitar: { strings: 6, frets: 5, label: 'Guitare' },
  ukulele: { strings: 4, frets: 5, label: 'Ukulélé' },
  mandolin: { strings: 4, frets: 5, label: 'Mandoline' },
  banjo: { strings: 5, frets: 5, label: 'Banjo' },
};

// Notes du piano (2 octaves)
const PIANO_NOTES = [
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
  'C6'
];

interface ChordEditorProps {
  initialInstrument?: InstrumentId;
  onSave?: (chord: StringChord | PianoChord, instrumentId: InstrumentId) => void;
  onCancel?: () => void;
}

export function ChordEditor({ initialInstrument = 'guitar', onSave, onCancel }: ChordEditorProps) {
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(initialInstrument);
  const [chordName, setChordName] = useState('');
  const [chordFull, setChordFull] = useState('');

  // État pour instruments à cordes
  const [fingers, setFingers] = useState<FingerPosition[]>([]);
  const [barre, setBarre] = useState<ChordBarre | null>(null);
  const [openStrings, setOpenStrings] = useState<number[]>([]);
  const [mutedStrings, setMutedStrings] = useState<number[]>([]);
  const [startFret, setStartFret] = useState(1);

  // État pour piano
  const [pianoNotes, setPianoNotes] = useState<string[]>([]);

  const isPiano = instrumentId === 'piano';
  const config = !isPiano ? INSTRUMENT_CONFIG[instrumentId] : null;

  // Réinitialiser quand on change d'instrument
  const handleInstrumentChange = (newInstrument: InstrumentId) => {
    setInstrumentId(newInstrument);
    setFingers([]);
    setBarre(null);
    setOpenStrings([]);
    setMutedStrings([]);
    setPianoNotes([]);
  };

  // Clic sur une case du manche
  const handleFretClick = useCallback((stringNum: number, fret: number) => {
    // Retirer de open/muted si présent
    setOpenStrings(prev => prev.filter(s => s !== stringNum));
    setMutedStrings(prev => prev.filter(s => s !== stringNum));

    // Vérifier si un doigt est déjà là
    const existingIndex = fingers.findIndex(([s, f]) => s === stringNum && f === fret);

    if (existingIndex >= 0) {
      // Retirer le doigt
      setFingers(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      // Retirer tout doigt sur cette corde et ajouter le nouveau
      setFingers(prev => {
        const filtered = prev.filter(([s]) => s !== stringNum);
        const nextFingerNum = filtered.length + 1;
        return [...filtered, [stringNum, fret, nextFingerNum] as FingerPosition];
      });
    }
  }, [fingers]);

  // Toggle corde ouverte
  const toggleOpenString = useCallback((stringNum: number) => {
    // Retirer des autres états
    setFingers(prev => prev.filter(([s]) => s !== stringNum));
    setMutedStrings(prev => prev.filter(s => s !== stringNum));

    setOpenStrings(prev =>
      prev.includes(stringNum)
        ? prev.filter(s => s !== stringNum)
        : [...prev, stringNum]
    );
  }, []);

  // Toggle corde mutée
  const toggleMutedString = useCallback((stringNum: number) => {
    // Retirer des autres états
    setFingers(prev => prev.filter(([s]) => s !== stringNum));
    setOpenStrings(prev => prev.filter(s => s !== stringNum));

    setMutedStrings(prev =>
      prev.includes(stringNum)
        ? prev.filter(s => s !== stringNum)
        : [...prev, stringNum]
    );
  }, []);

  // Toggle note piano
  const togglePianoNote = useCallback((note: string) => {
    setPianoNotes(prev =>
      prev.includes(note)
        ? prev.filter(n => n !== note)
        : [...prev, note].sort((a, b) => PIANO_NOTES.indexOf(a) - PIANO_NOTES.indexOf(b))
    );
  }, []);

  // Configurer le barré
  const toggleBarre = useCallback(() => {
    if (barre) {
      setBarre(null);
    } else if (config) {
      setBarre({ fret: 1, fromString: 1, toString: config.strings });
    }
  }, [barre, config]);

  // Jouer l'accord
  const handlePlay = useCallback(() => {
    if (isPiano) {
      if (pianoNotes.length === 0) return;
      const chord: PianoChord = {
        id: 'preview',
        name: chordName || 'Preview',
        full: chordFull || chordName || 'Preview',
        category: 'custom',
        notes: pianoNotes,
      };
      playChord(chord, 'piano');
    } else {
      const chord: StringChord = {
        id: 'preview',
        name: chordName || 'Preview',
        full: chordFull || chordName || 'Preview',
        category: 'custom',
        fingers,
        barre: barre || undefined,
        open: openStrings,
        muted: mutedStrings,
        startFret,
      };
      playChord(chord, instrumentId);
    }
  }, [isPiano, pianoNotes, chordName, chordFull, fingers, barre, openStrings, mutedStrings, startFret, instrumentId]);

  // Sauvegarder l'accord
  const handleSave = useCallback(() => {
    if (!chordName.trim()) return;

    if (isPiano) {
      const chord: PianoChord = {
        id: `custom-${Date.now()}`,
        name: chordName.trim(),
        full: chordFull.trim() || chordName.trim(),
        category: 'custom',
        notes: pianoNotes,
      };
      onSave?.(chord, 'piano');
    } else {
      const chord: StringChord = {
        id: `custom-${Date.now()}`,
        name: chordName.trim(),
        full: chordFull.trim() || chordName.trim(),
        category: 'custom',
        fingers,
        barre: barre || undefined,
        open: openStrings,
        muted: mutedStrings,
        startFret,
      };
      onSave?.(chord, instrumentId);
    }
  }, [chordName, chordFull, isPiano, pianoNotes, fingers, barre, openStrings, mutedStrings, startFret, instrumentId, onSave]);

  // Réinitialiser
  const handleClear = useCallback(() => {
    setFingers([]);
    setBarre(null);
    setOpenStrings([]);
    setMutedStrings([]);
    setPianoNotes([]);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-[var(--line)] p-6 max-w-lg">
      {/* Sélecteur d'instrument */}
      <div className="mb-6">
        <label className="block text-sm text-[var(--ink-light)] mb-2">Instrument</label>
        <div className="flex flex-wrap gap-1">
          {INSTRUMENTS.map((inst) => (
            <button
              key={inst}
              onClick={() => handleInstrumentChange(inst)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                instrumentId === inst
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-white text-[var(--ink-light)] border-[var(--line)] hover:border-[var(--accent)]'
              }`}
            >
              {inst === 'guitar' ? '🎸 Guitare' :
               inst === 'ukulele' ? '🪕 Ukulélé' :
               inst === 'mandolin' ? '🎻 Mandoline' :
               inst === 'banjo' ? '🪕 Banjo' :
               '🎹 Piano'}
            </button>
          ))}
        </div>
      </div>

      {/* Nom de l'accord */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm text-[var(--ink-light)] mb-1">Nom court</label>
          <input
            type="text"
            value={chordName}
            onChange={(e) => setChordName(e.target.value)}
            placeholder="Am7"
            className="w-full px-3 py-2 border border-[var(--line)] rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--ink-light)] mb-1">Nom complet</label>
          <input
            type="text"
            value={chordFull}
            onChange={(e) => setChordFull(e.target.value)}
            placeholder="La mineur 7"
            className="w-full px-3 py-2 border border-[var(--line)] rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
        </div>
      </div>

      {/* Éditeur visuel */}
      <div className="mb-6">
        {isPiano ? (
          <PianoEditor notes={pianoNotes} onToggleNote={togglePianoNote} />
        ) : config ? (
          <StringEditor
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
        ) : null}
      </div>

      {/* Contrôles du barré (instruments à cordes uniquement) */}
      {!isPiano && config && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-4 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!barre}
                onChange={toggleBarre}
                className="w-4 h-4 rounded border-[var(--line)] text-[var(--accent)]"
              />
              <span className="text-sm">Barré</span>
            </label>
          </div>

          {barre && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[var(--ink-faint)] mb-1">Case</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={barre.fret}
                  onChange={(e) => setBarre({ ...barre, fret: parseInt(e.target.value) || 1 })}
                  className="w-full px-2 py-1 border border-[var(--line)] rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-faint)] mb-1">De corde</label>
                <input
                  type="number"
                  min={1}
                  max={config.strings}
                  value={barre.fromString}
                  onChange={(e) => setBarre({ ...barre, fromString: parseInt(e.target.value) || 1 })}
                  className="w-full px-2 py-1 border border-[var(--line)] rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-faint)] mb-1">À corde</label>
                <input
                  type="number"
                  min={1}
                  max={config.strings}
                  value={barre.toString}
                  onChange={(e) => setBarre({ ...barre, toString: parseInt(e.target.value) || config.strings })}
                  className="w-full px-2 py-1 border border-[var(--line)] rounded text-sm"
                />
              </div>
            </div>
          )}

          <div className="mt-3">
            <label className="block text-xs text-[var(--ink-faint)] mb-1">Case de départ</label>
            <input
              type="number"
              min={1}
              max={12}
              value={startFret}
              onChange={(e) => setStartFret(parseInt(e.target.value) || 1)}
              className="w-20 px-2 py-1 border border-[var(--line)] rounded text-sm"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handlePlay}
          className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-lg
            hover:bg-[#b54a2a] transition-colors text-sm font-medium"
        >
          ▶ Jouer
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-gray-100 text-[var(--ink-light)] rounded-lg
            hover:bg-gray-200 transition-colors text-sm"
        >
          Effacer
        </button>
        {onSave && (
          <button
            onClick={handleSave}
            disabled={!chordName.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg
              hover:bg-green-700 transition-colors text-sm font-medium
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sauvegarder
          </button>
        )}
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-[var(--line)] text-[var(--ink-light)] rounded-lg
              hover:bg-gray-50 transition-colors text-sm"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}

// Éditeur pour instruments à cordes
interface StringEditorProps {
  config: { strings: number; frets: number };
  fingers: FingerPosition[];
  barre: ChordBarre | null;
  openStrings: number[];
  mutedStrings: number[];
  startFret: number;
  onFretClick: (stringNum: number, fret: number) => void;
  onToggleOpen: (stringNum: number) => void;
  onToggleMuted: (stringNum: number) => void;
}

function StringEditor({
  config,
  fingers,
  barre,
  openStrings,
  mutedStrings,
  startFret,
  onFretClick,
  onToggleOpen,
  onToggleMuted,
}: StringEditorProps) {
  const { strings, frets } = config;

  // Dimensions
  const cellWidth = 36;
  const cellHeight = 40;
  const topPadding = 30;
  const leftPadding = 30;
  const width = leftPadding + strings * cellWidth + 20;
  const height = topPadding + frets * cellHeight + 20;

  // Vérifier si une position a un doigt
  const getFinger = (s: number, f: number) => fingers.find(([fs, ff]) => fs === s && ff === f);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[300px] mx-auto">
      {/* Numéros de cases */}
      {Array.from({ length: frets }, (_, i) => (
        <text
          key={`fret-${i}`}
          x={12}
          y={topPadding + i * cellHeight + cellHeight / 2 + 4}
          className="text-[10px] fill-[var(--ink-faint)]"
          textAnchor="middle"
        >
          {startFret + i}
        </text>
      ))}

      {/* Indicateurs open/muted en haut */}
      {Array.from({ length: strings }, (_, i) => {
        const stringNum = strings - i;
        const x = leftPadding + i * cellWidth + cellWidth / 2;
        const isOpen = openStrings.includes(stringNum);
        const isMuted = mutedStrings.includes(stringNum);

        return (
          <g key={`top-${stringNum}`}>
            {/* Zone cliquable */}
            <rect
              x={x - 12}
              y={2}
              width={24}
              height={22}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => {
                if (isOpen) {
                  onToggleMuted(stringNum);
                } else if (isMuted) {
                  // Retirer muted (clic supplémentaire)
                  onToggleMuted(stringNum);
                } else {
                  onToggleOpen(stringNum);
                }
              }}
            />
            {/* Indicateur */}
            {isOpen && (
              <circle cx={x} cy={14} r={6} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
            )}
            {isMuted && (
              <text x={x} y={18} textAnchor="middle" className="text-sm fill-[var(--ink)]">✕</text>
            )}
          </g>
        );
      })}

      {/* Sillet (si startFret === 1) */}
      {startFret === 1 && (
        <rect
          x={leftPadding}
          y={topPadding - 4}
          width={cellWidth * (strings - 1)}
          height={4}
          fill="var(--ink)"
        />
      )}

      {/* Lignes de frettes */}
      {Array.from({ length: frets + 1 }, (_, i) => (
        <line
          key={`fret-line-${i}`}
          x1={leftPadding}
          y1={topPadding + i * cellHeight}
          x2={leftPadding + (strings - 1) * cellWidth}
          y2={topPadding + i * cellHeight}
          stroke="var(--ink-faint)"
          strokeWidth={1}
        />
      ))}

      {/* Cordes */}
      {Array.from({ length: strings }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={leftPadding + i * cellWidth}
          y1={topPadding}
          x2={leftPadding + i * cellWidth}
          y2={topPadding + frets * cellHeight}
          stroke="var(--ink-light)"
          strokeWidth={strings - i <= 2 ? 1 : 1.5}
        />
      ))}

      {/* Barré */}
      {barre && (
        <rect
          x={leftPadding + (strings - Math.max(barre.fromString, barre.toString)) * cellWidth - 8}
          y={topPadding + (barre.fret - startFret) * cellHeight + cellHeight / 2 - 8}
          width={(Math.abs(barre.fromString - barre.toString) + 1) * cellWidth - cellWidth + 16}
          height={16}
          rx={8}
          fill="var(--ink)"
        />
      )}

      {/* Zones cliquables et doigts */}
      {Array.from({ length: strings }, (_, si) => {
        const stringNum = strings - si;
        const x = leftPadding + si * cellWidth;

        return Array.from({ length: frets }, (_, fi) => {
          const fretNum = startFret + fi;
          const y = topPadding + fi * cellHeight;
          const finger = getFinger(stringNum, fretNum);

          return (
            <g key={`cell-${stringNum}-${fretNum}`}>
              {/* Zone cliquable */}
              <rect
                x={x - cellWidth / 2 + 2}
                y={y + 2}
                width={cellWidth - 4}
                height={cellHeight - 4}
                fill="transparent"
                className="cursor-pointer hover:fill-[var(--accent-soft)]"
                onClick={() => onFretClick(stringNum, fretNum)}
              />
              {/* Doigt */}
              {finger && (
                <g>
                  <circle
                    cx={x}
                    cy={y + cellHeight / 2}
                    r={12}
                    fill="var(--accent)"
                  />
                  <text
                    x={x}
                    y={y + cellHeight / 2 + 4}
                    textAnchor="middle"
                    className="text-xs fill-white font-medium"
                  >
                    {finger[2]}
                  </text>
                </g>
              )}
            </g>
          );
        });
      })}
    </svg>
  );
}

// Éditeur pour piano
interface PianoEditorProps {
  notes: string[];
  onToggleNote: (note: string) => void;
}

function PianoEditor({ notes, onToggleNote }: PianoEditorProps) {
  // Touches blanches et noires
  const whiteNotes = PIANO_NOTES.filter(n => !n.includes('#'));
  const blackNotes = PIANO_NOTES.filter(n => n.includes('#'));

  // Position des touches noires (indices relatifs aux blanches)
  const blackKeyPositions = [0.7, 1.7, 3.7, 4.7, 5.7, 7.7, 8.7, 10.7, 11.7, 12.7];

  const whiteWidth = 28;
  const whiteHeight = 100;
  const blackWidth = 18;
  const blackHeight = 60;
  const width = whiteNotes.length * whiteWidth;
  const height = whiteHeight + 10;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[420px] mx-auto">
      {/* Touches blanches */}
      {whiteNotes.map((note, i) => {
        const isActive = notes.includes(note);
        return (
          <g key={note}>
            <rect
              x={i * whiteWidth}
              y={0}
              width={whiteWidth - 1}
              height={whiteHeight}
              fill={isActive ? 'var(--accent)' : 'white'}
              stroke="var(--ink-light)"
              strokeWidth={1}
              rx={2}
              className="cursor-pointer"
              onClick={() => onToggleNote(note)}
            />
            <text
              x={i * whiteWidth + whiteWidth / 2}
              y={whiteHeight - 8}
              textAnchor="middle"
              className={`text-[8px] pointer-events-none ${isActive ? 'fill-white' : 'fill-[var(--ink-faint)]'}`}
            >
              {note.replace(/\d/, '')}
            </text>
          </g>
        );
      })}

      {/* Touches noires */}
      {blackNotes.map((note, i) => {
        const isActive = notes.includes(note);
        const x = blackKeyPositions[i] * whiteWidth - blackWidth / 2;
        return (
          <rect
            key={note}
            x={x}
            y={0}
            width={blackWidth}
            height={blackHeight}
            fill={isActive ? 'var(--accent)' : '#333'}
            stroke="var(--ink)"
            strokeWidth={1}
            rx={2}
            className="cursor-pointer"
            onClick={() => onToggleNote(note)}
          />
        );
      })}

      {/* Notes sélectionnées */}
      {notes.length > 0 && (
        <text
          x={width / 2}
          y={height - 2}
          textAnchor="middle"
          className="text-[10px] fill-[var(--ink-light)]"
        >
          {notes.join(' - ')}
        </text>
      )}
    </svg>
  );
}
