'use client';

import { ReactNode } from 'react';
import { LibraryChordsProvider, type LibraryChord } from '@/lib/library-chords-context';

interface ExportProvidersProps {
  children: ReactNode;
  overrides: [string, LibraryChord][];
  additions: LibraryChord[];
}

export function ExportProviders({ children, overrides, additions }: ExportProvidersProps) {
  return (
    <LibraryChordsProvider initialOverrides={new Map(overrides)} initialAdditions={additions}>
      {children}
    </LibraryChordsProvider>
  );
}
