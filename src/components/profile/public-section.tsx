'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { LevelBadge } from '@/components/reputation/level-badge';
import { BadgesDisplay } from '@/components/reputation/badges-display';
import { computeScore, computeLevel, computeBadges, getLevelProgress } from '@/lib/creator-reputation';
import { PublicProfileForm } from './public-profile-form';
import { SettingBlock } from './settings-panel';
import type { Sheet } from '@/types';

/**
 * Ce que voient les autres.
 *
 * Ces trois morceaux — le lien vers la vitrine, la présentation, la réputation —
 * traitent du même sujet et étaient séparés par quatre cents lignes de réglages
 * d'affichage. Réunis, ils forment enfin un propos : voici ta page publique,
 * voici ce que tu peux y écrire, voici ce qu'elle a produit.
 */
export function PublicSection({ publicSheets }: { publicSheets: Sheet[] }) {
  const t = useTranslations('Profile');
  const { user } = useAuth();
  if (!user) return null;

  const score = computeScore(publicSheets);
  const level = computeLevel(score);
  const progress = getLevelProgress(score);

  return (
    <>
      <SettingBlock description={t('publicProfileDesc')}>
        <Link href={`/user/${user.id}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
          {t('viewPublicProfile')}
        </Link>
      </SettingBlock>

      <div className="px-5 py-4 sm:px-6">
        <PublicProfileForm />
      </div>

      <SettingBlock label={t('sectionReputation')}>
        {publicSheets.length === 0 ? (
          <p className="text-xs text-[var(--ink-faint)]">{t('reputationEmpty')}</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <LevelBadge level={level} size="md" />
              <span className="text-sm text-[var(--ink-light)]">
                {t('score')} <strong className="text-[var(--ink)]">{score}</strong>
              </span>
            </div>
            {progress.next ? (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-[var(--ink-faint)] mb-1.5">
                  <span>{level}</span>
                  <span>{progress.next} — {progress.progressPct}%</span>
                </div>
                <div className="h-2 bg-[var(--line)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${progress.progressPct}%` }} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--ink-faint)] mb-4">{t('maxLevelReached')}</p>
            )}
            <p className="text-xs font-medium text-[var(--ink-light)] mb-2">{t('badges')}</p>
            <BadgesDisplay earned={computeBadges(publicSheets)} showAll />
          </>
        )}
      </SettingBlock>
    </>
  );
}
