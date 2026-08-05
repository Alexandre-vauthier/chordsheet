'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { playChord, preloadInstrument, prepareInstrument } from '@/lib/chord-audio';
import type { InstrumentId, StringChord, PianoChord } from '@/types';

/**
 * Écouter un accord depuis sa page de référence.
 *
 * La page est rendue par le serveur : le son, lui, demande le navigateur. D'où ce
 * petit îlot client, posé à côté du diagramme.
 *
 * Une page qui montre un accord sans le faire entendre s'arrête à mi-chemin :
 * c'est le son qui dit si on a lu le diagramme correctement, et c'est la seule
 * chose qu'un dictionnaire imprimé ne sait pas faire. Encore faut-il que ce soit
 * le bon son : sans échantillon chargé, l'accord retombe sur l'oscillateur de
 * secours, et une page « accord Mi bémol à la guitare » fait entendre un bip.
 */
export function ChordListenButton({
  chord,
  instrumentId,
}: {
  chord: StringChord | PianoChord;
  instrumentId: InstrumentId;
}) {
  const t = useTranslations('ChordCard');
  const [chargement, setChargement] = useState(false);

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
    // autre chose : c'est le son de l'instrument qu'on est venu vérifier.
    setChargement(true);
    try {
      await prepareInstrument(instrumentId);
    } finally {
      setChargement(false);
    }
    playChord(chord, instrumentId);
  };

  return (
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
  );
}
