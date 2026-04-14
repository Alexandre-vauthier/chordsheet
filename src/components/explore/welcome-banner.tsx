'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const LS_KEY = 'chordsheet_welcome_dismissed';
const LS_NEW = 'chordsheet_show_welcome';

export function WelcomeBanner() {
  const [visible, setVisible] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(LS_KEY);
    const showWelcome = localStorage.getItem(LS_NEW);
    if (!dismissed) {
      setVisible(true);
      if (showWelcome) {
        setIsNew(true);
        localStorage.removeItem(LS_NEW);
      }
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(LS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-8 rounded-2xl border border-[var(--line)] bg-[var(--cell-bg)] overflow-hidden">
      <div className="px-6 py-5 flex gap-5 items-start">
        {/* Icône */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] text-xl mt-0.5">
          ♪
        </div>

        <div className="flex-1 min-w-0">
          {isNew && (
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-1">
              Bienvenue !
            </p>
          )}
          <h2 className="text-base font-semibold text-[var(--ink)] mb-2">
            ChordSheet, c&apos;est quoi exactement ?
          </h2>
          <p className="text-sm text-[var(--ink-light)] leading-relaxed">
            Pas un cours de musique — plutôt un carnet de bord pour musiciens.
            Ici on note les <strong className="text-[var(--ink)]">accords et la structure</strong> d&apos;un morceau
            (Intro, Couplet, Refrain…) pour avoir une vue simplifiée et jouer sans chercher.
          </p>
          <p className="text-sm text-[var(--ink-light)] leading-relaxed mt-1.5">
            Constitue ton <strong className="text-[var(--ink)]">book personnel</strong>, retrouve tes morceaux
            d&apos;un coup d&apos;œil, partage-les avec d&apos;autres musiciens.
            La grille ne remplace pas la partition — elle te rappelle l&apos;essentiel.
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            <Link
              href="/sheet/new"
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[#a83d25] transition-colors"
            >
              + Créer ma première grille
            </Link>
            <button
              onClick={dismiss}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-sm text-[var(--ink-light)] hover:border-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
            >
              J&apos;ai compris, explorer
            </button>
          </div>
        </div>

        {/* Fermer */}
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-1 text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
          title="Fermer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Trois pilliers visuels */}
      <div className="border-t border-[var(--line)] grid grid-cols-3 divide-x divide-[var(--line)]">
        {[
          { icon: '📖', label: 'Ton book', desc: 'Tous tes morceaux en un endroit' },
          { icon: '🎵', label: 'Structure claire', desc: 'Accords + sections, rien de superflu' },
          { icon: '🤝', label: 'Collaboratif', desc: 'Partage et explore les grilles de la communauté' },
        ].map(({ icon, label, desc }) => (
          <div key={label} className="px-4 py-3 text-center">
            <div className="text-lg mb-0.5">{icon}</div>
            <div className="text-xs font-semibold text-[var(--ink)]">{label}</div>
            <div className="text-[11px] text-[var(--ink-faint)] mt-0.5 leading-tight">{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
