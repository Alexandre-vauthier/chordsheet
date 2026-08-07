'use client';

import { useTranslations } from 'next-intl';
import { PreferenceRow } from './preference-row';

/**
 * Ce qu'on entend en lançant une grille.
 *
 * Renommée « Lecture & son » : en français, « lecture » se confond avec lire une
 * grille des yeux, alors que ces quatre réglages ne concernent que l'audio.
 */
export function PlaybackSection() {
  const t = useTranslations('Profile');

  return (
    <>
      <PreferenceRow cle="defaultChordsAudio" label={t('defaultChordsAudioTitle')} description={t('defaultChordsAudioDesc')} />
      <PreferenceRow cle="defaultGrooveBox" label={t('defaultGrooveBoxTitle')} description={t('defaultGrooveBoxDesc')} />
      <PreferenceRow cle="defaultMetronome" label={t('defaultMetronomeTitle')} description={t('defaultMetronomeDesc')} />
      <PreferenceRow cle="defaultCountIn" label={t('defaultCountInTitle')} description={t('defaultCountInDesc')} />
    </>
  );
}
