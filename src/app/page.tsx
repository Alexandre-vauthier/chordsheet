'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

const GRADIENTS = [
  'from-rose-900 via-red-800 to-orange-900',
  'from-violet-900 via-purple-800 to-fuchsia-900',
  'from-cyan-900 via-teal-800 to-emerald-900',
  'from-amber-900 via-orange-800 to-red-900',
  'from-indigo-900 via-blue-800 to-sky-900',
  'from-emerald-900 via-green-800 to-teal-900',
  'from-pink-900 via-rose-800 to-red-900',
  'from-sky-900 via-blue-800 to-indigo-900',
];

function hashGradient(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

interface MiniSheet { id: string; title: string; artist: string; }

function MiniCard({ sheet }: { sheet: MiniSheet }) {
  const gradient = hashGradient((sheet.title) + (sheet.artist));
  return (
    <div className={`aspect-square rounded-xl overflow-hidden mb-3 flex-shrink-0 bg-gradient-to-br ${gradient} relative`}>
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
        <p className="text-white text-xs font-bold truncate leading-tight">{sheet.title || '—'}</p>
        {sheet.artist && <p className="text-white/60 text-[10px] truncate mt-0.5">{sheet.artist}</p>}
      </div>
    </div>
  );
}

function ScrollColumn({ sheets, duration, offsetPx = 0 }: { sheets: MiniSheet[]; duration: number; offsetPx?: number }) {
  const doubled = [...sheets, ...sheets];
  return (
    <div className="flex-1 overflow-hidden" style={{ paddingTop: `${offsetPx}px` }}>
      <div style={{ animation: `scrollUp ${duration}s linear infinite` }}>
        {doubled.map((s, i) => <MiniCard key={`${s.id}-${i}`} sheet={s} />)}
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>,
    title: 'Éditeur visuel',
    text: 'Crée ta grille en quelques minutes. Import depuis Ultimate Guitar ou saisie case par case.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>,
    title: 'Mode concert',
    text: 'Défilement automatique plein écran avec BPM réglable. Joue sans jamais décrocher les yeux.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>,
    title: 'Transposition instantanée',
    text: 'Change de tonalité en un clic. Idéal pour adapter au chanteur ou jouer avec un capo.',
  },
  {
    icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></>,
    title: 'Tous les instruments',
    text: 'Guitare, piano, ukulélé, basse, mandoline — avec diagrammes d\'accords générés automatiquement.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>,
    title: 'Partage & setlists',
    text: 'Publie tes grilles, partage par lien, organise tes sets pour les concerts.',
  },
];

// Placeholders pour l'animation avant chargement Firestore
const PLACEHOLDERS: MiniSheet[] = [
  { id: 'p1', title: 'Wonderwall', artist: 'Oasis' },
  { id: 'p2', title: 'Hotel California', artist: 'Eagles' },
  { id: 'p3', title: 'Wish You Were Here', artist: 'Pink Floyd' },
  { id: 'p4', title: 'Knockin\' on Heaven\'s Door', artist: 'Bob Dylan' },
  { id: 'p5', title: 'Sweet Home Chicago', artist: 'Robert Johnson' },
  { id: 'p6', title: 'La Grange', artist: 'ZZ Top' },
  { id: 'p7', title: 'Black', artist: 'Pearl Jam' },
  { id: 'p8', title: 'Angie', artist: 'Rolling Stones' },
  { id: 'p9', title: 'No Woman No Cry', artist: 'Bob Marley' },
  { id: 'p10', title: 'Hallelujah', artist: 'Leonard Cohen' },
  { id: 'p11', title: 'Tears in Heaven', artist: 'Eric Clapton' },
  { id: 'p12', title: 'More Than Words', artist: 'Extreme' },
  { id: 'p13', title: 'Fast Car', artist: 'Tracy Chapman' },
  { id: 'p14', title: 'Creep', artist: 'Radiohead' },
  { id: 'p15', title: 'Wake Me Up', artist: 'Avicii' },
  { id: 'p16', title: 'Use Somebody', artist: 'Kings of Leon' },
  { id: 'p17', title: 'Yellow', artist: 'Coldplay' },
  { id: 'p18', title: 'Come As You Are', artist: 'Nirvana' },
  { id: 'p19', title: 'Stand By Me', artist: 'Ben E. King' },
  { id: 'p20', title: 'Let Her Go', artist: 'Passenger' },
];

export default function Home() {
  const [sheets, setSheets] = useState<MiniSheet[]>(PLACEHOLDERS);

  useEffect(() => {
    async function load() {
      try {
        const db = getDb();
        const snap = await getDocs(
          query(collection(db, 'sheets'), where('isPublic', '==', true), orderBy('viewCount', 'desc'), limit(40))
        );
        const data = snap.docs.map(d => ({ id: d.id, title: d.data().title || '', artist: d.data().artist || '' }));
        if (data.length >= 12) setSheets(data);
      } catch {
        // garde les placeholders
      }
    }
    load();
  }, []);

  // Répartir sur 4 colonnes
  const cols: MiniSheet[][] = [[], [], [], []];
  sheets.forEach((s, i) => cols[i % 4].push(s));

  return (
    <main className="min-h-screen bg-[var(--nav-bg)] overflow-x-hidden">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* Grilles défilantes */}
        <div className="absolute inset-0 flex gap-3 px-3 pointer-events-none select-none opacity-35">
          <ScrollColumn sheets={cols[0]} duration={34} offsetPx={-80} />
          <ScrollColumn sheets={cols[1]} duration={27} offsetPx={0} />
          <ScrollColumn sheets={cols[2]} duration={40} offsetPx={-140} />
          <ScrollColumn sheets={cols[3]} duration={31} offsetPx={-50} />
        </div>

        {/* Vignette radiale — assombrit le centre pour la lisibilité */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 65% 70% at 50% 48%, rgba(26,20,16,0.92) 0%, rgba(26,20,16,0.55) 55%, rgba(26,20,16,0.15) 100%)' }}
        />

        {/* Contenu hero */}
        <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
          <p className="text-[var(--accent)] text-sm font-semibold tracking-widest uppercase mb-4">
            Pour les musiciens
          </p>
          <h1 className="font-playfair text-6xl sm:text-7xl font-bold text-[var(--nav-text)] mb-5 tracking-tight leading-none">
            Chord<span className="text-[var(--accent)]">Sheet</span>
          </h1>
          <p className="text-[var(--nav-text)]/70 text-xl sm:text-2xl mb-3 font-light leading-snug">
            Crée, partage et joue tes grilles d&apos;accords.
          </p>
          <p className="text-[var(--nav-text)]/40 text-sm mb-10 max-w-md mx-auto">
            L&apos;outil qu&apos;il manquait pour organiser ton répertoire, répéter et monter sur scène.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/register"
              className="px-7 py-3.5 bg-[var(--accent)] text-white rounded-xl font-semibold text-base hover:opacity-90 transition-opacity shadow-lg shadow-[#c84b2f]/30"
            >
              Créer un compte gratuit
            </Link>
            <Link
              href="/explore"
              className="px-7 py-3.5 bg-white/8 text-[var(--nav-text)] rounded-xl font-semibold text-base hover:bg-white/12 transition-colors border border-white/10"
            >
              Explorer les grilles
            </Link>
          </div>
        </div>

        {/* Flèche scroll */}
        <div className="absolute bottom-8 z-10 animate-bounce text-white/25">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </section>

      {/* ── Fonctionnalités ───────────────────────────────────── */}
      <section className="relative z-10 px-6 py-20 max-w-5xl mx-auto">
        <h2 className="text-center text-[var(--nav-text)] text-3xl font-bold mb-2 font-playfair">
          Tout ce qu&apos;il faut pour jouer.
        </h2>
        <p className="text-center text-[var(--nav-text)]/40 mb-14 text-sm">
          De la création à la scène, sans friction.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 flex flex-col gap-3 hover:bg-white/6 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center text-[var(--accent)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{f.icon}</svg>
              </div>
              <div>
                <h3 className="text-[var(--nav-text)] font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-[var(--nav-text)]/50 text-sm leading-relaxed">{f.text}</p>
              </div>
            </div>
          ))}

          {/* CTA card */}
          <div className="rounded-2xl bg-[var(--accent)] px-5 py-5 flex flex-col justify-between">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Prêt à démarrer ?</p>
              <h3 className="text-white font-bold text-xl mb-2 font-playfair leading-tight">C&apos;est gratuit.</h3>
              <p className="text-white/70 text-sm leading-relaxed">Aucune carte bancaire requise. Ton répertoire en ligne en 2 minutes.</p>
            </div>
            <Link
              href="/register"
              className="mt-6 inline-block text-center bg-white text-[var(--accent)] px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Créer mon compte →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="text-center py-8 text-[var(--nav-text)]/25 text-xs border-t border-white/5">
        <div className="flex justify-center gap-6 mb-2">
          <Link href="/legal/cgu" className="hover:text-[var(--nav-text)]/50 transition-colors">CGU</Link>
          <Link href="/legal/confidentialite" className="hover:text-[var(--nav-text)]/50 transition-colors">Confidentialité</Link>
          <Link href="/legal/mentions-legales" className="hover:text-[var(--nav-text)]/50 transition-colors">Mentions légales</Link>
        </div>
        © {new Date().getFullYear()} ChordSheet
      </footer>
    </main>
  );
}
