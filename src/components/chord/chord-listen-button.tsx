'use client';

import { useTranslations } from 'next-intl';
import { playChord } from '@/lib/chord-audio';
import type { InstrumentId, StringChord, PianoChord } from '@/types';

/**
 * Écouter un accord depuis sa page de référence.
 *
 * La page est rendue par le serveur : le son, lui, demande le navigateur. D'où ce
 * petit îlot client, posé à côté du diagramme.
 *
 * Une page qui montre un accord sans le faire entendre s'arrête à mi-chemin :
 * c'est le son qui dit si on a lu le diagramme correctement, et c'est la seule
 * chose qu'un dictionnaire imprimé ne sait pas faire.
 */
export function ChordListenButton({
  chord,
  instrumentId,
}: {
  chord: StringChord | PianoChord;
  instrumentId: InstrumentId;
}) {
  const t = useTranslations('ChordCard');

  return (
    <button
      type="button"
      onClick={() => playChord(chord, instrumentId)}
      title={t('listen')}
      className="flex-shrink-0 flex items-center gap-2.5 h-12 px-5 rounded-full font-medium
        bg-[var(--accent)] text-white shadow-sm
        transition-transform hover:scale-[1.03] active:scale-95"
    >
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
      </svg>
      {t('listenButton')}
    </button>
  );
}
