'use client';

import { useEffect } from 'react';

/**
 * Hors ligne, naviguer par un vrai chargement de page.
 *
 * En temps normal l'application navigue côté client : au clic, le routeur demande
 * au serveur une charge dédiée plutôt que le HTML. Cette charge dépend de l'état
 * de navigation du moment, si bien qu'on ne peut pas la préparer d'avance de
 * façon fiable — la préparer quand même donnait « This page couldn't load » sur
 * toutes les grilles, alors que leur HTML était pourtant en cache.
 *
 * On contourne le problème au lieu de le combattre : sans réseau, un clic sur un
 * lien interne provoque un chargement de page complet, celui-là même que le
 * service worker sait servir depuis son cache. C'est moins élégant qu'une
 * navigation instantanée, mais c'est la différence entre une grille qui s'ouvre
 * et une erreur.
 *
 * En ligne, ce composant ne fait rien : la navigation ordinaire reprend.
 */

/** Un clic que le navigateur traite lui-même : on n'y touche pas. */
function clicOrdinaire(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function NavigationHorsLigne() {
  useEffect(() => {
    const auClic = (e: MouseEvent) => {
      if (navigator.onLine || e.defaultPrevented || !clicOrdinaire(e)) return;

      const lien = (e.target as Element | null)?.closest?.('a');
      if (!lien) return;

      const href = lien.getAttribute('href');
      if (!href || lien.hasAttribute('download') || lien.target === '_blank') return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;

      // Une ancre sur la page courante n'a pas à recharger quoi que ce soit.
      if (url.pathname === window.location.pathname && url.hash) return;

      e.preventDefault();
      window.location.assign(url.href);
    };

    // En capture : le routeur pose son propre écouteur, et on veut décider avant lui.
    document.addEventListener('click', auClic, true);
    return () => document.removeEventListener('click', auClic, true);
  }, []);

  return null;
}
