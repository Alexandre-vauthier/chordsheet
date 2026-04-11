'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { LibraryChordsProvider } from '@/lib/library-chords-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LibraryChordsProvider>
        {children}
      </LibraryChordsProvider>
    </AuthProvider>
  );
}
