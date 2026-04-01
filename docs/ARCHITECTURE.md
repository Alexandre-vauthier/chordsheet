# Architecture ChordSheet

## Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Next.js 14 (App Router) + React + Tailwind CSS                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Pages      │  │  Components  │  │    Hooks     │          │
│  │  (app/)      │  │              │  │   (lib/)     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └────────────┬────┴────────────────┘                   │
│                      │                                          │
│              ┌───────▼───────┐                                  │
│              │  AuthContext  │                                  │
│              └───────┬───────┘                                  │
│                      │                                          │
├──────────────────────┼──────────────────────────────────────────┤
│                      │           FIREBASE                       │
│         ┌────────────┼────────────┐                             │
│         │            │            │                             │
│  ┌──────▼──────┐ ┌───▼────┐ ┌────▼─────┐                       │
│  │    Auth     │ │Firestore│ │ Storage  │                       │
│  │ (connexion) │ │ (data)  │ │ (images) │                       │
│  └─────────────┘ └─────────┘ └──────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Hiérarchie des Composants

### Éditeur de Grille

```
SheetEditor
├── InstrumentSelector        # Choix instrument pour diagrammes
├── Metadata inputs           # Titre, artiste, tonalité, tempo...
├── SectionBlock[]            # Pour chaque section
│   ├── Header                # Label, repeat, 3/4 ou 4/4
│   ├── GridRow[]             # Pour chaque mesure
│   │   └── BeatCell[]        # Pour chaque temps
│   │       ├── Input         # Saisie accord
│   │       ├── ChordSuggestions  # Diagramme popup
│   │       └── ActionButtons # ← → ÷ ✕
│   └── + Mesure button
├── ChordSummary              # Récap accords avec diagrammes
│   └── ChordDiagram[]        # ou PianoKeyboard[]
└── ChordEditorModal          # Édition accord personnalisé
    └── ChordEditor
```

### Consultation de Grille

```
SheetViewer
├── Header                    # Titre, artiste, metadata badges
├── Section[]                 # Sections en lecture seule
│   └── Grid                  # Cellules non-éditables
├── ChordSummary              # Diagrammes des accords
│   └── InstrumentSelector
└── Print footer              # Visible uniquement @media print
```

### Diagrammes d'Accords

```
ChordDiagram (SVG)
├── Nut (sillet) ou fret number
├── Fret lines (5)
├── String lines (4-6)
├── Open/Muted indicators (○/✕)
├── Barre rect
└── Finger dots avec numéros

PianoKeyboard (SVG)
├── White keys
├── Black keys
└── Highlighted notes
```

---

## Collections Firestore

### `sheets` - Grilles d'accords

```
sheets/{sheetId}
├── title: string
├── artist: string
├── key: string
├── tempo: string
├── ownerId: string
├── ownerName: string
├── isPublic: boolean
├── sections: Section[]       # Embedded array
├── genres: string[]
├── difficulty: number | null
├── capo: number | null
├── instrumentId: string | null
├── customChords: {           # Map d'accords personnalisés
│     "am-guitar": {...},
│     "g7-ukulele": {...}
│   }
├── createdAt: Timestamp
├── updatedAt: Timestamp
├── viewCount: number
├── averageRating: number | null
└── ratingCount: number
```

### `users` - Utilisateurs

```
users/{userId}
├── displayName: string
├── email: string
├── photoURL: string | null
├── role: "user" | "admin"
├── preferredInstrument: string | null
├── notationPreference: "american" | "french" | null
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

### `bookmarks` - Favoris

```
bookmarks/{bookmarkId}
├── userId: string
├── sheetId: string
└── addedAt: Timestamp
```

### `ratings` - Notes

```
ratings/{ratingId}
├── userId: string
├── sheetId: string
├── rating: 1-5
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

### `sets` - Setlists

```
sets/{setId}
├── name: string
├── description: string | null
├── ownerId: string
├── ownerName: string
├── sheetIds: string[]
├── isPublic: boolean
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

---

## Flux de Données

### Création d'une Grille

```
1. User clique "Nouvelle grille"
2. SheetEditor reçoit initialSheet vide (createEmptySheet)
3. User édite (state local dans SheetEditor)
4. User clique "Créer"
5. validateSheet() vérifie titre, artiste, ≥1 accord
6. sheetToFirestore() convertit (customChords → format Firestore)
7. addDoc() vers collection "sheets"
8. Redirect vers /sheet/[id]
```

### Édition d'un Accord Personnalisé

```
1. User clique "Modifier" sur un accord dans ChordSummary
2. ChordEditorModal s'ouvre avec l'accord actuel
3. ChordEditor permet de modifier positions doigts
4. User sauvegarde
5. handleSaveCustomChord() met à jour sheet.customChords
6. Au prochain save, customChords est persisté
7. ChordSummary affiche le custom en premier avec badge "personnalisé"
```

### Conversion Firestore

```
App → Firestore (save):
  fingers: [[1,2,3], [4,5,6]]  →  [{s:1, f:2, d:3}, {s:4, f:5, d:6}]
  barre: undefined             →  (omis du document)

Firestore → App (load):
  [{s:1, f:2, d:3}]  →  [[1,2,3]]
```

---

## Logique Métier Clé

### Gestion des Spans (durées)

Une mesure 4/4 = 4 temps = 8 colonnes CSS
```
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ 1 │   │ 2 │   │ 3 │   │ 4 │   │  (grid-cols-8)
└───┴───┴───┴───┴───┴───┴───┴───┘
```

| Span | Colonnes | Usage |
|------|----------|-------|
| 0.5 | 1 | Demi-temps |
| 1 | 2 | Un temps |
| 2 | 4 | Deux temps |
| 3 | 6 | Trois temps (ligne complète 3/4) |
| 4 | 8 | Quatre temps (ligne complète 4/4) |

### Extend Left/Right

```
Avant:  [Am|1] [G|1] [C|1] [D|1]
         ↑ extendRight
Après:  [Am|2]       [C|1] [D|1]
```
- Absorbe la cellule adjacente
- Somme les spans
- Ne dépasse pas beatsPerMeasure

### Shrink

```
Avant:  [Am|2]
         ↑ shrink
Après:  [Am|1] [  |1]
```
- Divise le span en deux
- La première garde l'accord
- La seconde est vide

---

## SVG Chord Diagram

### Coordonnées

```
sm (size='sm')          md (size='md')
W = 110-130px           W = 170-198px
H = 158px               H = 240px
PAD = 20px              PAD = 30px
CELL_W = 18px           CELL_W = 28px
DOT_R = 7px             DOT_R = 13px
```

### Calculs

```typescript
const FRET_W = (numStrings - 1) * CELL_W;  // Largeur manche
const W = FRET_W + PAD * 2;                 // Largeur totale
const LEFT = PAD;                           // X de la corde la plus aiguë
const RIGHT = LEFT + FRET_W;                // X de la corde grave

// Position X d'une corde (1 = aiguë, 6 = grave)
const getSX = (s) => RIGHT - (s - 1) * CELL_W;

// Position Y d'une case
const getFY = (f) => TOP + (f - startFret) * CELL_H + CELL_H / 2;
```

---

## Audio (Web Audio API)

### Architecture

```
chord-audio.ts
├── createChordPlayer(instrumentId)
│   └── Retourne { play(notes), stop() }
├── getChordNotes(chord, instrumentId)
│   └── Calcule les fréquences depuis les positions
└── Oscillateurs pour chaque note
    └── Attack/Release envelope
```

### Notes

```typescript
// Fréquences standard (A4 = 440Hz)
const NOTE_FREQUENCIES = {
  'C4': 261.63,
  'E4': 329.63,
  'G4': 392.00,
  // ...
};

// Accordage guitare standard
const GUITAR_TUNING = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];
```

---

## Routes et Navigation

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Page d'accueil publique |
| `/login` | Login | Connexion |
| `/register` | Register | Inscription |
| `/dashboard` | Dashboard | Mes grilles |
| `/book` | Book | Mes favoris |
| `/explore` | Explore | Grilles publiques |
| `/sets` | Sets | Mes setlists |
| `/sets/[id]` | SetDetail | Détail setlist |
| `/sets/[id]/play` | SetPlay | Mode présentation |
| `/sheet/new` | NewSheet | Création grille |
| `/sheet/[id]` | ViewSheet | Consultation |
| `/sheet/[id]/edit` | EditSheet | Édition |
| `/chords` | Chords | Bibliothèque accords |
| `/profile` | Profile | Mon profil |
| `/admin` | Admin | Administration (admins only) |

---

## Historique des Décisions

### 2024-01 - Structure Cellules
- Choix de `span` en temps (0.5, 1, 2, 3, 4) vs colonnes
- Raison : plus intuitif pour les musiciens

### 2024-02 - Firestore vs Realtime Database
- Choix : Firestore
- Raison : requêtes complexes, offline, structure de document

### 2024-03 - CustomChords dans Sheet
- Choix : embedded dans le document Sheet
- Alternative rejetée : collection séparée
- Raison : évite les jointures, données cohérentes

### 2024-04 - Conversion fingers pour Firestore
- Problème : Firestore refuse les tableaux imbriqués
- Solution : conversion `[s,f,d]` → `{s,f,d}` dans helpers

---

## Mise à Jour de cette Doc

**Quand mettre à jour :**
- Ajout d'un nouveau composant majeur
- Changement de structure de données
- Nouvelle collection Firestore
- Modification du flux de données

**Fichiers à vérifier :**
- `CLAUDE.md` : mettre à jour le Quick Reference
- `docs/ARCHITECTURE.md` : ce fichier
