'use client';

import { useRef } from 'react';
import type { InstrumentId } from '@/types';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import { useInstrumentLabel } from '@/lib/use-genre-labels';
import { InstrumentIcon } from './instrument-icon';

/**
 * Le choix de l'instrument.
 *
 * C'était un `<select>` natif, et c'est ce qui imposait les emoji : un `<option>`
 * ne peut contenir que du texte. Or Unicode n'a ni ukulélé, ni mandoline, ni
 * basse — le ukulélé portait donc l'emoji du banjo, la basse celle de la guitare,
 * et deux entrées du menu étaient impossibles à distinguer.
 *
 * Une rangée de boutons lève la contrainte, et montre les sept instruments d'un
 * coup au lieu d'en cacher six derrière un menu.
 *
 * Sémantique : un groupe de boutons radio, et non sept bascules. La différence
 * s'entend — un lecteur d'écran annonce « Guitare, 1 sur 7 » et non « Guitare,
 * activé ». Le clavier suit la même convention : un seul arrêt de tabulation pour
 * le groupe, les flèches pour circuler dedans, exactement ce que faisait le
 * `<select>` qu'on remplace.
 */
interface InstrumentSelectorProps {
  value: InstrumentId;
  onChange: (instrument: InstrumentId) => void;
  exclude?: InstrumentId[];
  /**
   * Écrire le nom sous chaque pictogramme.
   *
   * Coupé par défaut, et ce n'est pas un détail : les deux barres d'outils qui
   * portent ce sélecteur — l'en-tête de l'éditeur et celui du lecteur — sont déjà
   * pleines, et sept libellés y prendraient plus de quatre cents pixels. Le nom
   * reste accessible dans tous les cas, par l'infobulle et par le nom accessible
   * du bouton ; c'est seulement l'écriture permanente qui est optionnelle.
   */
  avecLibelle?: boolean;
}

export function InstrumentSelector({
  value,
  onChange,
  exclude = [],
  avecLibelle = false,
}: InstrumentSelectorProps) {
  const instrumentLabel = useInstrumentLabel();
  const groupe = useRef<HTMLDivElement>(null);
  const instruments = Object.values(INSTRUMENT_CONFIG).filter((i) => !exclude.includes(i.id));

  /**
   * Les flèches déplacent la sélection, et non le seul focus.
   *
   * C'est le comportement d'un groupe de boutons radio, et celui du `<select>`
   * d'avant : on parcourt les valeurs, chaque arrêt vaut choix. Le parcours boucle
   * pour qu'on atteigne le dernier instrument depuis le premier.
   */
  const auClavier = (e: React.KeyboardEvent, index: number) => {
    const pas = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1
      : e.key === 'Home' ? -index
      : e.key === 'End' ? instruments.length - 1 - index
      : 0;
    if (pas === 0) return;
    e.preventDefault();
    const cible = (index + pas + instruments.length) % instruments.length;
    onChange(instruments[cible].id);
    groupe.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[cible]?.focus();
  };

  return (
    <div
      ref={groupe}
      role="radiogroup"
      aria-label={instrumentLabel(value)}
      /* Défilement plutôt que retour à la ligne : le composant vit dans deux
         barres d'outils déjà chargées, et une seconde ligne y décalerait tout le
         reste. La barre de défilement est masquée, le débordement se voit à la
         tuile coupée. */
      className="flex gap-1 overflow-x-auto snap-x overscroll-x-contain
        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {instruments.map((inst, index) => {
        const actif = inst.id === value;
        const libelle = instrumentLabel(inst.id);
        return (
          <button
            key={inst.id}
            type="button"
            role="radio"
            aria-checked={actif}
            /* Un seul arrêt de tabulation pour le groupe : on y entre sur la
               valeur courante, on en sort d'une seule tabulation. */
            tabIndex={actif ? 0 : -1}
            onClick={() => onChange(inst.id)}
            onKeyDown={(e) => auClavier(e, index)}
            title={libelle}
            className={`snap-start shrink-0 flex flex-col items-center gap-0.5 rounded-lg
              ${avecLibelle ? 'px-2 py-1.5' : 'p-1.5'}
              border cursor-pointer transition-colors
              ${actif
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                : 'border-transparent text-[var(--ink-light)] hover:bg-[var(--cell-hover)]'}`}
          >
            <InstrumentIcon id={inst.id} className={avecLibelle ? 'w-7 h-7' : 'w-6 h-6'} />
            {avecLibelle && (
              <span className="text-[11px] leading-none whitespace-nowrap">{libelle}</span>
            )}
            {/* Le nom accessible ne dépend jamais de la place disponible. */}
            <span className="sr-only">{libelle}</span>
          </button>
        );
      })}
    </div>
  );
}
