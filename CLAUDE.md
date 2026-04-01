# ChordSheet - Guide Claude

> Application web pour créer, partager et imprimer des grilles d'accords.

## Quick Reference

| Aspect | Valeur |
|--------|--------|
| **Stack** | Next.js 14 (App Router) + Firebase + Tailwind |
| **Langue UI** | Français |
| **Langue code** | Anglais (noms de variables, types) |
| **Repo** | github.com/Alexandre-vauthier/chordsheet |

---

## Structure du Projet

```
src/
├── app/                    # Pages Next.js (App Router)
│   ├── (auth)/             # Routes auth (login, register)
│   ├── (main)/             # Routes principales (avec navbar)
│   │   ├── dashboard/      # Mes grilles
│   │   ├── book/           # Mon book (favoris)
│   │   ├── explore/        # Grilles publiques
│   │   ├── sets/           # Setlists
│   │   ├── sheet/          # CRUD grilles
│   │   │   ├── new/        # Création
│   │   │   └── [id]/       # Consultation + édition
│   │   └── chords/         # Bibliothèque d'accords
│   └── layout.tsx          # Layout racine
│
├── components/
│   ├── chord/              # Diagrammes d'accords
│   │   ├── chord-diagram.tsx      # SVG manche guitare
│   │   ├── chord-editor.tsx       # Éditeur positions doigts
│   │   ├── chord-editor-modal.tsx # Modal édition
│   │   ├── chord-summary.tsx      # Résumé accords grille
│   │   ├── chord-suggestions.tsx  # Suggestions variantes
│   │   ├── piano-keyboard.tsx     # SVG clavier piano
│   │   └── instrument-selector.tsx
│   │
│   ├── sheet/              # Grille d'accords
│   │   ├── sheet-editor.tsx       # Éditeur complet
│   │   ├── sheet-viewer.tsx       # Mode consultation
│   │   ├── section-block.tsx      # Section (Intro, Refrain...)
│   │   ├── grid-row.tsx           # Ligne de mesure
│   │   └── beat-cell.tsx          # Cellule (1 temps)
│   │
│   ├── explore/            # Composants liste
│   │   └── sheet-card.tsx         # Carte aperçu grille
│   │
│   ├── layout/             # Layout
│   │   └── navbar.tsx
│   │
│   └── ui/                 # Composants génériques
│       ├── button.tsx
│       └── input.tsx
│
├── lib/                    # Logique métier
│   ├── firebase.ts              # Config Firebase
│   ├── firestore-helpers.ts     # CRUD Firestore
│   ├── auth-context.tsx         # Context auth
│   ├── chord-data.ts            # Bibliothèque accords
│   ├── chord-audio.ts           # Lecture audio (Web Audio)
│   ├── use-bookmarks.ts         # Hook favoris
│   ├── use-ratings.ts           # Hook notes
│   └── use-sets.ts              # Hook setlists
│
└── types/
    └── index.ts            # Tous les types TypeScript
```

---

## Modèles de Données

### Sheet (Grille d'accords)

```typescript
interface Sheet {
  id: string;
  title: string;
  artist: string;
  key: string;              // Tonalité (ex: "Am", "G")
  tempo: string;            // Tempo (ex: "120 BPM")
  ownerId: string;
  ownerName: string;
  isPublic: boolean;
  sections: Section[];      // Intro, Couplet, Refrain...
  genres: string[];         // Rock, Pop, Jazz...
  difficulty: 1|2|3|4|5 | null;
  capo: number | null;
  instrumentId?: InstrumentId;
  customChords?: Record<string, CustomChord>;  // Accords personnalisés
  // Métriques
  viewCount: number;
  averageRating: number | null;
  ratingCount: number;
}
```

### Section → Row → Cell

```typescript
interface Section {
  id: string;
  label: string;            // "Intro", "Refrain"...
  repeat: number;           // x2, x3...
  beatsPerMeasure: 3 | 4;   // 3/4 ou 4/4
  rows: Row[];              // Mesures
}

type Row = Cell[];          // Une mesure

interface Cell {
  chord: string;            // "Am", "G7", ""
  span: 0.5 | 1 | 2 | 3 | 4;  // Durée en temps
}
```

### Accords

```typescript
// Accord à cordes (guitare, ukulele, mandoline, banjo)
interface StringChord {
  id: string;
  name: string;             // "Am"
  full: string;             // "A minor"
  category: string;         // "open", "barre", "jazz"
  fingers: [corde, case, doigt][];
  barre?: { fret, fromString, toString };
  open: number[];           // Cordes à vide
  muted: number[];          // Cordes muettes
  startFret: number;
}

// Accord piano
interface PianoChord {
  id: string;
  name: string;
  full: string;
  category: string;
  notes: string[];          // ["C4", "E4", "G4"]
}
```

---

## Contraintes Firestore

**IMPORTANT** - Firestore refuse :
1. `undefined` → utiliser `null` ou omettre le champ
2. Tableaux imbriqués `[[1,2,3]]` → convertir en objets `[{s:1, f:2, d:3}]`

Voir `firestore-helpers.ts` :
- `chordToFirestore()` : convertit avant sauvegarde
- `chordFromFirestore()` : reconvertit à la lecture

---

## Patterns Récurrents

### Grille CSS
- 4/4 → `grid-cols-8` (8 colonnes, chaque temps = 2 cols)
- 3/4 → `grid-cols-6` (6 colonnes)
- `span` d'une cellule → `gridColumn: span ${span * 2}`

### Actions cellule
- `←` : extendLeft (absorbe cellule précédente)
- `→` : extendRight (absorbe cellule suivante)
- `÷` : shrink (divise en deux)

### Variables CSS (globals.css)
```css
--ink: #1a1a1a;
--ink-light: #666;
--ink-faint: #999;
--paper: #fdfbf7;
--cell-bg: #f5f0e8;
--accent: #c84b2f;
--accent-soft: rgba(200,75,47,0.08);
--line: #e0dcd4;
```

---

## Fichiers Clés par Fonctionnalité

| Fonctionnalité | Fichiers |
|----------------|----------|
| Édition grille | `sheet-editor.tsx`, `section-block.tsx`, `grid-row.tsx`, `beat-cell.tsx` |
| Consultation | `sheet-viewer.tsx` |
| Diagrammes accords | `chord-diagram.tsx`, `piano-keyboard.tsx` |
| Édition accord custom | `chord-editor.tsx`, `chord-editor-modal.tsx` |
| Persistance | `firestore-helpers.ts` |
| Audio | `chord-audio.ts` |
| Authentification | `auth-context.tsx`, `firebase.ts` |
| Types | `types/index.ts` |
| Données accords | `chord-data.ts` |

---

## Conventions

1. **Composants** : PascalCase (`SheetEditor`)
2. **Fichiers** : kebab-case (`sheet-editor.tsx`)
3. **Hooks** : `use-*.ts`
4. **Types** : dans `types/index.ts`
5. **Commentaires code** : en français (historique projet)
6. **'use client'** : en haut des composants avec hooks/state

---

## Commandes

```bash
npm run dev      # Dev local (localhost:3000)
npm run build    # Build production
npm run lint     # ESLint
```

---

## Instruments Supportés

| ID | Label | Cordes |
|----|-------|--------|
| guitar | Guitare | 6 |
| ukulele | Ukulélé | 4 |
| mandolin | Mandoline | 4 |
| banjo | Banjo | 5 |
| piano | Piano | - |

---

## Documentation Détaillée

Voir `docs/ARCHITECTURE.md` pour :
- Flux de données complet
- Hiérarchie des composants
- Règles Firestore détaillées
- Historique des décisions
