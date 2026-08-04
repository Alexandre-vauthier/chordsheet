'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker, une fois la page chargée.
 *
 * Après le chargement et non pendant : l'enregistrement se met sinon en
 * concurrence avec le rendu initial, sur la connexion qu'on cherche justement à
 * ménager.
 *
 * En développement, on le retire au contraire. Un service worker qui sert la
 * coque en cache pendant qu'on travaille rend le rechargement mystérieux, et
 * c'est le genre de piège qui coûte une heure avant qu'on y pense.
 */
export function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations()
        .then((rs) => rs.forEach((r) => void r.unregister()))
        .catch(() => {});
      return;
    }

    const enregistrer = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Navigation privée, réglage refusé : l'application marche, sans le hors ligne.
      });
    };

    if (document.readyState === 'complete') enregistrer();
    else {
      window.addEventListener('load', enregistrer);
      return () => window.removeEventListener('load', enregistrer);
    }
  }, []);

  return null;
}
