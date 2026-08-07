import type { ReactNode } from 'react';

export interface UserStats {
  sheetsCount: number;
  publicSheetsCount: number;
  setsCount: number;
  bookmarksCount: number;
}

const ICONES: ReactNode[] = [
  <svg key="s" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
  </svg>,
  <svg key="p" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
  <svg key="l" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>,
  <svg key="f" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>,
];

/** Les quatre compteurs du compte. Un tiret tant que la lecture n'a pas abouti. */
export function StatsCards({ stats, labels }: { stats: UserStats | null; labels: string[] }) {
  const valeurs = [
    stats?.sheetsCount,
    stats?.publicSheetsCount,
    stats?.setsCount,
    stats?.bookmarksCount,
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {labels.map((label, i) => (
        <div key={label} className="rounded-xl border border-[var(--line)] p-3 text-center">
          <div className="flex justify-center mb-1.5 text-[var(--accent)]">{ICONES[i]}</div>
          <div className="text-xl font-bold text-[var(--ink)]">{valeurs[i] ?? '-'}</div>
          <div className="text-xs text-[var(--ink-light)]">{label}</div>
        </div>
      ))}
    </div>
  );
}
