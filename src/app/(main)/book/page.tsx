'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useBookmarks } from '@/lib/use-bookmarks';
import { Button } from '@/components/ui/button';
import { SheetCard } from '@/components/explore/sheet-card';

export default function BookPage() {
  const { user } = useAuth();
  const { bookmarkedSheets, isLoading, removeBookmark } = useBookmarks(user?.id);

  const handleRemoveBookmark = async (sheetId: string) => {
    if (!confirm('Retirer cette grille de votre book ?')) return;
    await removeBookmark(sheetId);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">
            Mon Book
          </h1>
          <p className="text-[var(--ink-light)] mt-1">
            {bookmarkedSheets.length > 0
              ? `${bookmarkedSheets.length} grille${bookmarkedSheets.length > 1 ? 's' : ''} sauvegardée${bookmarkedSheets.length > 1 ? 's' : ''}`
              : 'Vos grilles favorites'}
          </p>
        </div>
        <Link href="/explore">
          <Button variant="ghost">Explorer les grilles</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-[var(--line)] h-48 animate-pulse"
            />
          ))}
        </div>
      ) : bookmarkedSheets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookmarkedSheets.map((sheet) => (
            <div key={sheet.id} className="relative group">
              <SheetCard sheet={sheet} showOwner />
              <button
                onClick={() => handleRemoveBookmark(sheet.id!)}
                className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-sm
                  opacity-0 group-hover:opacity-100 transition-opacity
                  text-amber-500 hover:text-red-500"
                title="Retirer du book"
              >
                ★
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--line)] p-8 text-center">
          <div className="text-[var(--ink-faint)] mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-lg">Votre book est vide</p>
            <p className="text-sm mt-1">Explorez les grilles et ajoutez vos favorites !</p>
          </div>
          <Link href="/explore">
            <Button variant="primary">Explorer les grilles</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
