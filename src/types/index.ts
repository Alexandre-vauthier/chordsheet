// Types pour les cellules d'accords
export type CellSpan = 0.5 | 1 | 2;

export interface Cell {
  chord: string;
  span: CellSpan;
}

export type Row = Cell[];

export interface Section {
  id: string;
  label: string;
  repeat: number;
  rows: Row[];
}

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
  ownerId: string;
  sheetIds: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Helpers pour créer des objets par défaut
export const createEmptyCell = (span: CellSpan = 1): Cell => ({
  chord: '',
  span,
});

export const createEmptyRow = (): Row => [
  createEmptyCell(),
  createEmptyCell(),
  createEmptyCell(),
  createEmptyCell(),
];

export const createEmptySection = (label: string = 'Section'): Section => ({
  id: crypto.randomUUID(),
  label,
  repeat: 1,
  rows: [createEmptyRow()],
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
});
