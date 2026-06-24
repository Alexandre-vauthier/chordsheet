'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { useArtwork } from '@/lib/use-artwork';

/* ── Helpers ──────────────────────────────────────────────────────── */

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

/* ── Carte de fond ────────────────────────────────────────────────── */

function LandingCard({ sheet }: { sheet: MiniSheet }) {
  const { artworkUrl } = useArtwork(sheet.artist || undefined, sheet.title || undefined);
  const gradient = hashGradient(sheet.title + sheet.artist);
  const isPlaceholder = sheet.id.startsWith('ph-');

  return (
    <Link
      href={isPlaceholder ? '/explore' : `/sheet/${sheet.id}`}
      className="relative block aspect-square rounded-2xl overflow-hidden mb-3 flex-shrink-0 hover:scale-[1.04] hover:shadow-2xl transition-all duration-200"
    >
      {artworkUrl ? (
        <img src={artworkUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <span className="text-white/10 text-5xl font-serif select-none">♪</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 px-2.5 pt-2 pb-2.5 overflow-hidden rounded-b-2xl">
        {artworkUrl && (
          <>
            <img src={artworkUrl} aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-150 blur-[15px] opacity-90 pointer-events-none select-none" />
            <div className="absolute inset-0 bg-black/45 pointer-events-none" />
          </>
        )}
        <div className="relative z-10">
          <p className="text-white font-bold text-xs leading-tight line-clamp-2">{sheet.title || '—'}</p>
          {sheet.artist && <p className="text-white/65 text-[10px] truncate mt-0.5">{sheet.artist}</p>}
        </div>
      </div>
    </Link>
  );
}

function ScrollColumn({ sheets, duration, offsetPx = 0 }: { sheets: MiniSheet[]; duration: number; offsetPx?: number }) {
  const doubled = [...sheets, ...sheets];
  return (
    <div className="flex-1 overflow-hidden" style={{ paddingTop: `${offsetPx}px` }}>
      <div style={{ animation: `scrollUp ${duration}s linear infinite` }}>
        {doubled.map((s, i) => <LandingCard key={`${s.id}-${i}`} sheet={s} />)}
      </div>
    </div>
  );
}

/* ── Navbar ───────────────────────────────────────────────────────── */

function LandingNav({ scrolled }: { scrolled: boolean }) {
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[var(--nav-bg)]/95 backdrop-blur-sm border-b border-white/8' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="font-playfair font-bold text-xl text-[var(--nav-text)]">
          Chord<span className="text-[var(--accent)]">Sheet</span>
        </span>
        <div className="hidden sm:flex items-center gap-7 text-[var(--nav-text)]/65 text-sm">
          <a href="#book" className="hover:text-[var(--nav-text)] transition-colors">Le Book</a>
          <a href="#features" className="hover:text-[var(--nav-text)] transition-colors">Fonctionnalités</a>
          <a href="#how" className="hover:text-[var(--nav-text)] transition-colors">Comment ça marche</a>
          <Link href="/explore" className="hover:text-[var(--nav-text)] transition-colors">Explorer</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-[var(--nav-text)]/65 text-sm hover:text-[var(--nav-text)] transition-colors hidden sm:block px-3 py-2">
            Se connecter
          </Link>
          <Link href="/register" className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            Créer un compte
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ── Données statiques ────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>,
    title: 'Éditeur visuel',
    text: 'Crée ta grille en quelques minutes. Import depuis Ultimate Guitar ou saisie case par case.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>,
    title: 'Mode concert',
    text: 'Défilement automatique plein écran, BPM réglable. Joue sans jamais décrocher les yeux.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>,
    title: 'Transposition',
    text: 'Change de tonalité en un clic. Parfait pour adapter au chanteur ou changer de capo.',
  },
  {
    icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></>,
    title: 'Tous les instruments',
    text: 'Guitare, piano, ukulélé, basse, mandoline — diagrammes d\'accords générés automatiquement.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>,
    title: 'Partage & setlists',
    text: 'Publie tes grilles, partage par lien, organise tes sets pour les concerts.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>,
    title: 'Impression propre',
    text: 'Mise en page optimisée A4 avec diagrammes, répétitions et sections — prête en un clic.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Crée ta grille',
    text: 'Importe depuis Ultimate Guitar, colle des accords texte, ou construis visuellement mesure par mesure. En moins de 2 minutes.',
  },
  {
    n: '02',
    title: 'Organise ton répertoire',
    text: 'Classe par setlist, instrumente, transpose, ajoute des favoris. Ton book de grilles toujours à portée.',
  },
  {
    n: '03',
    title: 'Monte sur scène',
    text: 'Active le mode concert : plein écran, défilement au BPM, boîte à rythmes intégrée. Prêt à jouer.',
  },
];

const PLACEHOLDERS: MiniSheet[] = [
  { id: 'ph-1',  title: 'Wonderwall',               artist: 'Oasis' },
  { id: 'ph-2',  title: 'Hotel California',          artist: 'Eagles' },
  { id: 'ph-3',  title: 'Wish You Were Here',        artist: 'Pink Floyd' },
  { id: 'ph-4',  title: "Knockin' on Heaven's Door", artist: 'Bob Dylan' },
  { id: 'ph-5',  title: 'Black',                     artist: 'Pearl Jam' },
  { id: 'ph-6',  title: 'Angie',                     artist: 'Rolling Stones' },
  { id: 'ph-7',  title: 'No Woman No Cry',           artist: 'Bob Marley' },
  { id: 'ph-8',  title: 'Hallelujah',                artist: 'Leonard Cohen' },
  { id: 'ph-9',  title: 'Tears in Heaven',           artist: 'Eric Clapton' },
  { id: 'ph-10', title: 'More Than Words',           artist: 'Extreme' },
  { id: 'ph-11', title: 'Fast Car',                  artist: 'Tracy Chapman' },
  { id: 'ph-12', title: 'Creep',                     artist: 'Radiohead' },
  { id: 'ph-13', title: 'Yellow',                    artist: 'Coldplay' },
  { id: 'ph-14', title: 'Come As You Are',           artist: 'Nirvana' },
  { id: 'ph-15', title: 'Stand By Me',               artist: 'Ben E. King' },
  { id: 'ph-16', title: 'Use Somebody',              artist: 'Kings of Leon' },
  { id: 'ph-17', title: 'Let Her Go',                artist: 'Passenger' },
  { id: 'ph-18', title: 'Wake Me Up',                artist: 'Avicii' },
  { id: 'ph-19', title: 'Sweet Home Chicago',        artist: 'Robert Johnson' },
  { id: 'ph-20', title: 'La Grange',                 artist: 'ZZ Top' },
];

/* ── Page ─────────────────────────────────────────────────────────── */

export default function Home() {
  const [sheets, setSheets] = useState<MiniSheet[]>(PLACEHOLDERS);
  const [sheetCount, setSheetCount] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const db = getDb();
        const snap = await getDocs(
          query(collection(db, 'sheets'), where('isPublic', '==', true), orderBy('viewCount', 'desc'), limit(40))
        );
        const data = snap.docs.map(d => ({ id: d.id, title: d.data().title || '', artist: d.data().artist || '' }));
        if (data.length >= 12) setSheets(data);
        setSheetCount(snap.size);
      } catch { /* garde les placeholders */ }
    }
    load();
  }, []);

  const cols: MiniSheet[][] = [[], [], [], []];
  sheets.forEach((s, i) => cols[i % 4].push(s));

  return (
    <main className="min-h-screen bg-[var(--nav-bg)] overflow-x-hidden">

      <LandingNav scrolled={scrolled} />

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* Grilles défilantes */}
        <div className="absolute inset-0 flex gap-3 px-3 select-none opacity-55">
          <ScrollColumn sheets={cols[0]} duration={60} offsetPx={-80} />
          <ScrollColumn sheets={cols[1]} duration={78} offsetPx={0} />
          <div className="hidden sm:block flex-1 overflow-hidden" style={{ paddingTop: '-140px' }}>
            <ScrollColumn sheets={cols[2]} duration={95} offsetPx={-140} />
          </div>
          <div className="hidden md:block flex-1 overflow-hidden">
            <ScrollColumn sheets={cols[3]} duration={68} offsetPx={-50} />
          </div>
        </div>

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 65% 70% at 50% 48%, rgba(26,20,16,0.94) 0%, rgba(26,20,16,0.6) 55%, rgba(26,20,16,0.2) 100%)' }}
        />

        {/* Contenu */}
        <div className="relative z-10 text-center px-6 max-w-2xl mx-auto pointer-events-none">
          <p className="text-[var(--accent)] text-xs font-semibold tracking-widest uppercase mb-5">
            La librairie de grilles d&apos;accords
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
          <div className="flex gap-3 justify-center flex-wrap pointer-events-auto">
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
          {sheetCount !== null && sheetCount > 0 && (
            <p className="mt-6 text-[var(--nav-text)]/30 text-xs pointer-events-auto">
              {sheetCount}+ grilles partagées par la communauté
            </p>
          )}
        </div>

        <a href="#features" className="absolute bottom-8 z-10 animate-bounce text-white/25 pointer-events-auto">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </a>
      </section>

      {/* ── Le Book ─────────────────────────────────────────────── */}
      <section id="book" className="px-6 py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Texte */}
            <div>
              <p className="text-[var(--accent)] text-xs font-semibold tracking-widest uppercase mb-4">Le cœur de ChordSheet</p>
              <h2 className="font-playfair text-4xl font-bold text-[var(--nav-text)] mb-5 leading-tight">
                Ton book de grilles d&apos;accords.
              </h2>

              {/* Message clé */}
              <blockquote className="border-l-2 border-[var(--accent)] pl-4 mb-6">
                <p className="text-[var(--nav-text)]/80 text-base italic leading-relaxed">
                  On sait. On a appris des dizaines de morceaux. Mais au moment de jouer — les accords exacts, la tonalité, l&apos;enchaînement — plus vraiment sous la main.
                </p>
                <p className="text-[var(--nav-text)]/45 text-sm mt-2 not-italic">
                  C&apos;est exactement pour ça que le book existe.
                </p>
              </blockquote>

              <p className="text-[var(--nav-text)]/55 text-base leading-relaxed mb-6">
                Le <strong className="text-[var(--nav-text)]/80">book</strong>, c&apos;est ta librairie personnelle. Tu y mets tes propres créations, mais aussi les grilles de la communauté qui t&apos;intéressent. Ton répertoire complet, toujours à portée — pour répéter, improviser ou monter sur scène.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Ajoute n\'importe quelle grille publique en un clic',
                  'Retrouve tout ton répertoire au même endroit',
                  'Organise en setlists pour chaque concert',
                  'Transpose, joue, imprime — sans quitter ton book',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[var(--nav-text)]/60">
                    <svg className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="inline-block px-6 py-3 bg-[var(--accent)] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Créer mon book gratuit →
              </Link>
            </div>

            {/* Visuel — preview stylisée du book */}
            <div className="relative">
              <div className="rounded-2xl border border-white/10 bg-white/4 p-5 space-y-2.5">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                  <span className="text-[var(--nav-text)]/70 text-sm font-semibold">Mon book</span>
                  <span className="ml-auto text-[var(--nav-text)]/30 text-xs">12 grilles</span>
                </div>
                {[
                  { title: 'Wish You Were Here', artist: 'Pink Floyd', tag: 'Ma grille' },
                  { title: 'Wonderwall', artist: 'Oasis', tag: 'Communauté' },
                  { title: 'Hallelujah', artist: 'Leonard Cohen', tag: 'Communauté' },
                  { title: 'Hotel California', artist: 'Eagles', tag: 'Ma grille' },
                ].map((s) => (
                  <div key={s.title} className="flex items-center gap-3 rounded-xl bg-white/4 px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-800 to-indigo-900 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[var(--nav-text)]/85 text-xs font-semibold truncate">{s.title}</p>
                      <p className="text-[var(--nav-text)]/40 text-[10px] truncate">{s.artist}</p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${s.tag === 'Ma grille' ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-white/8 text-[var(--nav-text)]/40'}`}>
                      {s.tag}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 px-3 py-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 shrink-0 flex items-center justify-center text-white/20 text-lg">+</div>
                  <p className="text-[var(--nav-text)]/25 text-xs">Ajoute une grille depuis Explorer…</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ─────────────────────────────────────── */}
      <section id="features" className="px-6 py-24 max-w-5xl mx-auto">
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
        </div>
      </section>

      {/* ── Comment ça marche ───────────────────────────────────── */}
      <section id="how" className="px-6 py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-[var(--nav-text)] text-3xl font-bold mb-2 font-playfair">
            Simple dès le départ.
          </h2>
          <p className="text-center text-[var(--nav-text)]/40 mb-16 text-sm">
            Trois étapes pour passer de zéro à la scène.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.n} className="flex flex-col gap-4">
                <span className="font-playfair text-5xl font-bold text-[var(--accent)]/20 leading-none">{step.n}</span>
                <div>
                  <h3 className="text-[var(--nav-text)] font-bold text-base mb-2">{step.title}</h3>
                  <p className="text-[var(--nav-text)]/50 text-sm leading-relaxed">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-playfair text-4xl font-bold text-[var(--nav-text)] mb-4 leading-tight">
            Prêt à organiser<br />ton répertoire ?
          </h2>
          <p className="text-[var(--nav-text)]/45 text-base mb-8">
            Gratuit, sans carte bancaire. Ton répertoire en ligne en 2 minutes.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/register"
              className="px-7 py-3.5 bg-[var(--accent)] text-white rounded-xl font-semibold text-base hover:opacity-90 transition-opacity shadow-lg shadow-[#c84b2f]/25"
            >
              Créer un compte gratuit
            </Link>
            <Link
              href="/explore"
              className="px-7 py-3.5 border border-white/15 text-[var(--nav-text)]/70 rounded-xl font-semibold text-base hover:border-white/25 hover:text-[var(--nav-text)] transition-colors"
            >
              Voir les grilles
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
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
