import { redirect } from 'next/navigation';

export default function SetsPage() {
  redirect('/dashboard?tab=sets');
}
