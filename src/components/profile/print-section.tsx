'use client';

import { useTranslations } from 'next-intl';
import { PreferenceRow } from './preference-row';

/**
 * Ce que donne une grille imprimée.
 *
 * Ces deux champs sont lus par l'export PDF serveur autant que par la commande
 * Imprimer du navigateur, d'où « & PDF » dans le titre de la rubrique.
 */
export function PrintSection() {
  const t = useTranslations('Profile');

  return (
    <>
      <PreferenceRow cle="printChordDiagrams" label={t('printDiagramsTitle')} description={t('printDiagramsDesc')} />
      <PreferenceRow cle="printMinimizeRepeatedSections" label={t('printMinimizeTitle')} description={t('printMinimizeDesc')} />
    </>
  );
}
