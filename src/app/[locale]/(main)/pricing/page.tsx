'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/lib/auth-context';
import { isPro } from '@/lib/plan-limits';
import { useRouter } from '@/i18n/navigation';

export default function PricingPage() {
  const t = useTranslations('Pricing');
  const FREE_FEATURES = [
    t('freeFeature1'),
    t('freeFeature2'),
    t('freeFeature3'),
    t('freeFeature4'),
    t('freeFeature5'),
    t('freeFeature6'),
    t('freeFeature7'),
  ];
  const PRO_FEATURES = [
    t('proFeature1'),
    t('proFeature2'),
    t('proFeature3'),
    t('proFeature4'),
    t('proFeature5'),
  ];
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
        <h1 className="font-playfair text-4xl font-bold text-[var(--ink)] mb-3">{t('title')}</h1>
        <p className="text-[var(--ink-light)] text-base max-w-lg mx-auto">
          {t('subtitle')}
        </p>

        {/* Toggle mensuel / annuel */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className={`text-sm ${billing === 'monthly' ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'}`}>{t('monthlyLabel')}</span>
          <button
            onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${billing === 'yearly' ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${billing === 'yearly' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm ${billing === 'yearly' ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'}`}>
            {t('yearlyLabel')}
            <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] rounded font-medium">{t('discountBadge')}</span>
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">

        {/* Plan Free */}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 flex flex-col">
          <div className="mb-5">
            <p className="text-xs font-semibold text-[var(--ink-faint)] uppercase tracking-wide mb-1">{t('freeBadge')}</p>
            <div className="flex items-end gap-1">
              <span className="font-playfair text-3xl font-bold text-[var(--ink)]">{t('freePrice')}</span>
            </div>
            <p className="text-xs text-[var(--ink-faint)] mt-1">{t('foreverLabel')}</p>
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
              {t('startFreeButton')}
            </a>
          ) : !userIsPro ? (
            <div className="px-4 py-2.5 border border-[var(--line)] text-[var(--ink-faint)] text-sm text-center rounded-lg">
              {t('currentPlanLabel')}
            </div>
          ) : null}
        </div>

        {/* Plan Pro */}
        <div className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--paper)] p-6 flex flex-col relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-[var(--accent)] text-white text-xs font-semibold px-3 py-1 rounded-full">
              {t('recommendedBadge')}
            </span>
          </div>

          <div className="mb-5">
            <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wide mb-1">{t('proBadge')}</p>
            <div className="flex items-end gap-1">
              <span className="font-playfair text-3xl font-bold text-[var(--ink)]">
                {billing === 'monthly' ? t('priceMonthly') : t('priceYearly')}
              </span>
              <span className="text-[var(--ink-faint)] text-sm mb-1">{t('perMonth')}</span>
            </div>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              {billing === 'yearly' ? t('billedYearly') : t('billedMonthly')}
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
              {t('currentPlanCheckLabel')}
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="px-4 py-2.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? t('redirecting') : user ? t('upgradeButton') : t('startProButton')}
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-[var(--ink-faint)] mt-8">
        {t('securePayment')} <a href="/legal/cgv" className="hover:text-[var(--ink-light)] underline">{t('tosLink')}</a>
      </p>

    </div>
  );
}
