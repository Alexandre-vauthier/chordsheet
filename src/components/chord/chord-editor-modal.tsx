'use client';

import { useState, useEffect } from 'react';
import type { InstrumentId, StringChord, PianoChord, FingerPosition, ChordBarre } from '@/types';
import { playChord, playNote, OPEN_FREQS, noteNameToFreq } from '@/lib/chord-audio';

const CATEGORY_OPTIONS = [
  { value: 'major', label: 'Majeur' },
  { value: 'minor', label: 'Mineur' },
  { value: 'dom7', label: '7 (Dominant)' },
  { value: 'maj7', label: 'Maj 7' },
  { value: 'min7', label: 'Min 7' },
  { value: 'dim', label: 'Diminué' },
  { value: 'aug', label: 'Augmenté' },
  { value: 'sus', label: 'Sus / Add' },
  { value: 'other', label: 'Autre' },
];

interface ChordEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (chord: StringChord | PianoChord) => void;
  chordName: string;
  instrumentId: InstrumentId;
  initialChord?: StringChord | PianoChord | null;
  /** Vrai quand c'est un ajout admin (pas un override) sans nom prédéfini */
  isAddition?: boolean;
  /** Catégorie imposée par la page parente */
  forcedCategory?: string;
  onCategoryChange?: (cat: string) => void;
}

// Configuration par instrument
const INSTRUMENT_CONFIG: Record<Exclude<InstrumentId, 'piano'>, { strings: number; frets: number }> = {
  guitar: { strings: 6, frets: 5 },
  ukulele: { strings: 4, frets: 5 },
  mandolin: { strings: 4, frets: 5 },
  banjo: { strings: 5, frets: 5 },
};

// Notes du piano
const PIANO_NOTES = [
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
  'C6'
];

export function ChordEditorModal({
  isOpen,
  onClose,
  onSave,
  chordName,
  instrumentId,
  initialChord,
  isAddition = false,
  forcedCategory,
  onCategoryChange,
}: ChordEditorModalProps) {
  const isPiano = instrumentId === 'piano';
  const config = !isPiano ? INSTRUMENT_CONFIG[instrumentId] : null;

  // Nom éditable (pour les nouveaux accords admin sans nom prédéfini)
  const [editableName, setEditableName] = useState(chordName);

  // État pour instruments à cordes
  const [fingers, setFingers] = useState<FingerPosition[]>([]);
  const [barre, setBarre] = useState<ChordBarre | null>(null);
  const [openStrings, setOpenStrings] = useState<number[]>([]);
  const [mutedStrings, setMutedStrings] = useState<number[]>([]);
  const [startFret, setStartFret] = useState(1);

  // État pour piano
  const [pianoNotes, setPianoNotes] = useState<string[]>([]);

  // Sync nom éditable à l'ouverture
  useEffect(() => {
    if (isOpen) setEditableName(chordName);
  }, [isOpen, chordName]);

  // Charger l'accord initial quand la modal s'ouvre
  useEffect(() => {
    if (isOpen && initialChord) {
      if ('notes' in initialChord) {
        // Accord piano
        setPianoNotes(initialChord.notes || []);
      } else {
        // Accord à cordes
        setFingers(initialChord.fingers || []);
        setBarre(initialChord.barre || null);
        setOpenStrings(initialChord.open || []);
        setMutedStrings(initialChord.muted || []);
        setStartFret(initialChord.startFret || 1);
      }
    } else if (isOpen) {
      // Réinitialiser avec toutes les cordes ouvertes par défaut
      setFingers([]);
      setBarre(null);
      if (!isPiano && config) {
        setOpenStrings(Array.from({ length: config.strings }, (_, i) => i + 1));
      } else {
        setOpenStrings([]);
      }
      setMutedStrings([]);
      setStartFret(1);
      setPianoNotes([]);
    }
  }, [isOpen, initialChord]);

  if (!isOpen) return null;

  // Handlers pour cordes
  const handleFretClick = (stringNum: number, fret: number) => {
    // Jouer le son de la note
    const openFreq = OPEN_FREQS[instrumentId]?.[stringNum];
    if (openFreq) playNote(openFreq * Math.pow(2, fret / 12));

    setOpenStrings(prev => prev.filter(s => s !== stringNum));
    setMutedStrings(prev => prev.filter(s => s !== stringNum));

    const existingIndex = fingers.findIndex(([s, f]) => s === stringNum && f === fret);
    if (existingIndex >= 0) {
      // Retirer le doigt → remettre la corde en ouvert
      setFingers(prev => prev.filter((_, i) => i !== existingIndex));
      setOpenStrings(prev => [...prev, stringNum]);
    } else {
      setFingers(prev => {
        const filtered = prev.filter(([s]) => s !== stringNum);
        const nextFingerNum = filtered.length + 1;
        return [...filtered, [stringNum, fret, nextFingerNum] as FingerPosition];
      });
    }
  };

  const toggleOpenString = (stringNum: number) => {
    const openFreq = OPEN_FREQS[instrumentId]?.[stringNum];
    if (openFreq) playNote(openFreq);

    setFingers(prev => prev.filter(([s]) => s !== stringNum));
    setMutedStrings(prev => prev.filter(s => s !== stringNum));
    setOpenStrings(prev =>
      prev.includes(stringNum) ? prev.filter(s => s !== stringNum) : [...prev, stringNum]
    );
  };

  const toggleMutedString = (stringNum: number) => {
    setFingers(prev => prev.filter(([s]) => s !== stringNum));
    setOpenStrings(prev => prev.filter(s => s !== stringNum));
    setMutedStrings(prev =>
      prev.includes(stringNum) ? prev.filter(s => s !== stringNum) : [...prev, stringNum]
    );
  };

  // Handler pour piano
  const togglePianoNote = (note: string) => {
    const freq = noteNameToFreq(note);
    if (freq) playNote(freq, true);

    setPianoNotes(prev =>
      prev.includes(note)
        ? prev.filter(n => n !== note)
        : [...prev, note].sort((a, b) => PIANO_NOTES.indexOf(a) - PIANO_NOTES.indexOf(b))
    );
  };

  // Jouer l'accord
  const handlePlay = () => {
    const chord = buildChord();
    if (chord) {
      playChord(chord, instrumentId);
    }
  };

  // Construire l'objet accord
  const buildChord = (): StringChord | PianoChord | null => {
    const name = editableName.trim();
    if (!name) return null;
    if (isPiano) {
      if (pianoNotes.length === 0) return null;
      return {
        id: `custom-${name}-${Date.now()}`,
        name,
        full: `${name} (personnalisé)`,
        category: 'custom',
        notes: pianoNotes,
      };
    } else {
      return {
        id: `custom-${name}-${Date.now()}`,
        name,
        full: `${name} (personnalisé)`,
        category: 'custom',
        fingers,
        barre: barre || undefined,
        open: openStrings,
        muted: mutedStrings,
        startFret,
      };
    }
  };

  // Sauvegarder
  const handleSave = () => {
    const chord = buildChord();
    if (chord) {
      onSave(chord);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-[var(--line)]">
          <h2 className="text-lg font-medium text-[var(--ink)] mb-2">
            {chordName ? `Modifier l'accord : ${chordName}` : 'Ajouter un accord'}
          </h2>
          {!chordName && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={editableName}
                onChange={(e) => setEditableName(e.target.value)}
                placeholder="Nom de l'accord (ex: C#m7)"
                className="flex-1 px-3 py-2 border border-[var(--line)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                autoFocus
              />
              {isAddition && onCategoryChange && (
                <select
                  value={forcedCategory}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="px-2 py-2 border border-[var(--line)] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {CATEGORY_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          <p className="text-sm text-[var(--ink-light)] mt-2">
            Cliquez sur les cases pour placer vos doigts
          </p>
        </div>

        <div className="p-4">
          {/* Éditeur visuel */}
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

          {/* Contrôles barré */}
          {!isPiano && config && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!barre}
                    onChange={() => setBarre(barre ? null : { fret: 1, fromString: 1, toString: config.strings })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Barré</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--ink-faint)]">Case départ:</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={startFret}
                    onChange={(e) => setStartFret(parseInt(e.target.value) || 1)}
                    className="w-14 px-2 py-1 border border-[var(--line)] rounded text-sm"
                  />
                </div>
              </div>
              {barre && (
                <div className="flex gap-3 mt-2">
                  <div>
                    <span className="text-xs text-[var(--ink-faint)]">Case</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={barre.fret}
                      onChange={(e) => setBarre({ ...barre, fret: parseInt(e.target.value) || 1 })}
                      className="w-14 px-2 py-1 border border-[var(--line)] rounded text-sm block"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-[var(--ink-faint)]">De</span>
                    <input
                      type="number"
                      min={1}
                      max={config.strings}
                      value={barre.fromString}
                      onChange={(e) => setBarre({ ...barre, fromString: parseInt(e.target.value) || 1 })}
                      className="w-14 px-2 py-1 border border-[var(--line)] rounded text-sm block"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-[var(--ink-faint)]">À</span>
                    <input
                      type="number"
                      min={1}
                      max={config.strings}
                      value={barre.toString}
                      onChange={(e) => setBarre({ ...barre, toString: parseInt(e.target.value) || config.strings })}
                      className="w-14 px-2 py-1 border border-[var(--line)] rounded text-sm block"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[var(--line)] flex gap-2 justify-end">
          <button
            onClick={handlePlay}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            ▶ Écouter
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[var(--line)] hover:bg-gray-50 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white hover:bg-[#b54a2a] rounded-lg transition-colors"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// Éditeur pour instruments à cordes (simplifié)
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
}: {
  config: { strings: number; frets: number };
  fingers: FingerPosition[];
  barre: ChordBarre | null;
  openStrings: number[];
  mutedStrings: number[];
  startFret: number;
  onFretClick: (s: number, f: number) => void;
  onToggleOpen: (s: number) => void;
  onToggleMuted: (s: number) => void;
}) {
  const { strings, frets } = config;
  const cellW = 36, cellH = 40, topPad = 30, leftPad = 30;
  const w = leftPad + strings * cellW + 20;
  const h = topPad + frets * cellH + 20;

  const getFinger = (s: number, f: number) => fingers.find(([fs, ff]) => fs === s && ff === f);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[280px] mx-auto">
      {/* Numéros de cases */}
      {Array.from({ length: frets }, (_, i) => (
        <text key={i} x={12} y={topPad + i * cellH + cellH / 2 + 4} className="text-[10px] fill-[var(--ink-faint)]" textAnchor="middle">
          {startFret + i}
        </text>
      ))}

      {/* Indicateurs open/muted */}
      {Array.from({ length: strings }, (_, i) => {
        const sNum = strings - i;
        const x = leftPad + i * cellW;
        const isOpen = openStrings.includes(sNum);
        const isMuted = mutedStrings.includes(sNum);
        return (
          <g key={`top-${sNum}`}>
            {isOpen && <circle cx={x} cy={14} r={6} fill="none" stroke="var(--ink)" strokeWidth={1.5} />}
            {isMuted && <text x={x} y={18} textAnchor="middle" className="text-sm fill-[var(--ink)]">✕</text>}
            <rect x={x - 12} y={2} width={24} height={22} fill="transparent" className="cursor-pointer"
              onClick={() => isOpen ? onToggleMuted(sNum) : isMuted ? onToggleMuted(sNum) : onToggleOpen(sNum)} />
          </g>
        );
      })}

      {/* Sillet */}
      {startFret === 1 && <rect x={leftPad} y={topPad - 4} width={cellW * (strings - 1)} height={4} fill="var(--ink)" />}

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

      {/* Zones cliquables et doigts */}
      {Array.from({ length: strings }, (_, si) => {
        const sNum = strings - si;
        const x = leftPad + si * cellW;
        return Array.from({ length: frets }, (_, fi) => {
          const fNum = startFret + fi;
          const y = topPad + fi * cellH;
          const finger = getFinger(sNum, fNum);
          return (
            <g key={`${sNum}-${fNum}`}>
              {finger && (
                <circle cx={x} cy={y + cellH / 2} r={12} fill="var(--accent)" />
              )}
              <rect x={x - cellW / 2 + 2} y={y + 2} width={cellW - 4} height={cellH - 4} fill="transparent"
                className="cursor-pointer hover:fill-[var(--accent-soft)]" onClick={() => onFretClick(sNum, fNum)} />
            </g>
          );
        });
      })}
    </svg>
  );
}

// Éditeur pour piano
function PianoEditor({ notes, onToggleNote }: { notes: string[]; onToggleNote: (n: string) => void }) {
  const whiteNotes = PIANO_NOTES.filter(n => !n.includes('#'));
  const blackKeyPos = [0.7, 1.7, 3.7, 4.7, 5.7, 7.7, 8.7, 10.7, 11.7, 12.7];
  const wW = 28, wH = 100, bW = 18, bH = 60;
  const width = whiteNotes.length * wW;

  return (
    <svg viewBox={`0 0 ${width} ${wH + 10}`} className="w-full max-w-[400px] mx-auto">
      {whiteNotes.map((note, i) => {
        const active = notes.includes(note);
        return (
          <g key={note}>
            <rect x={i * wW} y={0} width={wW - 1} height={wH} fill={active ? 'var(--accent)' : 'white'}
              stroke="var(--ink-light)" strokeWidth={1} rx={2} className="cursor-pointer" onClick={() => onToggleNote(note)} />
            <text x={i * wW + wW / 2} y={wH - 8} textAnchor="middle"
              className={`text-[8px] pointer-events-none ${active ? 'fill-white' : 'fill-[var(--ink-faint)]'}`}>
              {note.replace(/\d/, '')}
            </text>
          </g>
        );
      })}
      {PIANO_NOTES.filter(n => n.includes('#')).map((note, i) => {
        const active = notes.includes(note);
        const x = blackKeyPos[i] * wW - bW / 2;
        return (
          <rect key={note} x={x} y={0} width={bW} height={bH} fill={active ? 'var(--accent)' : '#333'}
            stroke="var(--ink)" strokeWidth={1} rx={2} className="cursor-pointer" onClick={() => onToggleNote(note)} />
        );
      })}
    </svg>
  );
}
