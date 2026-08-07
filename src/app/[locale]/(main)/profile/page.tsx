import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ProfileClient } from './profile-client';

/**
 * Les réglages du compte.
 *
 * Coque serveur : `useSearchParams` impose une frontière de suspense, que le
 * composant client pose lui-même. Rien à indexer ici, c'est une page privée.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfileClient />;
}
