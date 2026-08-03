import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { NO_INDEX } from '@/lib/seo';
import { UnknownChordsClient } from './unknown-chords-client';

/** Écran d'administration : aucune raison d'apparaître dans un moteur. */
export const metadata: Metadata = { robots: NO_INDEX };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <UnknownChordsClient />;
}
