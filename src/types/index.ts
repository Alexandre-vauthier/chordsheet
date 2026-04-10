// Types pour les cellules d'accords
// 0.25 = quart de temps, 0.5 = demi-temps, 1 = 1 temps, 2 = 2 temps, 3 = 3 temps (ligne 3/4), 4 = 4 temps (ligne 4/4)
export type CellSpan = 0.25 | 0.5 | 1 | 2 | 3 | 4;

export interface Cell {
  chord: string;
  span: CellSpan;
}

export type Row = Cell[];

// Nombre de temps par mesure (binaire ou ternaire)
export type BeatsPerMeasure = 3 | 4;

export interface Section {
  id: string;
  label: string;
  repeat: number;
  beatsPerMeasure: BeatsPerMeasure;
  rows: Row[];
  rowRepeats?: number[]; // nombre de répétitions par mesure (index = rowIndex)
}

// Niveaux de difficulté
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'Débutant',
  2: 'Facile',
  3: 'Intermédiaire',
  4: 'Avancé',
  5: 'Expert',
};

// Genres musicaux disponibles
export const GENRES = [
  'Rock',
  'Pop',
  'Jazz',
  'Blues',
  'Folk',
  'Country',
  'Reggae',
  'Funk',
  'Soul',
  'R&B',
  'Metal',
  'Punk',
  'Classique',
  'Chanson française',
  'Variété',
  'Bossa Nova',
  'Latino',
  'World',
] as const;

export type Genre = typeof GENRES[number];

// ─── Types pour les diagrammes d'accords ────────────────────────────────────

// Instruments supportés
export const INSTRUMENTS = ['guitar', 'mandolin', 'banjo', 'ukulele', 'piano'] as const;
export type InstrumentId = typeof INSTRUMENTS[number];

export interface Instrument {
  id: InstrumentId;
  label: string;
  strings: number; // 0 pour piano
}

// Barré (barre) sur le manche
export interface ChordBarre {
  fret: number;
  fromString: number;
  toString: number;
}

// Position d'un doigt : [corde, case, numéro de doigt]
export type FingerPosition = [number, number, number];

// Accord pour instruments à cordes
export interface StringChord {
  id: string;
  name: string;
  full: string;
  category: string;
  fingers: FingerPosition[];
  barre?: ChordBarre;
  open: number[];   // cordes jouées à vide
  muted: number[];  // cordes mutées
  startFret: number;
}

// Accord pour piano
export interface PianoChord {
  id: string;
  name: string;
  full: string;
  category: string;
  notes: string[]; // ex: ["C4", "E4", "G4"]
}

// Union type pour tout accord
export type ChordData = StringChord | PianoChord;

// Helper pour vérifier si c'est un accord piano
export const isPianoChord = (chord: ChordData): chord is PianoChord => {
  return 'notes' in chord;
};

// Accord personnalisé créé par l'utilisateur (cordes)
export interface CustomStringChord extends StringChord {
  createdBy?: string;
  instrumentId: InstrumentId;
}

// Accord personnalisé créé par l'utilisateur (piano)
export interface CustomPianoChord extends PianoChord {
  createdBy?: string;
  instrumentId: 'piano';
}

// Union des accords personnalisés
export type CustomChord = CustomStringChord | CustomPianoChord;

// Préférences de notation
export type NotationPreference = 'american' | 'french';

// Correspondance notation américaine ↔ française
export const NOTATION_MAP: Record<string, string> = {
  'C': 'Do', 'D': 'Ré', 'E': 'Mi', 'F': 'Fa',
  'G': 'Sol', 'A': 'La', 'B': 'Si',
};

// ─── Types pour les grilles d'accords ────────────────────────────────────────

// Type pour une grille d'accords complète
export interface Sheet {
  id?: string;
  title: string;
  artist: string;
  key: string; // tonalité
  tempo: string;
  ownerId: string;
  ownerName: string;
  isPublic: boolean;
  sections: Section[];
  tags: string[];
  // Nouvelles métadonnées V2
  genres: string[];
  difficulty: Difficulty | null;
  capo: number | null;
  createdAt: Date;
  updatedAt: Date;
  viewCount: number;
  // Système de notation
  averageRating: number | null;
  ratingCount: number;
  // V3 - Diagrammes d'accords
  instrumentId?: InstrumentId;
  customChords?: Record<string, CustomChord>; // accords personnalisés par nom
  // V4 - Lien de référence (YouTube, Spotify, etc.)
  referenceUrl?: string;
}

// Type pour la création d'une nouvelle grille
export type NewSheet = Omit<Sheet, 'id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'averageRating' | 'ratingCount'>;

// Rôles utilisateur
export type UserRole = 'user' | 'admin';

// Emails des administrateurs
export const ADMIN_EMAILS = ['alex.vauthier@gmail.com'] as const;

// Type utilisateur
export interface User {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  // V3 - Préférences d'accords
  preferredInstrument?: InstrumentId;
  notationPreference?: NotationPreference;
  chordColorCoding?: boolean;
  showInlineDiagram?: boolean;
}

// Vérifier si un email est admin
export const isAdminEmail = (email: string): boolean => {
  return ADMIN_EMAILS.includes(email as typeof ADMIN_EMAILS[number]);
};

// Type pour un set (setlist) - V2
export interface Set {
  id?: string;
  name: string;
  description?: string;
  ownerId: string;
  ownerName: string;
  sheetIds: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Type pour la création d'un nouveau set
export type NewSet = Omit<Set, 'id' | 'createdAt' | 'updatedAt'>;

// Type pour un favori (bookmark) - V2
export interface Bookmark {
  id?: string;
  userId: string;
  sheetId: string;
  addedAt: Date;
}

// Type pour une note (rating) - V3
export interface Rating {
  id?: string;
  userId: string;
  sheetId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Helpers pour créer des objets par défaut ────────────────────────────────

export const createEmptyCell = (span: CellSpan = 1): Cell => ({
  chord: '',
  span,
});

export const createEmptyRow = (beatsPerMeasure: BeatsPerMeasure = 4): Row => {
  const cells: Cell[] = [];
  for (let i = 0; i < beatsPerMeasure; i++) {
    cells.push(createEmptyCell());
  }
  return cells;
};

export const createEmptySection = (label: string = 'Section', beatsPerMeasure: BeatsPerMeasure = 4): Section => ({
  id: crypto.randomUUID(),
  label,
  repeat: 1,
  beatsPerMeasure,
  rows: [createEmptyRow(beatsPerMeasure)],
});

export const createEmptySheet = (ownerId: string, ownerName: string): NewSheet => ({
  title: '',
  artist: '',
  key: '',
  tempo: '',
  ownerId,
  ownerName,
  isPublic: false,
  sections: [createEmptySection('Intro')],
  tags: [],
  genres: [],
  difficulty: null,
  capo: null,
});

export const createEmptySet = (ownerId: string, ownerName: string): NewSet => ({
  name: '',
  description: '',
  ownerId,
  ownerName,
  sheetIds: [],
  isPublic: false,
});
