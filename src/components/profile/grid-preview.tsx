'use client';

import { useTranslations } from 'next-intl';
import { ChordDiagram } from '@/components/chord/chord-diagram';
import { PianoKeyboard } from '@/components/chord/piano-keyboard';
import { useChordVariants } from '@/lib/use-chord-variants';
import { getChordColor } from '@/lib/use-chord-color';
import { usePreference } from '@/lib/use-preference';
import { INSTRUMENT_CONFIG, translateChordName } from '@/lib/chord-data';
import type { InstrumentId, PianoChord, StringChord } from '@/types';

/** Le piano n'a pas de manche : il se reconnaît à ses notes. */
const estPiano = (c: StringChord | PianoChord): c is PianoChord => Array.isArray((c as PianoChord).notes);

/** Une suite d'accords ordinaire, choisie pour montrer une couleur par fondamentale. */
const ACCORDS = ['Am', 'F', 'C', 'G'];

/**
 * Une mesure d'exemple, qui suit les réglages d'affichage en direct.
 *
 * Trois réglages deviennent lisibles sans être lus : on bascule le code couleur et
 * la barre colorée apparaît, on bascule le diagramme et le manche entre dans la
 * case, on passe en notation française et `Am` devient `Lam`. Elle change aussi
 * d'instrument quand on change d'instrument, ce qui relie deux rubriques.
 *
 * Rien de neuf n'est dessiné : la case reprend les classes de la vraie cellule de
 * grille, la couleur vient de `getChordColor`, le diagramme de la bibliothèque.
 * Une maquette qui se contenterait de ressembler finirait par mentir.
 */
export function GridPreview() {
  const t = useTranslations('Profile');
  const couleurs = usePreference('chordColorCoding').valeur;
  const diagrammes = usePreference('showInlineDiagram').valeur;
  const notation = usePreference('notationPreference').valeur;
  const instrument = (usePreference('preferredInstrument').valeur ?? 'guitar') as InstrumentId;

  return (
    <div className="px-5 py-4 sm:px-6 bg-[var(--cell-hover)]">
      <p className="text-[11px] uppercase tracking-wide text-[var(--ink-faint)] mb-2">
        {t('previewLabel')}
      </p>
      <div className="grid grid-cols-4 gap-1">
        {ACCORDS.map((accord) => (
          <Case
            key={accord}
            accord={accord}
            instrument={instrument}
            couleurs={!!couleurs}
            diagrammes={!!diagrammes}
            notation={notation === 'french' ? 'french' : 'american'}
          />
        ))}
      </div>
    </div>
  );
}

function Case({
  accord,
  instrument,
  couleurs,
  diagrammes,
  notation,
}: {
  accord: string;
  instrument: InstrumentId;
  couleurs: boolean;
  diagrammes: boolean;
  notation: 'american' | 'french';
}) {
  const variantes = useChordVariants(accord, instrument);
  const forme = variantes[0] ?? null;
  const couleur = couleurs ? getChordColor(accord) : null;
  const cordes = INSTRUMENT_CONFIG[instrument]?.strings ?? 6;

  return (
    <div
      style={couleur ? { borderColor: couleur.border, borderLeftWidth: '5px' } : undefined}
      className="rounded-lg border-2 border-[var(--line)] bg-[var(--cell-bg)] min-h-12
        flex flex-col items-center justify-center gap-1 py-1.5"
    >
      <span className="font-mono text-sm font-medium text-[var(--ink)]">
        {translateChordName(accord, notation)}
      </span>
      {diagrammes && forme && (
        estPiano(forme)
          ? <PianoKeyboard chord={forme} />
          : <ChordDiagram chord={forme} size="xs" numStrings={cordes} />
      )}
    </div>
  );
}
