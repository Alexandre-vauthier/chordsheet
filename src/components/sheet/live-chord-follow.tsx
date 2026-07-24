'use client';

// Suivi micro dans la consultation d'une grille (étape 1 : surlignage, sans
// suivi de position). Bouton REC flottant → micro → accord détecté → on surligne
// toutes les cellules dont l'accord correspond.
// L'écoute vit dans CE composant isolé : ses mises à jour ~10 Hz ne re-rendent
// pas tout le sheet-viewer. Le surlignage se fait par le DOM (toggle de classe
// sur les cellules porteuses de data-chord), pas via React.

import { useEffect } from 'react';
import { useChordListener } from '@/lib/use-chord-listener';
import { chordsMatch } from '@/lib/chord-match';

export function LiveChordFollow() {
  const { listening, chord, start, stop, error } = useChordListener();

  useEffect(() => {
    const cells = document.querySelectorAll<HTMLElement>('[data-chord]');
    cells.forEach((el) => {
      const match = listening && !!chord && chordsMatch(chord, el.dataset.chord || '');
      el.classList.toggle('chord-detected', match);
    });
    return () => {
      document
        .querySelectorAll<HTMLElement>('.chord-detected')
        .forEach((el) => el.classList.remove('chord-detected'));
    };
  }, [chord, listening]);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-end gap-3 print:hidden">
      {listening && (
        <div className="px-3 py-2 rounded-xl bg-[var(--cream)] border border-[var(--line)] shadow-lg text-center min-w-[68px]">
          <div className="text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">Écoute</div>
          <div className="text-xl font-bold text-[var(--ink)] leading-tight min-h-[1.75rem]">
            {chord || '…'}
          </div>
        </div>
      )}

      <div className="relative">
        {error && (
          <div className="absolute bottom-full mb-2 right-0 whitespace-nowrap text-xs text-red-500 bg-[var(--cream)] border border-[var(--line)] rounded-lg px-2 py-1 shadow">
            Micro indisponible
          </div>
        )}
        <button
          onClick={listening ? stop : start}
          title={listening ? 'Arrêter le suivi micro' : 'Suivre au micro — surligne l’accord joué'}
          className={`flex items-center gap-2 h-12 px-4 rounded-full shadow-lg font-semibold text-white transition-colors ${
            listening ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--accent)] hover:bg-[#a83d25]'
          }`}
        >
          <span className={`w-3 h-3 rounded-full bg-white ${listening ? 'animate-pulse' : ''}`} />
          <span className="text-sm">{listening ? 'Stop' : 'REC'}</span>
        </button>
      </div>
    </div>
  );
}
