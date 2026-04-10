import type { Sheet, Section, Row, NewSheet, Difficulty, BeatsPerMeasure, InstrumentId, CustomChord, StringChord, PianoChord, FingerPosition } from '@/types';
import { isPianoChord } from '@/types';

// Firestore n'accepte pas les tableaux imbriqués
// On convertit rows[][] en rows[{cells:[]}] pour la sauvegarde

// Type pour stocker les positions de doigts en format Firestore (objets au lieu de tuples)
interface FirestoreFinger {
  s: number; // string
  f: number; // fret
  d: number; // digit
}

// Supprimer les valeurs undefined d'un objet (Firestore les refuse)
function removeUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// Convertir les accords personnalisés pour Firestore (éviter les tableaux imbriqués)
function chordToFirestore(chord: StringChord | PianoChord): Record<string, unknown> {
  if (isPianoChord(chord)) {
    // Piano chords n'ont pas de tableaux imbriqués
    return removeUndefined({ ...chord });
  }
  // Pour les accords à cordes, convertir fingers en objets et supprimer undefined
  const result: Record<string, unknown> = {
    id: chord.id,
    name: chord.name,
    full: chord.full,
    category: chord.category,
    fingers: chord.fingers.map(([s, f, d]) => ({ s, f, d })),
    open: chord.open,
    muted: chord.muted,
    startFret: chord.startFret,
  };
  // Ajouter barre seulement s'il existe
  if (chord.barre) {
    result.barre = chord.barre;
  }
  // Ajouter instrumentId si présent (pour CustomChord)
  if ('instrumentId' in chord && (chord as CustomChord).instrumentId) {
    result.instrumentId = (chord as CustomChord).instrumentId;
  }
  return result;
}

// Convertir les accords Firestore vers le format app
function chordFromFirestore(data: Record<string, unknown>): StringChord | PianoChord {
  if ('notes' in data) {
    return data as unknown as PianoChord;
  }
  // Convertir fingers d'objets vers tuples
  const fingers = (data.fingers as FirestoreFinger[])?.map(
    (f) => [f.s, f.f, f.d] as FingerPosition
  ) || [];
  return {
    ...data,
    fingers,
  } as unknown as StringChord;
}

interface FirestoreRow {
  cells: Row;
}

interface FirestoreSection {
  id: string;
  label: string;
  repeat: number;
  beatsPerMeasure: BeatsPerMeasure;
  rows: FirestoreRow[];
  rowRepeats?: number[];
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
  const base: FirestoreSheet = {
    title: sheet.title.trim(),
    artist: sheet.artist.trim(),
    key: sheet.key,
    tempo: sheet.tempo,
    ownerId: sheet.ownerId,
    ownerName: sheet.ownerName,
    isPublic: sheet.isPublic,
    sections: sheet.sections.map((section) => {
      const s: FirestoreSection = {
        id: section.id,
        label: section.label,
        repeat: section.repeat,
        beatsPerMeasure: section.beatsPerMeasure || 4,
        rows: section.rows.map((row) => ({ cells: row })),
      };
      if (section.rowRepeats) s.rowRepeats = section.rowRepeats;
      return s;
    }),
    tags: sheet.tags,
    genres: sheet.genres || [],
    difficulty: sheet.difficulty ?? null,
    capo: sheet.capo ?? null,
  };

  // V3+ - Ajouter uniquement si défini (Firestore n'accepte pas undefined)
  if (sheet.referenceUrl) {
    (base as unknown as Record<string, unknown>).referenceUrl = sheet.referenceUrl;
  }
  if (sheet.instrumentId) {
    base.instrumentId = sheet.instrumentId;
  }
  if (sheet.customChords && Object.keys(sheet.customChords).length > 0) {
    // Convertir les accords pour éviter les tableaux imbriqués
    const firestoreChords: Record<string, Record<string, unknown>> = {};
    for (const [key, chord] of Object.entries(sheet.customChords)) {
      firestoreChords[key] = chordToFirestore(chord);
    }
    base.customChords = firestoreChords as unknown as Record<string, CustomChord>;
  }

  return base;
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
      rows: section.rows.map((row) => row.cells || row),
      ...(section.rowRepeats ? { rowRepeats: section.rowRepeats } : {}),
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
    // V3+ - Diagrammes d'accords & référence
    referenceUrl: (data.referenceUrl as string) || undefined,
    instrumentId: (data.instrumentId as InstrumentId) || undefined,
    customChords: data.customChords
      ? Object.fromEntries(
          Object.entries(data.customChords as Record<string, Record<string, unknown>>).map(
            ([key, chord]) => [key, chordFromFirestore(chord)]
          )
        ) as Record<string, CustomChord>
      : undefined,
  };
}
