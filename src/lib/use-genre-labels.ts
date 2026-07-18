'use client';

import { useTranslations } from 'next-intl';

// Les genres/difficultés sont stockés en base avec leur libellé français canonique
// (ex. "Chanson française", "Facile") — ces hooks ne traduisent que l'affichage,
// jamais la donnée elle-même (voir messages/{fr,en}.json namespaces Genres/Difficulty).
export function useGenreLabel() {
  const t = useTranslations('Genres');
  return (genre: string) => t(genre);
}

export function useDifficultyLabel() {
  const t = useTranslations('Difficulty');
  return (label: string) => t(label);
}

// Les InstrumentId ('guitar', 'piano', ...) sont déjà des identifiants stables
// (pas du texte français) — la clé de traduction est directement l'id.
export function useInstrumentLabel() {
  const t = useTranslations('Instruments');
  return (instrumentId: string) => t(instrumentId);
}
