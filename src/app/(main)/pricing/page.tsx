'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isPro } from '@/lib/plan-limits';

const FREE_FEATURES = [
  'Grilles d\'accords illimitées',
  'Grilles publiques et privées',
  'Export PDF',
  'Accords personnalisés',
  '2 analyses OCR / mois',
  'Favoris et sets',
  'Transposition automatique',
];

const PRO_FEATURES = [
  'Tout le plan gratuit',
  'Créer des groupes (illimité)',
  'Mode concert synchronisé',
  'Analyses OCR illimitées',
  'Badge Pro sur le profil',
];

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState(false);

  const userIsPro = isPro(user?.subscription);

  const handleUpgrade = async () => {
    if (!user) { router.push('/login?redirect=/pricing'); return; }
    if (userIsPro) return;

    setLoading(true);
    try {
      const priceId = billing === 'monthly'
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY;

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId: user.id, userEmail: user.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14">

      <div className="text-center mb-10">
        <h1 className="font-playfair text-4xl font-bold text-[var(--ink)] mb-3">Tarifs</h1>
        <p className="text-[var(--ink-light)] text-base max-w-lg mx-auto">
          ChordSheet reste gratuit pour un usage personnel. Le Pro débloque la collaboration et l&apos;OCR illimité.
        </p>

        {/* Toggle mensuel / annuel */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className={`text-sm ${billing === 'monthly' ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'}`}>Mensuel</span>
          <button
            onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${billing === 'yearly' ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${billing === 'yearly' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm ${billing === 'yearly' ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'}`}>
            Annuel
            <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] rounded font-medium">−33 %</span>
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">

        {/* Plan Free */}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 flex flex-col">
          <div className="mb-5">
            <p className="text-xs font-semibold text-[var(--ink-faint)] uppercase tracking-wide mb-1">Gratuit</p>
            <div className="flex items-end gap-1">
              <span className="font-playfair text-3xl font-bold text-[var(--ink)]">0 €</span>
            </div>
            <p className="text-xs text-[var(--ink-faint)] mt-1">Pour toujours</p>
          </div>

          <ul className="space-y-2.5 flex-1 mb-6">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-[var(--ink-light)]">
                <span className="text-[var(--ink-faint)] mt-0.5 shrink-0">✓</span>
                {f}
              </li>
            ))}
          </ul>

          {!user ? (
            <a
              href="/register"
              className="block text-center px-4 py-2.5 border border-[var(--line)] text-[var(--ink-light)] text-sm font-medium rounded-lg hover:border-[var(--ink-light)] transition-colors"
            >
              Commencer gratuitement
            </a>
          ) : !userIsPro ? (
            <div className="px-4 py-2.5 border border-[var(--line)] text-[var(--ink-faint)] text-sm text-center rounded-lg">
              Votre plan actuel
            </div>
          ) : null}
        </div>

        {/* Plan Pro */}
        <div className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--paper)] p-6 flex flex-col relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-[var(--accent)] text-white text-xs font-semibold px-3 py-1 rounded-full">
              Recommandé
            </span>
          </div>

          <div className="mb-5">
            <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wide mb-1">Pro</p>
            <div className="flex items-end gap-1">
              <span className="font-playfair text-3xl font-bold text-[var(--ink)]">
                {billing === 'monthly' ? '4,90 €' : '3,25 €'}
              </span>
              <span className="text-[var(--ink-faint)] text-sm mb-1">/mois</span>
            </div>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              {billing === 'yearly' ? 'Facturé 39 € / an' : 'Facturé mensuellement'}
            </p>
          </div>

          <ul className="space-y-2.5 flex-1 mb-6">
            {PRO_FEATURES.map((f, i) => (
              <li key={f} className={`flex items-start gap-2 text-sm ${i === 0 ? 'text-[var(--ink-faint)]' : 'text-[var(--ink)]'}`}>
                <span className={`mt-0.5 shrink-0 ${i === 0 ? 'text-[var(--ink-faint)]' : 'text-[var(--accent)]'}`}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          {userIsPro ? (
            <div className="px-4 py-2.5 bg-[var(--accent-soft)] text-[var(--accent)] text-sm text-center rounded-lg font-medium">
              Votre plan actuel ✓
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="px-4 py-2.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Redirection…' : user ? 'Passer à Pro' : 'Commencer avec Pro'}
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-[var(--ink-faint)] mt-8">
        Paiement sécurisé par Stripe · Annulable à tout moment · <a href="/legal/cgv" className="hover:text-[var(--ink-light)] underline">CGV</a>
      </p>

    </div>
  );
}
