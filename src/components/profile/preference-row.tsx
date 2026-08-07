'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { SettingRow } from '@/components/ui/toggle';
import { usePreference } from '@/lib/use-preference';
import type { UserPreferences } from '@/types';

/**
 * Les préférences qui se règlent par un interrupteur.
 *
 * Déduites du type plutôt que listées : une liste de plus serait une liste de plus
 * à oublier de tenir à jour. Le `-?` retire le caractère facultatif, sans quoi le
 * type ramènerait `undefined` avec lui.
 */
export type PreferenceBooleenne = {
  [K in keyof UserPreferences]-?: UserPreferences[K] extends boolean ? K : never;
}[keyof UserPreferences];

/**
 * Un interrupteur relié à une préférence du compte.
 *
 * Onze réglages tenaient chacun leur propre `useState`, leur propre écriture et
 * leur propre `catch { /* silent *\/ }`. Ici tout passe par `usePreference`, y
 * compris le retour en arrière quand l'écriture échoue : le message s'affiche sur
 * la ligne concernée, là où le geste a eu lieu.
 */
export function PreferenceRow({
  cle,
  label,
  description,
  illustration,
}: {
  cle: PreferenceBooleenne;
  label: string;
  description?: string;
  illustration?: ReactNode;
}) {
  const t = useTranslations('Profile');
  const { valeur, definir, echec, reessayer } = usePreference(cle);

  return (
    <SettingRow
      label={label}
      description={description}
      illustration={illustration}
      checked={!!valeur}
      onChange={(next) => void definir(next as UserPreferences[typeof cle])}
      echec={echec ? { message: t('saveFailed'), retryLabel: t('retry'), onRetry: reessayer } : undefined}
    />
  );
}
