'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useLiveSession } from '@/lib/live-session-context';
import { useAuth } from '@/lib/auth-context';
import { useSearchSuggestions } from '@/lib/use-search-suggestions';

export function LiveSessionBanner() {
  const t = useTranslations('LiveSession');
  const { session, isHost, viewedSheet, pushSheet, endSession, leaveSession } = useLiveSession();
  const { firebaseUser } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { sheets, sheetsByArtist, loading } = useSearchSuggestions(query);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen]);

  if (!session) return null;

  const pushedByMe = session.pushedBy === firebaseUser?.uid;
  // Fusionne les correspondances par titre ET par artiste (dédupliquées) — sinon
  // chercher "Nirvana" ne remonte aucune grille (seul le nom d'artiste était exposé
  // par le hook, pas les grilles elles-mêmes). Seules les grilles publiques sont
  // lisibles par des invités anonymes.
  const publicResults = Array.from(
    new Map([...sheets, ...sheetsByArtist].map(s => [s.id, s])).values()
  ).filter(s => s.isPublic);

  const handlePush = (sheet: { id?: string; title: string; artist: string }) => {
    if (!sheet.id) return;
    pushSheet({ id: sheet.id, title: sheet.title, artist: sheet.artist }).catch(() => {});
    setSearchOpen(false);
    setQuery('');
  };

  // La grille actuellement consultée par CE participant peut être envoyée en un
  // clic, sans recherche — sauf si c'est déjà celle affichée pour tout le monde.
  const canSendViewed = !!viewedSheet && viewedSheet.id !== session.currentSheetId;

  return (
    <div className="bg-red-600 text-white print:hidden">
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />

        {!searchOpen && (
          <span className="text-sm font-medium flex-1 truncate min-w-0">
            <span className="opacity-75">{t('bannerLabel')} · </span>
            {session.currentSheetTitle ? (
              <>
                {session.currentSheetTitle}
                {!pushedByMe && session.pushedByName && (
                  <span className="opacity-60 ml-2 text-xs">{t('sentBy', { name: session.pushedByName })}</span>
                )}
              </>
            ) : (
              <span className="opacity-75">{t('waitingForSheet')}</span>
            )}
          </span>
        )}

        <div ref={searchRef} className={`relative flex items-center gap-1.5 ${searchOpen ? 'flex-1' : 'shrink-0'}`}>
          {searchOpen ? (
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); } }}
              placeholder={t('addSheetPlaceholder')}
              className="w-full px-3 py-1 rounded-lg bg-white/15 placeholder:text-white/60 text-white text-sm focus:outline-none focus:bg-white/25 transition-colors"
            />
          ) : canSendViewed ? (
            <>
              <button
                onClick={() => pushSheet(viewedSheet!).catch(() => {})}
                className="shrink-0 px-3 py-1 bg-white text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors cursor-pointer"
              >
                📡 {t('sendToSession')}
              </button>
              <button
                onClick={() => setSearchOpen(true)}
                title={t('addSheet')}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                🔍
              </button>
            </>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="shrink-0 px-3 py-1 bg-white text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors cursor-pointer"
            >
              + {t('addSheet')}
            </button>
          )}

          {searchOpen && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--cell-bg)] border border-[var(--line)] text-[var(--ink)] rounded-lg shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="px-3 py-2 text-sm text-[var(--ink-faint)]">…</div>
              ) : publicResults.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[var(--ink-faint)]">{t('noResults')}</div>
              ) : (
                publicResults.map(sheet => (
                  <button
                    key={sheet.id}
                    onClick={() => handlePush(sheet)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors flex flex-col cursor-pointer"
                  >
                    <span className="font-medium">{sheet.title}</span>
                    <span className="text-xs text-[var(--ink-faint)]">{sheet.artist}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {!searchOpen && (
          isHost ? (
            <button
              onClick={() => { if (confirm(t('endSessionConfirm'))) endSession().catch(() => {}); }}
              className="shrink-0 text-white/60 hover:text-white text-xs underline-offset-2 hover:underline transition-colors cursor-pointer"
            >
              {t('endSession')}
            </button>
          ) : (
            <button
              onClick={() => leaveSession()}
              className="shrink-0 text-white/60 hover:text-white text-lg leading-none transition-colors cursor-pointer"
              title={t('leaveSession')}
            >
              ×
            </button>
          )
        )}
      </div>
    </div>
  );
}
