'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useArtwork } from '@/lib/use-artwork';
import { ColonneDefilante, type CouvertureMini } from '@/components/explore/artwork-wall';
import { playPreviewAudio, stopPreviewAudio } from '@/lib/preview-audio';
import { useCardTilt } from '@/lib/use-card-tilt';
import { useAuth } from '@/lib/auth-context';
import { Link } from '@/i18n/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { SheetShowcase } from '@/components/landing/sheet-showcase';
import type { ChiffresDuCatalogue, GrilleEnAvant } from '@/lib/landing-data';
import { HomeJsonLd } from './home-json-ld';

/**
 * Le bac à sable tire la bibliothèque d'accords et le moteur audio : de loin le plus
 * gros morceau de code de cette page, pour une section que beaucoup ne feront que
 * survoler. On ne le charge qu'une fois la section approchée.
 */
const TryEditor = dynamic(
  () => import('@/components/landing/try-editor').then(m => m.TryEditor),
  { ssr: false, loading: () => <div className="h-[420px] rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" /> },
);

/**
 * Rend ses enfants une fois la zone approchée, et le reste ensuite définitivement.
 *
 * L'observateur est branché par une ref-fonction plutôt que par un effet : il n'y a
 * rien à synchroniser avec un rendu, juste un nœud à observer dès qu'il existe.
 */
function WhenNear({ children }: { children: React.ReactNode }) {
  const [proche, setProche] = useState(false);

  const observer = useCallback((el: HTMLDivElement | null) => {
    if (!el || proche) return;
    // Sans IntersectionObserver (navigateur ancien), on charge tout de suite plutôt
    // que de ne jamais rien afficher.
    if (typeof IntersectionObserver === 'undefined') { setProche(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setProche(true); },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [proche]);

  return <div ref={observer}>{proche ? children : null}</div>;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

type MiniSheet = CouvertureMini;

/**
 * Où mène une pochette du mur.
 *
 * Les remplissages (`ph-…`) ne désignent aucune grille : ils renvoient à la
 * découverte plutôt que vers une page qui n'existe pas.
 */
const lienDeCouverture = (sheet: MiniSheet) =>
  sheet.id.startsWith('ph-') ? '/explore' : `/sheet/${sheet.id}`;

// La carte et la colonne défilantes vivent dans `@/components/explore/artwork-wall` :
// le hero de la découverte s'en sert aussi, et deux versions du même mur auraient
// divergé au premier ajustement. Les titres/artistes affichés sont du contenu
// utilisateur — jamais traduits, quelle que soit la langue de l'interface.

// Les CTA d'authentification sont masqués tant que l'état de connexion n'est pas
// résolu : sans ça un utilisateur déjà connecté voit « Créer un compte » clignoter
// avant le bon libellé. `pointer-events-none` évite un clic sur un bouton invisible.
const ctaFade = (loading: boolean) =>
  loading ? 'opacity-0 pointer-events-none' : 'opacity-100';

/* ── Tuile de fonctionnalité ──────────────────────────────────────── */

/**
 * Une fonctionnalité de l'accueil, avec l'inclinaison des cartes d'Explore.
 *
 * L'amplitude descend de 18 à 9 degrés : le réglage d'Explore est fait pour une
 * carte carrée, et sur une tuile large le même angle bascule beaucoup trop. Le
 * reflet et le foil, eux, sont exactement ceux des cartes.
 *
 * Les deux calques décoratifs sont en `pointer-events-none`, sans quoi ils
 * mangeraient le clic sur la tuile entière.
 */
function FeatureTile({ href, icon, title, text, learnMore }: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  learnMore: string;
}) {
  const tilt = useCardTilt<HTMLDivElement>(9);

  return (
    <div className="sheet-card-wrap h-full" {...tilt}>
      <Link
        href={href}
        className="sheet-card-inner relative overflow-hidden h-full rounded-2xl border border-white/8 bg-white/4
          px-5 py-5 flex flex-col gap-3 group/feat hover:border-[var(--accent)]/40"
      >
        {/* Au-dessus du halo : les deux calques sont peints apres le contenu, et le
            foil en `color-dodge` delavait la pastille comme le lien. Tous deux passent
            devant, en aplat plein — a 15 % d'opacite la pastille disparaissait sous le
            reflet. Le titre et le texte restent dessous : c'est ce passage de lumiere
            sur eux qui fait l'effet. */}
        <div className="relative z-10 w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
        </div>

        {/* `flex-1` pousse le lien en bas de la tuile. Les tuiles d'une meme rangee ont
            la meme hauteur, le lien se retrouve donc au meme niveau sur toutes. */}
        <div className="flex-1">
          <h3 className="text-[var(--nav-text)] font-semibold text-sm mb-1">{title}</h3>
          <p className="text-[var(--nav-text)]/50 text-sm leading-relaxed">{text}</p>
        </div>

        {/* Revele par l'opacite et non par l'affichage : la place reste prise, sinon
            le survol ferait grandir la tuile et sauter la rangee entiere. */}
        <span className="relative z-10 self-start px-3 py-1 rounded-full bg-[var(--accent)] text-white
          text-xs font-medium opacity-0 group-hover/feat:opacity-100 transition-opacity">
          {learnMore} →
        </span>
        <div className="card-shine absolute inset-0 rounded-2xl pointer-events-none" />
        <div className="card-foil absolute inset-0 rounded-2xl pointer-events-none" />
      </Link>
    </div>
  );
}

/* ── Ligne du book ────────────────────────────────────────────────── */

/**
 * Une entrée du book illustré, avec sa vraie pochette et son extrait.
 *
 * Le bloc montrait quatre carrés violets identiques : on annonçait un book de
 * morceaux avec un visuel qui n'en contenait aucun. La pochette et l'extrait de
 * trente secondes viennent d'Apple Music, par le même chemin que les cartes
 * d'Explore et la page d'une grille — rien de propre à l'accueil.
 *
 * Le lecteur d'extrait est partagé (`preview-audio`) : lancer celui-ci coupe celui
 * qui jouait ailleurs sur la page, sans quoi deux morceaux se superposeraient.
 */
function BookRow({ title, artist, mine, tag }: { title: string; artist: string; mine: boolean; tag: string }) {
  const { artworkUrl, previewUrl } = useArtwork(artist, title);
  const [playing, setPlaying] = useState(false);

  /**
   * Arrêt à la sortie de page, et **seulement** à la sortie de page.
   *
   * L'effet dépendait de `playing`, donc son nettoyage se rejouait à chaque
   * changement d'état. Lancer un second extrait coupait le premier, ce qui remettait
   * `playing` à faux sur la ligne d'origine, ce qui déclenchait son nettoyage, qui
   * coupait l'extrait qu'on venait de lancer : on entendait l'arrêt, jamais le
   * démarrage. La référence porte l'état, l'effet ne se monte qu'une fois.
   */
  const playingRef = useRef(false);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => () => { if (playingRef.current) stopPreviewAudio(); }, []);

  const toggle = () => {
    if (!previewUrl) return;
    if (playing) { stopPreviewAudio(); setPlaying(false); }
    else { setPlaying(true); playPreviewAudio(previewUrl, () => setPlaying(false)); }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/4 px-3 py-2.5">
      <button
        type="button"
        onClick={toggle}
        disabled={!previewUrl}
        aria-label={previewUrl ? `${playing ? '■' : '▶'} ${title}` : title}
        className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white/[0.06] group/art
          disabled:cursor-default enabled:cursor-pointer"
      >
        {artworkUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artworkUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {previewUrl && (
          <span
            className={`absolute inset-0 flex items-center justify-center transition-opacity ${
              playing ? 'bg-black/55 opacity-100' : 'bg-black/45 opacity-0 group-hover/art:opacity-100'
            }`}
          >
            {playing ? (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <rect x="4" y="3" width="4" height="14" rx="1" /><rect x="12" y="3" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            )}
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[var(--nav-text)]/85 text-sm font-semibold truncate">{title}</p>
        <p className="text-[var(--nav-text)]/40 text-xs truncate">{artist}</p>
      </div>
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${mine ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-white/8 text-[var(--nav-text)]/40'}`}>
        {tag}
      </span>
    </div>
  );
}

/* ── Données statiques ────────────────────────────────────────────── */

/**
 * Six fonctionnalités, et non douze.
 *
 * Les douze tuiles occupaient **3,6 écrans sur mobile** à elles seules, pour une
 * page qui en faisait onze. Six suffisent à dire l'étendue ; les autres — accordeur,
 * reconnaissance au micro, accords depuis un audio, dictionnaire — restent à un clic
 * dans le menu Outils, qui est fait pour ça. Le concert et le partage n'y sont plus
 * non plus : ils ont désormais leur bloc entier, juste sous le hero.
 */
const FEATURES: { id: string; href: string; icon: React.ReactNode }[] = [
  { id: 'editor', href: '/editor', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/> },
  { id: 'transpose', href: '/transpose', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/> },
  { id: 'instruments', href: '/chords', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></> },
  { id: 'print', href: '/print', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/> },
  { id: 'ai', href: '/sheet-photo', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/></> },
  { id: 'import', href: '/import-chords', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v12m0 0l-4-4m4 4l4-4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></> },
];

/** Les quatre situations où l'on se reconnaît. */
const PROFILS = ['solo', 'band', 'teacher', 'choir'] as const;

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

export function LandingClient({ chiffres, enAvant }: {
  chiffres: ChiffresDuCatalogue;
  enAvant: GrilleEnAvant[];
}) {
  const t = useTranslations('Landing');
  const tTry = useTranslations('TryEditor');
  const { user, loading: authLoading } = useAuth();

  // En dessous de douze grilles, le mur tournerait sur trop peu de pochettes et se
  // lirait comme une répétition : les remplissages prennent alors le relais.
  const sheets: MiniSheet[] = enAvant.length >= 12 ? enAvant : PLACEHOLDERS;
  const cols: MiniSheet[][] = [[], [], [], []];
  sheets.forEach((s, i) => cols[i % 4].push(s));

  return (
    <div className="min-h-screen flex flex-col bg-[var(--nav-bg)] overflow-x-hidden">
      {/* La barre du reste du site, et non plus une barre propre à l'accueil : celle
          d'hier n'était faite que d'ancres internes, sans lien vers Explorer, sans
          rien sur la création, et sans aucun menu en dessous de 640 px. */}
      <Navbar />

      <main className="flex-1">

        {/* ── Hero ────────────────────────────────────────────────── */}
        {/*
          `min-h-[80vh]` et non `h-screen`. C'est ce plein écran qui donnait
          l'impression d'un défilement « one page » — il n'y a jamais eu de
          scroll-snap : rien ne dépassait jamais du premier écran, donc rien
          n'annonçait qu'il y avait une suite. Vingt pour cent de moins, et le bloc
          suivant montre son bord.
        */}
        <section className="relative min-h-[80vh] flex items-center overflow-hidden py-16">

          {/* Mur de pochettes, en fond */}
          <div className="absolute inset-0 flex gap-3 px-3 select-none opacity-40">
            <ColonneDefilante sheets={cols[0]} duree={60} decalage={-80} libelle hrefDe={lienDeCouverture} />
            <ColonneDefilante sheets={cols[1]} duree={78} decalage={0} libelle hrefDe={lienDeCouverture} />
            <div className="hidden sm:block flex-1 overflow-hidden">
              <ColonneDefilante sheets={cols[2]} duree={95} decalage={-140} libelle hrefDe={lienDeCouverture} />
            </div>
            <div className="hidden md:block flex-1 overflow-hidden">
              <ColonneDefilante sheets={cols[3]} duree={68} decalage={-50} libelle hrefDe={lienDeCouverture} />
            </div>
          </div>

          {/* Voile : le mur reste lisible comme texture, le texte reste lisible comme texte. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(100deg, rgba(26,20,16,0.97) 0%, rgba(26,20,16,0.9) 45%, rgba(26,20,16,0.6) 100%)' }}
          />

          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">

              {/* Le discours, et une seule action */}
              <div>
                <h1 className="font-playfair text-4xl sm:text-5xl font-bold text-[var(--nav-text)] leading-[1.12] mb-5">
                  {t('hero.title')}
                </h1>
                <p className="text-[var(--nav-text)]/60 text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
                  {t('hero.subtitle')}
                </p>

                <div className={`transition-opacity ${ctaFade(authLoading)}`}>
                  {/* Une seule action au-dessus de la ligne de flottaison. La seconde
                      vivait ici et divisait le regard ; elle est descendue au bloc
                      final, quand on a de quoi choisir. */}
                  <Link
                    href={user ? '/book' : '/register'}
                    className="inline-block px-7 py-3.5 bg-[var(--accent)] text-white rounded-xl font-semibold
                      text-base hover:opacity-90 transition-opacity shadow-lg shadow-[#c84b2f]/30"
                  >
                    {user ? t('hero.bookLoggedIn') : t('hero.cta')}
                  </Link>
                  <p className="mt-3 text-[var(--nav-text)]/35 text-xs">{t('hero.ctaNote')}</p>
                </div>

                {/* Le seul chiffre vrai dont on dispose, et il est servi par le
                    serveur : celui d'hier était plafonné par sa propre requête.
                    Rien ne s'affiche si la lecture a échoué — « 0 grilles
                    publiques » dirait quelque chose de faux, et de pire que le
                    silence, sur la première ligne que voit un visiteur. */}
                {chiffres.grilles > 0 && (
                  <p className="mt-8 text-[var(--nav-text)]/40 text-sm">
                    {t('hero.catalogue', { grilles: chiffres.grilles, artistes: chiffres.artistes })}
                  </p>
                )}
              </div>

              {/* Le produit, pas une illustration */}
              <div className="hidden lg:block">
                <SheetShowcase />
              </div>

            </div>
          </div>
        </section>

        {/* ── Le Book ─────────────────────────────────────────────── */}
        <section id="book" className="px-6 py-16 sm:py-24 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

              <div>
                <p className="text-[var(--accent)] text-xs font-semibold tracking-widest uppercase mb-4">{t('book.eyebrow')}</p>
                <h2 className="font-playfair text-4xl font-bold text-[var(--nav-text)] mb-5 leading-tight">
                  {t('book.title')}
                </h2>

                <blockquote className="border-l-2 border-[var(--accent)] pl-4 mb-6">
                  <p className="text-[var(--nav-text)]/80 text-base italic leading-relaxed">
                    {t('book.quote')}
                  </p>
                  <p className="text-[var(--nav-text)]/45 text-sm mt-2 not-italic">
                    {t('book.quoteFooter')}
                  </p>
                </blockquote>

                <p className="text-[var(--nav-text)]/55 text-base leading-relaxed mb-6">
                  {t.rich('book.body', { strong: (chunks) => <strong className="text-[var(--nav-text)]/80">{chunks}</strong> })}
                </p>
                <ul className="space-y-3 mb-8">
                  {[t('book.item1'), t('book.item2'), t('book.item3'), t('book.item4')].map(item => (
                    <li key={item} className="flex items-start gap-3 text-sm text-[var(--nav-text)]/60">
                      <svg className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={user ? '/book' : '/register'}
                  className={`inline-block px-6 py-3 bg-[var(--accent)] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity ${ctaFade(authLoading)}`}
                >
                  {user ? t('book.ctaLoggedIn') : t('book.cta')}
                </Link>
              </div>

              <div className="relative">
                <div className="rounded-2xl border border-white/10 bg-white/4 p-5 space-y-2.5">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                    <span className="text-[var(--nav-text)]/70 text-sm font-semibold">{t('book.previewLabel')}</span>
                    <span className="ml-auto text-[var(--nav-text)]/30 text-xs">{t('book.previewCount')}</span>
                  </div>
                  {[
                    { title: 'Wish You Were Here', artist: 'Pink Floyd', mine: true },
                    { title: 'Wonderwall', artist: 'Oasis', mine: false },
                    { title: 'Hallelujah', artist: 'Leonard Cohen', mine: false },
                    { title: 'Hotel California', artist: 'Eagles', mine: true },
                  ].map((s) => (
                    <BookRow
                      key={s.title}
                      title={s.title}
                      artist={s.artist}
                      mine={s.mine}
                      tag={s.mine ? t('book.tagMine') : t('book.tagCommunity')}
                    />
                  ))}
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 px-3 py-2.5">
                    <div className="w-14 h-14 rounded-lg bg-white/5 shrink-0 flex items-center justify-center text-white/20 text-xl">+</div>
                    <p className="text-[var(--nav-text)]/25 text-xs">{t('book.previewAdd')}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Essayer ─────────────────────────────────────────────── */}
        <section id="essayer" className="px-6 py-16 sm:py-24 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-[var(--accent)] text-xs font-semibold tracking-widest uppercase mb-4">{tTry('eyebrow')}</p>
              <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-[var(--nav-text)] mb-4">{tTry('title')}</h2>
              <p className="text-[var(--nav-text)]/50 leading-relaxed">{tTry('desc')}</p>
            </div>

            <WhenNear>
              <TryEditor ctaHref={user ? '/sheet/new' : '/register'} ctaLabel={tTry('cta')} />
            </WhenNear>

            {/* Dire ce que le bac à sable n'est pas, et où va le reste : sans cette
                phrase, ces deux lignes passent pour tout ce que l'éditeur sait faire.
                Deux paragraphes plutôt qu'une phrase filée : l'un cadre l'essai, l'autre
                ouvre sur la suite, et ils ne se lisent pas d'un trait. */}
            <p className="mt-5 text-center text-xs text-[var(--nav-text)]/40">{tTry('noteSandbox')}</p>
            <p className="mt-2 text-center text-xs text-[var(--nav-text)]/40 leading-relaxed">
              {tTry.rich('noteMore', {
                lien: (chunks) => (
                  <Link href="/editor" className="underline underline-offset-2 hover:text-[var(--accent)] transition-colors">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        </section>

        {/* ── Jouer ensemble ──────────────────────────────────────── */}
        {/*
          Débadgé, et posé après le book et le bac à sable.
          C'est ce qu'aucun concurrent direct ne sait faire : ceux qui synchronisent
          un groupe sont des applications à installer, et le plus proche de nous en
          est encore à une liste d'attente. Le badge « Premium » qu'il portait
          cachait ce meilleur argument derrière un péage — il est retiré.

          Mais il vient après, et non avant : on arrive ici seul, par une recherche
          d'accord, et on n'a pas de groupe à qui penser tant qu'on n'a pas compris
          ce qu'est une grille. Le collectif se propose à quelqu'un qui a déjà vu
          l'outil, pas à quelqu'un qui découvre.
        */}
        <section id="ensemble" className="px-6 py-16 sm:py-24 border-t border-white/5">
          <div className="max-w-5xl mx-auto">

            <div className="text-center mb-14">
              <p className="text-[var(--accent)] text-xs font-semibold tracking-widest uppercase mb-4">
                {t('bands.eyebrow')}
              </p>
              <h2 className="font-playfair text-4xl font-bold text-[var(--nav-text)] mb-4 leading-tight">
                {t('bands.title')}<br />{t('bands.titleBreak')}
              </h2>
              <p className="text-[var(--nav-text)]/50 text-base max-w-xl mx-auto">
                {t('bands.subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

              {/* Le concert synchronisé */}
              <div className="rounded-2xl border border-white/8 bg-white/4 p-7 flex flex-col gap-5">
                <div className="w-11 h-11 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-[var(--nav-text)] font-bold text-xl mb-2">{t('bands.concertTitle')}</h3>
                  <p className="text-[var(--nav-text)]/55 text-sm leading-relaxed">{t('bands.concertText')}</p>
                </div>
                <ul className="space-y-2.5">
                  {[t('bands.concertItem1'), t('bands.concertItem2'), t('bands.concertItem3')].map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--nav-text)]/55">
                      <svg className="w-4 h-4 text-[var(--accent)]/70 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* La session ouverte */}
              <div className="rounded-2xl border border-white/8 bg-white/4 p-7 flex flex-col gap-5">
                <div className="w-11 h-11 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h4v4H3zM17 4h4v4h-4zM3 16h4v4H3zM13 13h3v3h-3zM19 19h2v2h-2zM13 19h3v2h-3zM19 13h2v3h-2z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-[var(--nav-text)] font-bold text-xl mb-2">{t('bands.sessionTitle')}</h3>
                  <p className="text-[var(--nav-text)]/55 text-sm leading-relaxed">{t('bands.sessionText')}</p>
                </div>
                <ul className="space-y-2.5">
                  {[t('bands.sessionItem1'), t('bands.sessionItem2'), t('bands.sessionItem3')].map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--nav-text)]/55">
                      <svg className="w-4 h-4 text-[var(--accent)]/70 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* La vérité du tarif, dite une fois, sans badge : rejoindre ne coûte rien. */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-5 rounded-2xl border border-white/10 bg-white/4 px-7 py-5">
              <div>
                <p className="text-[var(--nav-text)]/85 font-semibold text-sm">{t('bands.pricingText')}</p>
                <p className="text-[var(--nav-text)]/40 text-xs mt-0.5">{t('bands.pricingSubtext')}</p>
              </div>
              <Link
                href={user ? '/groups' : '/register'}
                className={`shrink-0 px-6 py-2.5 bg-[var(--accent)] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity whitespace-nowrap ${ctaFade(authLoading)}`}
              >
                {user ? t('bands.ctaLoggedIn') : t('bands.cta')}
              </Link>
            </div>

          </div>
        </section>

        {/* ── Pour qui ────────────────────────────────────────────── */}
        {/*
          Le bloc qui manquait. Les deux concurrents étudiés en ont un : on se
          reconnaît dans une situation avant de s'intéresser à une fonctionnalité.
          Les professeurs, en particulier, n'existaient qu'enfouis dans la moitié
          droite d'un bloc payant.
        */}
        <section id="pour-qui" className="px-6 py-16 sm:py-24 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-center text-[var(--nav-text)] text-3xl font-bold mb-2 font-playfair">
              {t('who.title')}
            </h2>
            <p className="text-center text-[var(--nav-text)]/40 mb-14 text-sm">
              {t('who.subtitle')}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {PROFILS.map((profil) => (
                <div key={profil} className="rounded-2xl border border-white/8 bg-white/4 px-5 py-6">
                  <h3 className="text-[var(--nav-text)] font-semibold text-base mb-2">{t(`who.${profil}.title`)}</h3>
                  <p className="text-[var(--nav-text)]/50 text-sm leading-relaxed">{t(`who.${profil}.text`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Fonctionnalités ─────────────────────────────────────── */}
        <section id="features" className="px-6 py-16 sm:py-24 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-center text-[var(--nav-text)] text-3xl font-bold mb-2 font-playfair">
              {t('features.title')}
            </h2>
            <p className="text-center text-[var(--nav-text)]/40 mb-14 text-sm">
              {t('features.subtitle')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Chaque fonctionnalité mène à sa page explicative. L'accueil reçoit les
                  liens venus de l'extérieur : c'est de là qu'il doit redistribuer. */}
              {FEATURES.map((f) => (
                <FeatureTile
                  key={f.id}
                  href={f.href}
                  icon={f.icon}
                  title={t(`features.${f.id}.title`)}
                  text={t(`features.${f.id}.text`)}
                  learnMore={t('features.learnMore')}
                />
              ))}
            </div>
            <p className="text-center mt-8">
              <Link href="/chords" className="text-[var(--nav-text)]/45 text-sm underline underline-offset-4 hover:text-[var(--accent)] transition-colors">
                {t('features.more')}
              </Link>
            </p>
          </div>
        </section>

        {/* ── CTA final ───────────────────────────────────────────── */}
        <section className="px-6 py-16 sm:py-24 border-t border-white/5">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-playfair text-4xl font-bold text-[var(--nav-text)] mb-4 leading-tight">
              {t('finalCta.title')}<br />{t('finalCta.titleBreak')}
            </h2>
            <p className="text-[var(--nav-text)]/45 text-base mb-8">
              {t('finalCta.subtitle')}
            </p>
            <div className={`flex gap-3 justify-center flex-wrap transition-opacity ${ctaFade(authLoading)}`}>
              <Link
                href={user ? '/sheet/new' : '/register'}
                className="px-7 py-3.5 bg-[var(--accent)] text-white rounded-xl font-semibold text-base hover:opacity-90 transition-opacity shadow-lg shadow-[#c84b2f]/25"
              >
                {user ? t('finalCta.ctaLoggedIn') : t('finalCta.cta')}
              </Link>
              <Link
                href="/explore"
                className="px-7 py-3.5 border border-white/15 text-[var(--nav-text)]/70 rounded-xl font-semibold text-base hover:border-white/25 hover:text-[var(--nav-text)] transition-colors"
              >
                {t('finalCta.browse')}
              </Link>
            </div>
          </div>
        </section>

      </main>

      <Footer />
      <HomeJsonLd />
    </div>
  );
}
