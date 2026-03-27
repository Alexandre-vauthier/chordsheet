'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSet } from '@/lib/use-sets';
import { SheetViewer } from '@/components/sheet/sheet-viewer';
import { Button } from '@/components/ui/button';

interface SetPlayPageProps {
  params: Promise<{ id: string }>;
}

export default function SetPlayPage({ params }: SetPlayPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { set, sheets, isLoading, error } = useSet(id);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentSheet = sheets[currentIndex];
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < sheets.length - 1;

  // Navigation au clavier
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (hasPrevious) setCurrentIndex((i) => i - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        if (hasNext) setCurrentIndex((i) => i + 1);
      } else if (e.key === 'Escape') {
        router.push(`/sets/${id}`);
      }
    },
    [hasPrevious, hasNext, router, id]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error || !set || sheets.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-red-600 mb-4">{error || 'Set vide ou non trouvé'}</p>
        <button
          onClick={() => router.push('/sets')}
          className="text-[var(--accent)] hover:underline"
        >
          Retour aux sets
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Barre de navigation du set */}
      <div className="bg-[var(--ink)] text-[var(--cream)] py-2 px-4 print:hidden sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/sets/${id}`}
              className="text-sm text-[var(--cream)]/70 hover:text-[var(--cream)] transition-colors"
            >
              ← Quitter
            </Link>
            <div className="h-4 w-px bg-white/20" />
            <span className="text-sm font-medium">{set.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--cream)]/70">
              {currentIndex + 1} / {sheets.length}
            </span>
          </div>
        </div>
      </div>

      {/* Mini-liste des grilles */}
      <div className="bg-white border-b border-[var(--line)] py-2 px-4 print:hidden">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sheets.map((sheet, index) => (
              <button
                key={sheet.id}
                onClick={() => setCurrentIndex(index)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs transition-all
                  ${index === currentIndex
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--line)]'
                  }`}
              >
                {index + 1}. {sheet.title || 'Sans titre'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenu de la grille actuelle */}
      <div className="flex-1">
        {currentSheet && <SheetViewer sheet={currentSheet} />}
      </div>

      {/* Barre de navigation bas */}
      <div className="bg-white border-t border-[var(--line)] py-4 px-6 print:hidden sticky bottom-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setCurrentIndex((i) => i - 1)}
            disabled={!hasPrevious}
            className="min-w-[120px]"
          >
            ← Précédent
          </Button>

          <div className="text-center">
            <p className="font-medium text-[var(--ink)]">
              {currentSheet?.title || 'Sans titre'}
            </p>
            {currentSheet?.artist && (
              <p className="text-sm text-[var(--ink-light)]">{currentSheet.artist}</p>
            )}
          </div>

          <Button
            variant={hasNext ? 'primary' : 'ghost'}
            onClick={() => setCurrentIndex((i) => i + 1)}
            disabled={!hasNext}
            className="min-w-[120px]"
          >
            Suivant →
          </Button>
        </div>
      </div>

      {/* Indicateur de navigation clavier */}
      <div className="fixed bottom-20 right-4 text-xs text-[var(--ink-faint)] print:hidden">
        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">←</kbd> / <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">→</kbd> pour naviguer
      </div>
    </div>
  );
}
