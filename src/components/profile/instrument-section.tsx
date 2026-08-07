'use client';

import { useTranslations } from 'next-intl';
import { usePreference } from '@/lib/use-preference';
import { useInstrumentLabel } from '@/lib/use-genre-labels';
import { useChordVariants } from '@/lib/use-chord-variants';
import { ChordDiagram } from '@/components/chord/chord-diagram';
import { PianoKeyboard } from '@/components/chord/piano-keyboard';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import type { InstrumentId, PianoChord, StringChord } from '@/types';

const INSTRUMENTS: InstrumentId[] = ['guitar', 'ukulele', 'piano', 'mandolin', 'banjo', 'bass', 'voice'];

/** Le même accord partout : c'est la comparaison qui apprend quelque chose. */
const TEMOIN = 'Am';

const estPiano = (c: StringChord | PianoChord): c is PianoChord => Array.isArray((c as PianoChord).notes);

/**
 * L'instrument de prédilection, en vignettes.
 *
 * Sa propre rubrique parce qu'il commande le reste : les diagrammes affichés, les
 * sons de la lecture, la bibliothèque consultée. Et parce qu'il porte la meilleure
 * illustration possible — le même accord dessiné pour chaque instrument dit en un
 * coup d'œil ce qu'aucune liste de noms ne dirait.
 */
export function InstrumentSection() {
  const t = useTranslations('Profile');
  const label = useInstrumentLabel();
  const { valeur, definir, echec, reessayer } = usePreference('preferredInstrument');

  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {INSTRUMENTS.map((id) => (
          <Vignette
            key={id}
            id={id}
            label={label(id)}
            choisi={valeur === id}
            onChoisir={() => void definir(id)}
          />
        ))}
      </div>
      {echec && (
        <p className="mt-3 text-xs text-red-600">
          {t('saveFailed')}{' '}
          <button type="button" onClick={reessayer} className="underline hover:no-underline cursor-pointer">
            {t('retry')}
          </button>
        </p>
      )}
    </div>
  );
}

function Vignette({
  id,
  label,
  choisi,
  onChoisir,
}: {
  id: InstrumentId;
  label: string;
  choisi: boolean;
  onChoisir: () => void;
}) {
  const variantes = useChordVariants(TEMOIN, id);
  const forme = variantes[0] ?? null;
  const cordes = INSTRUMENT_CONFIG[id]?.strings ?? 6;

  return (
    <button
      type="button"
      onClick={onChoisir}
      aria-pressed={choisi}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-colors cursor-pointer ${
        choisi
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
          : 'border-[var(--line)] hover:border-[var(--ink-faint)]'
      }`}
    >
      <div className="h-14 flex items-center justify-center">
        {/* La voix n'a pas de diagramme : une portée vide ferait croire à un
            dessin manquant. Elle montre donc ce qu'elle affiche vraiment, des
            paroles. */}
        {id === 'voice' ? (
          <span className="text-[10px] leading-tight text-[var(--ink-faint)] italic text-center">
            ♪ la la<br />la la la
          </span>
        ) : forme && estPiano(forme) ? (
          <PianoKeyboard chord={forme} />
        ) : forme ? (
          <ChordDiagram chord={forme} size="xs" numStrings={cordes} />
        ) : null}
      </div>
      <span className={`text-xs font-medium ${choisi ? 'text-[var(--accent)]' : 'text-[var(--ink-light)]'}`}>
        {label}
      </span>
    </button>
  );
}
