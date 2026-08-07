'use client';

import { useTranslations } from 'next-intl';
import { PreferenceRow } from './preference-row';
import { NotationChoice } from './notation-choice';
import { ChordColorLegend } from './chord-color-legend';

/**
 * Ce qu'on voit en ouvrant une grille.
 *
 * L'ancienne rubrique « Général » n'existait que parce que la notation et le mode
 * sombre n'entraient nulle part ailleurs. Or la notation est le réglage
 * d'affichage le plus visible de tous : elle change chaque case de chaque grille.
 */
export function DisplaySection() {
  const t = useTranslations('Profile');

  return (
    <>
      <NotationChoice />

      <PreferenceRow cle="darkMode" label={t('darkModeTitle')} description={t('darkModeDesc')} />

      <PreferenceRow
        cle="chordColorCoding"
        label={t('colorCodingTitle')}
        description={t('colorCodingDesc')}
        illustration={<ChordColorLegend />}
      />

      <PreferenceRow
        cle="showInlineDiagram"
        label={t('inlineDiagramTitle')}
        description={t('inlineDiagramDesc')}
      />

      <PreferenceRow
        cle="minimizeRepeatedSections"
        label={t('minimizeRepeatedTitle')}
        description={t('minimizeRepeatedDesc')}
      />

      <PreferenceRow
        cle="showChordSummaryByDefault"
        label={t('showChordSummaryTitle')}
        description={t('showChordSummaryDesc')}
      />
    </>
  );
}
