import type { Sheet, Section, Row, NewSheet, Difficulty, BeatsPerMeasure, InstrumentId, CustomChord } from '@/types';

// Firestore n'accepte pas les tableaux imbriqués
// On convertit rows[][] en rows[{cells:[]}] pour la sauvegarde

interface FirestoreRow {
  cells: Row;
}

interface FirestoreSection {
  id: string;
  label: string;
  repeat: number;
  beatsPerMeasure: BeatsPerMeasure;
  rows: FirestoreRow[];
}

interface FirestoreSheet {
  title: string;
  artist: string;
  key: string;
  tempo: string;
  ownerId: string;
  ownerName: string;
  isPublic: boolean;
  sections: FirestoreSection[];
  tags: string[];
  // Métadonnées V2
  genres: string[];
  difficulty: Difficulty | null;
  capo: number | null;
  // V3 - Diagrammes d'accords
  instrumentId?: InstrumentId;
  customChords?: Record<string, CustomChord>;
}

// Convertir Sheet vers format Firestore (pour sauvegarde)
export function toFirestore(sheet: Sheet | NewSheet): FirestoreSheet {
  return {
    title: sheet.title,
    artist: sheet.artist,
    key: sheet.key,
    tempo: sheet.tempo,
    ownerId: sheet.ownerId,
    ownerName: sheet.ownerName,
    isPublic: sheet.isPublic,
    sections: sheet.sections.map((section) => ({
      id: section.id,
      label: section.label,
      repeat: section.repeat,
      beatsPerMeasure: section.beatsPerMeasure || 4,
      rows: section.rows.map((row) => ({ cells: row })),
    })),
    tags: sheet.tags,
    genres: sheet.genres || [],
    difficulty: sheet.difficulty ?? null,
    capo: sheet.capo ?? null,
    // V3 - Diagrammes d'accords
    instrumentId: sheet.instrumentId,
    customChords: sheet.customChords,
  };
}

// Convertir format Firestore vers Sheet (pour lecture)
export function fromFirestore(
  id: string,
  data: Record<string, unknown>
): Sheet {
  const sections = (data.sections as FirestoreSection[]) || [];

  return {
    id,
    title: (data.title as string) || '',
    artist: (data.artist as string) || '',
    key: (data.key as string) || '',
    tempo: (data.tempo as string) || '',
    ownerId: (data.ownerId as string) || '',
    ownerName: (data.ownerName as string) || '',
    isPublic: (data.isPublic as boolean) || false,
    sections: sections.map((section) => ({
      id: section.id,
      label: section.label,
      repeat: section.repeat,
      beatsPerMeasure: (section.beatsPerMeasure as BeatsPerMeasure) || 4,
      // Convertir {cells:[]} en tableau simple
      rows: section.rows.map((row) => row.cells || row),
    })) as Section[],
    tags: (data.tags as string[]) || [],
    genres: (data.genres as string[]) || [],
    difficulty: (data.difficulty as Difficulty) || null,
    capo: (data.capo as number) ?? null,
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() || new Date(),
    updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() || new Date(),
    viewCount: (data.viewCount as number) || 0,
    averageRating: (data.averageRating as number) ?? null,
    ratingCount: (data.ratingCount as number) || 0,
    // V3 - Diagrammes d'accords
    instrumentId: (data.instrumentId as InstrumentId) || undefined,
    customChords: (data.customChords as Record<string, CustomChord>) || undefined,
  };
}
