'use client';

import { useTranslations } from 'next-intl';
import type { BadgeId, CreatorLevel } from '@/types';
import {
  BADGE_DEFINITIONS,
  BOOKMARKS_PER_OCR_CREDIT,
  LEVEL_ORDER,
  LEVEL_THRESHOLDS,
  MAX_EARNED_OCR_CREDITS,
  SCORE_WEIGHTS,
} from '@/lib/creator-reputation';

/**
 * Explique comment le niveau et les badges se gagnent.
 *
 * Le dispositif existait sans être documenté nulle part : on voyait une pastille et
 * une barre de progression, sans savoir ce qui les fait bouger ni ce qu'il reste à
 * faire. Un système de reconnaissance qu'on ne comprend pas ne motive personne.
 *
 * **Tous les chiffres viennent du module de calcul**, jamais des traductions : un
 * barème recopié dériverait au premier ajustement, et une règle affichée fausse est
 * pire qu'une règle absente.
 *
 * Replié par défaut : c'est une page publique, un visiteur vient d'abord voir des
 * grilles.
 */
export function ReputationExplainer({
  score,
  level,
  earned,
}: {
  score: number;
  level: CreatorLevel;
  earned: BadgeId[];
}) {
  const t = useTranslations('Reputation');
  const tBadge = useTranslations('Badges');
  const tLevel = useTranslations('CreatorLevels');

  const nextLevel = LEVEL_ORDER[LEVEL_ORDER.indexOf(level) + 1] ?? null;
  const missing = nextLevel ? Math.max(0, Math.ceil(LEVEL_THRESHOLDS[nextLevel] - score)) : 0;

  const remaining = (Object.keys(BADGE_DEFINITIONS) as BadgeId[]).filter((id) => !earned.includes(id));

  return (
    <details className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] overflow-hidden">
      <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-[var(--ink)] hover:text-[var(--accent)] transition-colors">
        {t('title')}
      </summary>

      <div className="px-4 pb-5 space-y-6 text-sm text-[var(--ink-light)] leading-relaxed">

        {/* Le calcul */}
        <section>
          <p className="mb-2">{t('scoreIntro')}</p>
          <ul className="space-y-1 list-disc pl-5">
            <li>{t('scoreBookmark', { points: SCORE_WEIGHTS.bookmark })}</li>
            <li>{t('scoreRating', { points: SCORE_WEIGHTS.rating })}</li>
            <li>{t('scoreAverage', { min: SCORE_WEIGHTS.averageMin, factor: SCORE_WEIGHTS.averageFactor })}</li>
          </ul>
          <p className="mt-2 font-medium text-[var(--ink)]">
            {t('currentScore', { score: Math.round(score) })}
          </p>
        </section>

        {/* Les paliers */}
        <section>
          <h3 className="font-semibold text-[var(--ink)] mb-2">{t('levelsTitle')}</h3>
          <ul className="space-y-1">
            {LEVEL_ORDER.map((l) => (
              <li key={l} className={l === level ? 'text-[var(--ink)] font-medium' : ''}>
                {tLevel(l)} — {LEVEL_THRESHOLDS[l]} pts
                {l === level && <span className="text-[var(--accent)]"> · {t('levelCurrent')}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            {nextLevel ? t('toNext', { points: missing, level: tLevel(nextLevel) }) : t('maxLevel')}
          </p>
          <p className="mt-2">{t('howToProgress')}</p>
        </section>

        {/* Ce qu'il reste à décrocher : c'est la partie qui donne une direction. */}
        <section>
          <h3 className="font-semibold text-[var(--ink)] mb-2">
            {remaining.length > 0 ? t('badgesToGo') : t('badgesAllDone')}
          </h3>
          {remaining.length > 0 && (
            <ul className="space-y-1.5">
              {remaining.map((id) => (
                <li key={id} className="flex gap-2">
                  <span aria-hidden>{BADGE_DEFINITIONS[id].icon}</span>
                  <span>
                    <span className="text-[var(--ink)] font-medium">{tBadge(`${id}.label`)}</span>
                    {' — '}
                    {tBadge(`${id}.description`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Le bénéfice matériel, invisible partout ailleurs dans l'application. */}
        <section>
          <h3 className="font-semibold text-[var(--ink)] mb-1">{t('bonusTitle')}</h3>
          <p>{t('bonus', { per: BOOKMARKS_PER_OCR_CREDIT, max: MAX_EARNED_OCR_CREDITS })}</p>
        </section>

      </div>
    </details>
  );
}
