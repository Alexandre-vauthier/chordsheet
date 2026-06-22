'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useArtwork } from '@/lib/use-artwork';
import { Input } from '@/components/ui/input';
import type { Sheet } from '@/types';

interface ArtistEntry {
  name: string;
  titleCount: number;
  sheetCount: number;
  genres: string[];
}

function letterOf(name: string): string {
  const first = name.trim().replace(/^(The |Les |Le |La |L'|Un |Une )/i, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

const ALPHABET = ['#', ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];

export default function ArtistsPage() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLetter, setActiveLetter] = useState('');
  const [activeGenre, setActiveGenre] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const db = getDb();
        const q = query(collection(db, 'sheets'), where('isPublic', '==', true), limit(200));
        const snapshot = await getDocs(q);
        setSheets(snapshot.docs.map(d => fromFirestore(d.id, d.data())));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const artists = useMemo<ArtistEntry[]>(() => {
    const map = new Map<string, { titles: Set<string>; total: number; genres: Set<string> }>();
    for (const sheet of sheets) {
      const name = sheet.artist?.trim();
      if (!name) continue;
      if (!map.has(name)) map.set(name, { titles: new Set(), total: 0, genres: new Set() });
      const entry = map.get(name)!;
      entry.titles.add(sheet.title.trim().toLowerCase());
      entry.total++;
      sheet.genres?.forEach(g => entry.genres.add(g));
    }
    return Array.from(map.entries())
      .map(([name, { titles, total, genres }]) => ({ name, titleCount: titles.size, sheetCount: total, genres: Array.from(genres) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }, [sheets]);

  const availableGenres = useMemo(() => {
    const all = new Set<string>();
    artists.forEach(a => a.genres.forEach(g => all.add(g)));
    return Array.from(all).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [artists]);

  const filtered = useMemo(() => {
    let result = artists;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q));
    }
    if (activeLetter) {
      result = result.filter(a => letterOf(a.name) === activeLetter);
    }
    if (activeGenre) {
      result = result.filter(a => a.genres.includes(activeGenre));
    }
    return result;
  }, [artists, searchQuery, activeLetter, activeGenre]);

  const availableLetters = useMemo(
    () => new Set(artists.map(a => letterOf(a.name))),
    [artists]
  );

  const grouped = useMemo(() => {
    if (activeLetter || searchQuery.trim() || activeGenre) return null;
    const map = new Map<string, ArtistEntry[]>();
    for (const artist of filtered) {
      const l = letterOf(artist.name);
      if (!map.has(l)) map.set(l, []);
      map.get(l)!.push(artist);
    }
    return map;
  }, [filtered, activeLetter, searchQuery]);

  return (
    <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Artistes</h1>
        <p className="text-[var(--ink-light)] mt-1">
          {loading ? 'Chargement…' : `${artists.length} artiste${artists.length > 1 ? 's' : ''} · ${sheets.length} grille${sheets.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Recherche */}
      <div className="mb-4">
        <Input
          type="search"
          placeholder="Rechercher un artiste…"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setActiveLetter(''); }}
          className="max-w-sm"
        />
      </div>

      {/* Filtre genre */}
      {availableGenres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {availableGenres.map(genre => (
            <button
              key={genre}
              onClick={() => setActiveGenre(g => g === genre ? '' : genre)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeGenre === genre
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--cell-bg)] text-[var(--ink-light)] border-[var(--line)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {/* Navigation A–Z */}
      {!searchQuery.trim() && !activeGenre && (
        <div className="flex flex-wrap gap-1 mb-8">
          {/* Voir tout */}
          <button
            onClick={() => setActiveLetter('')}
            className={`h-8 px-3 rounded text-sm font-medium transition-colors
              ${activeLetter === ''
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--cell-bg)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] border border-[var(--line)]'
              }`}
          >
            Voir tout
          </button>

          {ALPHABET.map(l => {
            const hasArtists = availableLetters.has(l);
            const isActive = activeLetter === l;
            return (
              <button
                key={l}
                onClick={() => setActiveLetter(isActive ? '' : l)}
                disabled={!hasArtists}
                className={`w-8 h-8 rounded text-sm font-mono font-medium transition-colors
                  ${isActive
                    ? 'bg-[var(--accent)] text-white'
                    : hasArtists
                      ? 'bg-[var(--cell-bg)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] border border-[var(--line)]'
                      : 'text-[var(--ink-faint)] opacity-40 cursor-default'
                  }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      {/* Résultats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="h-16 bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] animate-pulse" />
          ))}
        </div>
      ) : (searchQuery.trim() || activeLetter || activeGenre) ? (
        filtered.length > 0 ? (
          <>
            <p className="text-sm text-[var(--ink-light)] mb-4">
              {filtered.length} artiste{filtered.length > 1 ? 's' : ''}
              {activeGenre && <span className="ml-1 text-[var(--accent)]">· {activeGenre}</span>}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map(artist => (
                <ArtistCard key={artist.name} artist={artist} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-[var(--ink-faint)] py-8 text-center">Aucun artiste trouvé pour «&nbsp;{searchQuery}&nbsp;»</p>
        )
      ) : grouped ? (
        <div className="space-y-10">
          {Array.from(grouped.entries()).map(([letter, group]) => (
            <div key={letter}>
              <h2 className="font-playfair text-2xl font-bold text-[var(--accent)] mb-3">{letter}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {group.map(artist => (
                  <ArtistCard key={artist.name} artist={artist} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ArtistCard({ artist }: { artist: ArtistEntry }) {
  const { artworkUrl } = useArtwork(artist.name, undefined);

  const initials = artist.name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('');

  return (
    <Link
      href={`/artist/${encodeURIComponent(artist.name)}`}
      className="group flex items-center gap-3 px-3 py-3 rounded-xl border border-[var(--line)]
        bg-[var(--cell-bg)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden bg-[var(--line)]">
        {artworkUrl ? (
          <img src={artworkUrl} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--ink-light)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors">
            {initials}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--ink)] truncate group-hover:text-[var(--accent)] transition-colors">
          {artist.name}
        </div>
        <div className="text-xs text-[var(--ink-faint)]">
          {artist.titleCount} titre{artist.titleCount > 1 ? 's' : ''}
        </div>
      </div>
    </Link>
  );
}
