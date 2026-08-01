import { getTranslations } from 'next-intl/server';
import type { InstrumentId } from '@/types';

/**
 * Les formes d'un nom d'instrument dont une phrase peut avoir besoin.
 *
 * Le français ne se contente pas du nom seul : on écrit « accords **de** guitare »
 * mais « accords **d'**ukulélé », « **à la** guitare » mais « **au** piano ». Recoller
 * un article dans le code produirait « à u piano » ; les locutions complètes sont donc
 * écrites dans les fichiers de traduction, et chaque gabarit prend celle qui convient
 * à sa place dans la phrase.
 */
export interface InstrumentNames extends Record<string, string> {
  /** Forme autonome, capitalisée : « Guitare », « Guitar ». */
  instrument: string;
  /** Forme en cours de phrase : « guitare », « guitar ». */
  instrumentLower: string;
  /** Complément de nom : « de guitare », « d'ukulélé » — en anglais, le nom seul. */
  instrumentOf: string;
  /** Complément de lieu : « à la guitare », « au piano », « on guitar ». */
  instrumentAt: string;
}

export async function getInstrumentNames(locale: string, id: InstrumentId): Promise<InstrumentNames> {
  const [t, tLower, tOf, tAt] = await Promise.all([
    getTranslations({ locale, namespace: 'Instruments' }),
    getTranslations({ locale, namespace: 'InstrumentsLower' }),
    getTranslations({ locale, namespace: 'InstrumentsOf' }),
    getTranslations({ locale, namespace: 'InstrumentsAt' }),
  ]);

  return {
    instrument: t(id),
    instrumentLower: tLower(id),
    instrumentOf: tOf(id),
    instrumentAt: tAt(id),
  };
}
