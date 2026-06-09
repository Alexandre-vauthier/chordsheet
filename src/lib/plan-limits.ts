import type { SubscriptionPlan, Subscription } from '@/types';

export const PLAN_LIMITS: Record<SubscriptionPlan, { groups: number; ocrPerMonth: number }> = {
  free: { groups: 0, ocrPerMonth: 2 },
  pro:  { groups: Infinity, ocrPerMonth: Infinity },
};

export function getEffectivePlan(subscription?: Subscription): SubscriptionPlan {
  if (!subscription) return 'free';
  if (subscription.plan === 'pro' && (subscription.status === 'active' || subscription.status === 'trialing')) {
    return 'pro';
  }
  return 'free';
}

export function isPro(subscription?: Subscription): boolean {
  return getEffectivePlan(subscription) === 'pro';
}

export function canCreateGroup(subscription?: Subscription): boolean {
  return isPro(subscription);
}

export function getRemainingOcr(subscription?: Subscription): number {
  const plan = getEffectivePlan(subscription);
  const limit = PLAN_LIMITS[plan].ocrPerMonth;
  if (limit === Infinity) return Infinity;
  const used = subscription?.ocrUsedThisMonth ?? 0;
  const resetAt = subscription?.ocrResetAt;
  // Si la date de reset est passée, le compteur repart à 0
  const remaining = (resetAt && new Date() > resetAt) ? limit : Math.max(0, limit - used);
  // Les crédits gagnés s'ajoutent au quota mensuel restant (non-Pro seulement)
  const earned = subscription?.earnedOcrCredits ?? 0;
  return remaining + earned;
}

export function getEarnedOcrCredits(subscription?: Subscription): number {
  return subscription?.earnedOcrCredits ?? 0;
}
