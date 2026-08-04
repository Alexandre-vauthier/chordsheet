'use client';

import { useEffect, useState } from 'react';

/**
 * Textes et liens de la page de repli, dans la langue de l'utilisateur.
 *
 * Cette page vit hors du routage par langue : elle est mise en cache une seule
 * fois, sous une seule adresse, et ne peut donc pas être rendue en deux versions
 * par le serveur. La langue est choisie ici, au moment de l'affichage.
 *
 * On lit d'abord le cookie de préférence, qui est le choix explicite de la
 * personne, et l'on retombe sur la langue du navigateur. Rien n'est décidé au
 * premier rendu : le serveur n'a ni cookie ni navigateur, et prétendre le
 * contraire ferait diverger le HTML servi de celui que le navigateur reconstruit.
 */

const TEXTES = {
  fr: {
    titre: 'Pas de réseau',
    absente: "Cette page n'a pas encore été ouverte sur cet appareil, elle ne peut donc pas s'afficher sans connexion.",
    reste: 'Tes grilles et tes setlists restent disponibles : passe par ton book ou par l’accueil.',
    book: 'Mon book',
    accueil: 'Accueil',
  },
  en: {
    titre: 'No connection',
    absente: 'This page has not been opened on this device yet, so it cannot be shown offline.',
    reste: 'Your sheets and setlists are still available: go through your book or the home page.',
    book: 'My book',
    accueil: 'Home',
  },
} as const;

function langueChoisie(): 'fr' | 'en' {
  const cookie = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=(fr|en)/)?.[1];
  if (cookie === 'fr' || cookie === 'en') return cookie;
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

export function LiensHorsLigne() {
  const [langue, setLangue] = useState<'fr' | 'en'>('fr');
  useEffect(() => { setLangue(langueChoisie()); }, []);
  const t = TEXTES[langue];

  const lien = {
    padding: '.7rem 1.2rem', borderRadius: '999px', textDecoration: 'none', fontWeight: 600,
  } as const;

  return (
    <>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{t.titre}</h1>
      <p style={{ color: 'var(--ink-light)', margin: 0, lineHeight: 1.6 }}>{t.absente}</p>
      <p style={{ color: 'var(--ink-light)', margin: 0, lineHeight: 1.6 }}>{t.reste}</p>
      <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '.5rem' }}>
        {/* Liens HTML volontaires, pas `next/link` : cette page vit hors du routage
            par langue et doit provoquer un vrai chargement, celui-là même que le
            service worker servira depuis son cache. */}
        <a href={`/${langue}/book`} style={{ ...lien, background: 'var(--accent)', color: '#fff' }}>{t.book}</a>
        <a href={`/${langue}`} style={{ ...lien, border: '1px solid var(--line)', color: 'var(--ink)' }}>{t.accueil}</a>
      </div>
    </>
  );
}
