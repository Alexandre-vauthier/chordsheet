'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { SuggestionsDropdown } from '@/components/ui/suggestions-dropdown';
import { useSearchSuggestions } from '@/lib/use-search-suggestions';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { Sheet } from '@/types';

type SearchResult =
  | { kind: 'sheet'; key: string; sheet: Sheet }
  | { kind: 'artist'; key: string; name: string };

/**
 * Deux sections : les grilles dont le titre correspond, puis les artistes dont le
 * nom correspond. Cliquer un artiste mène à sa page, qui liste toutes ses grilles —
 * inutile de dupliquer les grilles d'un même artiste dans la section « Grilles ».
 * Le filtrage se fait côté Firestore ; ici on assemble seulement l'affichage.
 */
function toSearchResults(sheets: Sheet[], artistNames: string[]): SearchResult[] {
  return [
    ...sheets.map((sheet): SearchResult => ({ kind: 'sheet', key: `sheet-${sheet.id}`, sheet })),
    ...artistNames.map((name): SearchResult => ({ kind: 'artist', key: `artist-${name}`, name })),
  ];
}

const LOUPE = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
);

/**
 * La recherche de la barre de navigation.
 *
 * Elle était écrite deux fois, une pour la barre et une pour le panneau mobile.
 * Les deux copies avaient déjà divergé : celle du panneau affichait ses intitulés
 * de section **en français en dur**, si bien qu'un anglophone lisait du français
 * dans son menu. Un seul chemin de code rend cette divergence impossible.
 *
 * `variante` ne change que l'habillage : `barre` s'ouvre au clic sur une loupe et
 * se referme à vide, `panneau` est un champ toujours ouvert en tête du menu mobile.
 * Le comportement au clavier, les suggestions et la destination sont identiques.
 */
export function NavSearch({
  variante,
  onNavigate,
}: {
  variante: 'barre' | 'panneau';
  /** Appelé après une navigation, pour que l'appelant referme ce qu'il a ouvert. */
  onNavigate?: () => void;
}) {
  const t = useTranslations('Navbar');
  const router = useRouter();
  const [valeur, setValeur] = useState('');
  const [ouverte, setOuverte] = useState(variante === 'panneau');
  const [focus, setFocus] = useState(false);
  const [actif, setActif] = useState(-1);
  const champ = useRef<HTMLInputElement>(null);

  const differee = useDebouncedValue(valeur);
  const { sheets, artistNames } = useSearchSuggestions(differee);
  const suggestions = toSearchResults(sheets, artistNames);
  const montrerSuggestions = focus && differee.trim().length >= 2;

  const terminer = () => {
    setValeur('');
    setActif(-1);
    if (variante === 'barre') setOuverte(false);
    champ.current?.blur();
    onNavigate?.();
  };

  const chercher = () => {
    const q = valeur.trim();
    router.push(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
    terminer();
  };

  const choisir = (r: SearchResult) => {
    router.push(r.kind === 'sheet' ? `/sheet/${r.sheet.id}` : `/artist/${encodeURIComponent(r.name)}`);
    terminer();
  };

  /**
   * Navigation au clavier. Le dernier index (égal à `suggestions.length`) désigne
   * la ligne « Voir tous les résultats », qui retombe sur la recherche large.
   */
  const auClavier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (variante === 'barre') setOuverte(false);
      setActif(-1);
      return;
    }
    if (!montrerSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif((i) => Math.min(i + 1, suggestions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && actif >= 0 && actif < suggestions.length) {
      e.preventDefault();
      choisir(suggestions[actif]);
    }
  };

  const dropdown = montrerSuggestions && (
    <SuggestionsDropdown
      items={suggestions}
      activeIndex={actif}
      getKey={(r) => r.key}
      getSection={(r) => (r.kind === 'sheet' ? t('sectionSheets') : t('sectionArtists'))}
      onHover={setActif}
      onSelect={choisir}
      renderItem={(r) =>
        r.kind === 'sheet' ? (
          <>
            <p className="text-[var(--ink)] truncate">{r.sheet.title}</p>
            <p className="text-xs text-[var(--ink-faint)] truncate">{r.sheet.artist}</p>
          </>
        ) : (
          <p className="text-[var(--ink)] truncate">{r.name}</p>
        )
      }
      footer={
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); chercher(); }}
          className="w-full text-left px-4 py-2.5 text-sm text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer"
        >
          {t('seeAllResults')}
        </button>
      }
    />
  );

  if (variante === 'barre' && !ouverte) {
    return (
      <button
        type="button"
        onClick={() => setOuverte(true)}
        title={t('searchAction')}
        className="p-1.5 rounded-lg text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{LOUPE}</svg>
      </button>
    );
  }

  const enBarre = variante === 'barre';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); chercher(); }}
      className={enBarre ? 'relative' : 'relative mb-3'}
    >
      <input
        ref={champ}
        type="text"
        autoFocus={enBarre}
        value={valeur}
        onChange={(e) => { setValeur(e.target.value); setActif(-1); }}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); if (enBarre && !valeur.trim()) setOuverte(false); }}
        onKeyDown={auClavier}
        placeholder={t('search')}
        className={`${enBarre ? 'w-64' : 'w-full'} pl-8 pr-3 py-1.5 rounded-lg text-sm
          bg-white/10 text-[var(--nav-text)] placeholder:text-[var(--nav-text)]/50
          border border-white/15 outline-none focus:bg-white/15 focus:border-white/30 transition-all`}
      />
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--nav-text)]/50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {LOUPE}
      </svg>
      {dropdown}
    </form>
  );
}
