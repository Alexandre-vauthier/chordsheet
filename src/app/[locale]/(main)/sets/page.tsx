import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';

export default async function SetsPage() {
  const locale = await getLocale();
  redirect({ href: { pathname: '/dashboard', query: { tab: 'sets' } }, locale });
}
