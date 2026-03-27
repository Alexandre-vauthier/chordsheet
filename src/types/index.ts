// Types pour les cellules d'accords
export type CellSpan = 0.5 | 1 | 2;

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
}

// Niveaux de difficulté
export type Difficulty = 1 | 2 | 3 | 4 | 5;

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
}

// Type pour la création d'une nouvelle grille
export type NewSheet = Omit<Sheet, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>;

// Type utilisateur
export interface User {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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

// Helpers pour créer des objets par défaut
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
