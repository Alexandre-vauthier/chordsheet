'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { chordDurationMs, playChord, preloadInstrument, prepareInstrument } from '@/lib/chord-audio';
import type { InstrumentId, StringChord, PianoChord } from '@/types';

/**
 * Un diagramme, son bouton d'écoute, et le balayage qui accompagne le son.
 *
 * La page est rendue par le serveur ; le son et l'animation demandent le
 * navigateur. Le diagramme lui-même arrive donc en enfant, déjà rendu, et ce
 * composant n'ajoute que ce qui bouge.
 *
 * Le balayage reprend celui des cellules d'une grille en cours de lecture : même
 * animation, même teinte. Il dit deux choses qu'un bouton seul ne dit pas — que le
 * clic a été pris en compte, et combien de temps l'accord sonne encore.
 */
export function ChordDiagramCard({
  chord,
  instrumentId,
  children,
}: {
  chord: StringChord | PianoChord;
  instrumentId: InstrumentId;
  children: React.ReactNode;
}) {
  const t = useTranslations('ChordCard');
  const [chargement, setChargement] = useState(false);
  /**
   * Le rang du balayage en cours.
   *
   * Il sert de clé : recliquer pendant qu'il court doit le reprendre depuis la
   * gauche, et une animation CSS ne redémarre que si son élément est remplacé.
   */
  const [balayage, setBalayage] = useState(0);
  const duree = chordDurationMs(instrumentId);

  /**
   * L'échantillon se télécharge dès la page ouverte, mais une fois le navigateur
   * tranquille : la page doit s'afficher d'abord, le son n'est utile qu'au clic.
   */
  useEffect(() => {
    const lancer = () => preloadInstrument(instrumentId);
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) {
      const id = ric(lancer, { timeout: 3000 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const id = setTimeout(lancer, 1200);
    return () => clearTimeout(id);
  }, [instrumentId]);

  const ecouter = async () => {
    // Cliquer avant la fin du téléchargement doit faire attendre, pas faire entendre
    // autre chose : c'est le son de l'instrument qu'on est venu vérifier. Le
    // balayage ne part qu'avec le son, sinon il annoncerait un accord qui se tait.
    setChargement(true);
    try {
      await prepareInstrument(instrumentId);
    } finally {
      setChargement(false);
    }
    playChord(chord, instrumentId);
    setBalayage((n) => n + 1);
  };

  return (
    <div className="flex items-center gap-5">
      <div className="relative overflow-hidden p-4 rounded-xl border border-[var(--line)] bg-[var(--cell-bg)]">
        {balayage > 0 && (
          <div
            key={balayage}
            className="absolute inset-0 origin-left pointer-events-none"
            style={{
              background: 'color-mix(in srgb, var(--accent) 13%, transparent)',
              animation: `beatSweep ${duree}ms linear forwards`,
            }}
            onAnimationEnd={() => setBalayage(0)}
          />
        )}
        <div className="relative">{children}</div>
      </div>

      <button
        type="button"
        onClick={ecouter}
        onPointerEnter={() => preloadInstrument(instrumentId)}
        onFocus={() => preloadInstrument(instrumentId)}
        title={t('listen')}
        className="flex-shrink-0 flex items-center gap-2.5 h-12 px-5 rounded-full font-medium
          bg-[var(--accent)] text-white shadow-sm
          transition-transform hover:scale-[1.03] active:scale-95"
      >
        {chargement ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
            <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        )}
        {t('listenButton')}
      </button>
    </div>
  );
}
