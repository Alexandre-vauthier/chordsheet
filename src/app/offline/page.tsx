import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Hors ligne' };

/**
 * Ce qu'on voit quand le réseau manque et que la page demandée n'a jamais été
 * ouverte sur cet appareil.
 *
 * Elle dit ce qui reste accessible plutôt que de se contenter d'annoncer la
 * panne : les grilles déjà consultées sont dans le cache de l'appareil, et c'est
 * l'information utile quand on est en cave de répétition.
 */
export default function OfflinePage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '2rem', background: 'var(--paper)' }}>
      <main style={{ maxWidth: '28rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
          Pas de réseau
        </h1>
        <p style={{ color: 'var(--ink-light)', margin: 0, lineHeight: 1.6 }}>
          Cette page n&apos;a pas encore été ouverte sur cet appareil, elle ne peut donc
          pas s&apos;afficher sans connexion.
        </p>
        <p style={{ color: 'var(--ink-light)', margin: 0, lineHeight: 1.6 }}>
          Tes grilles et tes setlists restent disponibles : passe par ton book ou
          par l&apos;accueil.
        </p>
        {/* Lien HTML volontaire, pas `next/link` : cette page vit hors du routage
            par langue et doit provoquer un vrai chargement, celui-là même que le
            service worker servira depuis son cache. */}
        <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '.5rem' }}>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/fr/book"
            style={{
              padding: '.7rem 1.2rem', borderRadius: '999px',
              background: 'var(--accent)', color: '#fff', textDecoration: 'none', fontWeight: 600,
            }}
          >
            Mon book
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/fr"
            style={{
              padding: '.7rem 1.2rem', borderRadius: '999px', border: '1px solid var(--line)',
              color: 'var(--ink)', textDecoration: 'none', fontWeight: 600,
            }}
          >
            Accueil
          </a>
        </div>
      </main>
    </div>
  );
}
