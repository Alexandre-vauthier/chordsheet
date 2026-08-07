'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Fermer un menu quand on clique ailleurs, ou qu'on appuie sur Échap.
 *
 * Le même effet était recopié à neuf endroits, plus une abstraction locale dans
 * les menus de lecture. Les copies avaient dérivé les unes des autres : certaines
 * posent l'écouteur en permanence, d'autres seulement à l'ouverture ; certaines
 * dépendent d'une fonction recréée à chaque rendu, ce qui réattache l'écouteur en
 * boucle. **Et aucune ne gère la touche Échap**, si bien qu'un menu ouvert ne se
 * ferme pas au clavier, où qu'on soit dans l'application.
 *
 * Un seul endroit, donc, et la touche donnée à tout le monde d'un coup.
 *
 * `enabled` à faux ne pose aucun écouteur : un menu fermé n'a rien à écouter, et
 * plusieurs appelants le faisaient déjà à la main.
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  enabled = true,
): RefObject<T | null> {
  const ref = useRef<T>(null);

  /**
   * La fermeture passe par une référence, et non par la liste de dépendances.
   *
   * Les appelants écrivent presque toujours une fonction fléchée sur place. La
   * mettre en dépendance ferait poser et retirer l'écouteur à chaque rendu du
   * composant — c'est ce que faisait la version d'origine.
   */
  const fermer = useRef(onClose);
  useEffect(() => { fermer.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!enabled) return;

    const auClic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fermer.current();
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer.current();
    };

    document.addEventListener('mousedown', auClic);
    document.addEventListener('keydown', auClavier);
    return () => {
      document.removeEventListener('mousedown', auClic);
      document.removeEventListener('keydown', auClavier);
    };
  }, [enabled]);

  return ref;
}
