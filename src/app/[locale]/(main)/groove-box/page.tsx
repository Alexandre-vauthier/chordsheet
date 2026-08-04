import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { NO_INDEX } from '@/lib/seo';
import { GrooveBoxClient } from './groove-box-client';

/**
 * Banc d'essai de la boîte à rythme.
 *
 * Outil de mise au point, pas une page de catalogue : rien à indexer, et le son
 * ne se déclenche que sur un geste de l'utilisateur, donc tout se passe côté
 * navigateur.
 */
export const metadata: Metadata = { robots: NO_INDEX, title: 'Boîte à rythme' };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GrooveBoxClient />;
}
