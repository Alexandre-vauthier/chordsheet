'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { isPro, getRemainingOcr, getEarnedOcrCredits } from '@/lib/plan-limits';
import { SettingBlock } from './settings-panel';

/**
 * Le plan, le quota et la porte vers Stripe.
 *
 * `succes` vient du retour de paiement : jusqu'ici, `?upgrade=success` était posé
 * par la route de paiement et lu par personne — on revenait sur une page qui ne
 * disait rien de ce qui venait de se passer.
 */
export function SubscriptionSection({ succes }: { succes: boolean }) {
  const t = useTranslations('Profile');
  const locale = useLocale();
  const { user } = useAuth();
  const [chargement, setChargement] = useState(false);
  const [echec, setEchec] = useState(false);

  if (!user) return null;

  const pro = isPro(user.subscription);

  const ouvrirPortail = async () => {
    if (!user.subscription?.stripeCustomerId) return;
    setChargement(true);
    setEchec(false);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeCustomerId: user.subscription.stripeCustomerId }),
      });
      const data = await res.json();
      // Sans cette branche, un échec laissait la page muette : le bouton cessait
      // simplement de tourner, sans rien dire ni ouvrir.
      if (data.url) window.location.href = data.url;
      else setEchec(true);
    } catch {
      setEchec(true);
    } finally {
      setChargement(false);
    }
  };

  return (
    <SettingBlock>
      {succes && (
        <p className="mb-4 px-3 py-2 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">
          {t('upgradeSuccess')}
        </p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pro ? 'bg-[var(--accent)] text-white' : 'bg-[var(--line)] text-[var(--ink-light)]'}`}>
              {pro ? t('pro') : t('free')}
            </span>
            {pro && user.subscription?.currentPeriodEnd && (
              <span className="text-xs text-[var(--ink-faint)]">
                {t('renewsOn', { date: user.subscription.currentPeriodEnd.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR') })}
              </span>
            )}
          </div>
          {!pro && (
            <div className="space-y-0.5">
              <p className="text-xs text-[var(--ink-light)]">
                {t.rich('ocrRemaining', {
                  count: getRemainingOcr(user.subscription),
                  strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong>,
                })}
              </p>
              {getEarnedOcrCredits(user.subscription) > 0 && (
                <p className="text-xs text-[var(--ink-faint)]">
                  {t('ocrEarnedCredits', { count: getEarnedOcrCredits(user.subscription) })}
                </p>
              )}
            </div>
          )}
        </div>

        {pro && user.subscription?.stripeCustomerId ? (
          <button
            type="button"
            onClick={ouvrirPortail}
            disabled={chargement}
            className="px-4 py-2 text-sm border border-[var(--line)] text-[var(--ink-light)] rounded-lg
              hover:border-[var(--ink-light)] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {chargement ? t('loading') : t('manageSubscription')}
          </button>
        ) : (
          <Link
            href="/pricing"
            className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors font-medium"
          >
            {t('upgradeToPro')}
          </Link>
        )}
      </div>

      {echec && <p className="mt-3 text-xs text-red-600">{t('portalError')}</p>}
    </SettingBlock>
  );
}
