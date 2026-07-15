import type { InstrumentId } from '@/types';

/** Clé de lookup identique au format customChords des grilles */
export function libraryKey(name: string, instrumentId: InstrumentId): string {
  return `${name.trim().toLowerCase()}-${instrumentId}`;
}
