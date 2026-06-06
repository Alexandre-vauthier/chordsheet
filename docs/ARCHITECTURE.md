# Architecture ChordSheet

## Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Next.js 15 (App Router) + React 19 + Tailwind CSS 4            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Pages      │  │  Components  │  │    Hooks     │          │
│  │  (app/)      │  │              │  │   (lib/)     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └────────────┬────┴────────────────┘                   │
│                      │                                          │
│         ┌────────────┴────────────┐                             │
│         │       Contexts          │                             │
│         │  AuthContext            │                             │
│         │  LibraryChordsContext   │                             │
│         └────────────┬────────────┘                             │
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

## Routes et Navigation

| Route | Description |
|-------|-------------|
| `/` | Landing page publique |
| `/login` | Connexion |
| `/register` | Inscription |
| `/dashboard` | Mes grilles |
| `/book` | Mes favoris |
| `/explore` | Grilles publiques (filtres genre/difficulté/tri) |
| `/sets` | Mes setlists |
| `/sets/[id]` | Détail setlist |
| `/sets/[id]/play` | Mode concert/présentation |
| `/sheet/new` | Création grille |
| `/sheet/[id]` | Consultation + impression |
| `/sheet/[id]/edit` | Édition grille |
| `/chords` | Bibliothèque d'accords |
| `/profile` | Mon profil (préférences instrument, notation, impression, darkmode) |
| `/admin` | Administration — admins seulement |
| `/artist/[name]` | Toutes les grilles d'un artiste (avec artwork) |
| `/user/[id]` | Profil public d'un utilisateur |
| `/song/[title]/[artist]` | Lookup par chanson |
| `/legal/*` | Pages légales (CGU, CGV...) |

---

## Hiérarchie des Composants

### Éditeur de Grille

```
SheetEditor
├── InstrumentSelector        # Choix instrument pour diagrammes
├── Metadata inputs           # Titre, artiste, tonalité, tempo, capo...
├── ImportSheetModal          # Import depuis texte (Ultimate Guitar)
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
├── InstrumentSelector        # Choix instrument (persisté localStorage + profil)
├── TransposeControls         # +/- demi-tons
├── PlaybackControls          # Play/Stop, métronome, groove box
├── Section[]                 # Sections en lecture seule
│   └── Grid                  # Cellules non-éditables
│       └── BeatCell (read-only, highlight lors de la lecture)
├── ChordSummary              # Diagrammes des accords
└── Print footer              # Visible uniquement @media print
```

### Diagrammes d'Accords

```
ChordDiagram (SVG)            # Instruments à cordes
├── Nut (sillet) ou fret number
├── Fret lines (5)
├── String lines (4-6)
├── Open/Muted indicators (○/✕)
├── Barre rect
└── Finger dots avec numéros

PianoKeyboard (SVG)           # Piano
├── White keys
├── Black keys
└── Highlighted notes
```

---

## Collections Firestore

### `sheets` — Grilles d'accords

```
sheets/{sheetId}
├── title: string
├── artist: string
├── key: string
├── tempo: string
├── tempoUnit: 'quarter' | 'eighth' | null
├── ownerId: string
├── ownerName: string
├── isPublic: boolean
├── isUnlisted: boolean         # accessible via lien, pas dans Explore
├── unlistedBySetIds: string[]  # sets publics ayant rendu la grille non listée
├── sections: Section[]         # Embedded array
├── tags: string[]
├── genres: string[]
├── difficulty: 1|2|3 | null
├── capo: number | null
├── instrumentId: string | null
├── customChords: {             # Map d'accords personnalisés
│     "am-guitar": {...},
│   }
├── referenceUrl: string | null # YouTube, Spotify...
├── forkedFrom: string | null   # id de la grille source
├── lyrics: string | null       # Paroles (instrument voix)
├── createdAt: Timestamp
├── updatedAt: Timestamp
├── viewCount: number
├── averageRating: number | null
└── ratingCount: number
```

### `users` — Utilisateurs

```
users/{userId}
├── displayName: string
├── email: string
├── photoURL: string | null
├── role: 'user' | 'admin'
├── preferredInstrument: string | null
├── notationPreference: 'american' | 'french' | null
├── chordColorCoding: boolean | null
├── showInlineDiagram: boolean | null
├── darkMode: boolean | null
├── minimizeRepeatedSections: boolean | null
├── printMinimizeRepeatedSections: boolean | null
├── printChordDiagrams: boolean | null
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

### `bookmarks` — Favoris

```
bookmarks/{bookmarkId}
├── userId: string
├── sheetId: string
└── addedAt: Timestamp
```

### `ratings` — Notes

```
ratings/{ratingId}
├── userId: string
├── sheetId: string
├── rating: 1|2|3|4|5
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

### `sets` — Setlists

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

### `library_chords` — Bibliothèque admin

```
library_chords/{docId}
├── type: 'override' | 'addition'
├── chordName: string
├── instrumentId: InstrumentId
└── chord: StringChord | PianoChord
```
- **override** : remplace la position par défaut d'un accord existant
- **addition** : ajoute une variante supplémentaire

---

## Règles Firestore (résumé)

| Collection | Lecture | Écriture |
|------------|---------|---------|
| `users` | Tout utilisateur auth | Soi-même ou admin |
| `sheets` | Public si `isPublic`, sinon propriétaire/admin | Propriétaire ou admin (viewCount/rating : tout auth) |
| `sets` | Public si `isPublic`, sinon propriétaire/admin | Propriétaire ou admin |
| `bookmarks` | Propriétaire ou admin | Propriétaire (create), propriétaire/admin (delete) |
| `ratings` | Tout utilisateur auth | Propriétaire ou admin |
| `library_chords` | Tout utilisateur auth | Admin uniquement |

La fonction `isAdmin()` fait un `get()` sur `users/{uid}` et vérifie `role == 'admin'`.

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

### Import depuis texte

```
1. User clique "Importer"
2. ImportSheetModal s'ouvre
3. User colle le texte (format Ultimate Guitar ou libre)
4. parseChordSheetText() extrait : titre, artiste, capo, tonalité, URL YouTube, sections
5. Prévisualisation affichée dans la modal
6. User confirme → SheetEditor reçoit les sections importées
```
Voir `docs/IMPORT.md` pour le détail du parser.

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

Une mesure 4/4 = 4 temps = 16 colonnes CSS (chaque 0.25 span = 1 col)

```
┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  (grid-cols-16)
└──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
  ←── temps 1 ──→  ←── temps 2 ──→ ...
```

| Span | Colonnes | Usage courant |
|------|----------|---------------|
| 0.25 | 1 | Triple croche |
| 0.5  | 2 | Demi-temps / croche |
| 1    | 4 | Un temps (noire) |
| 2    | 8 | Deux temps |
| 3    | 12 | Ligne complète 3/4 |
| 4    | 16 | Ligne complète 4/4 |

### Extend Left/Right

```
Avant:  [Am|1] [G|1] [C|1] [D|1]
               ↑ extendRight
Après:  [Am|1] [G|2]       [D|1]
```

### Shrink

```
Avant:  [Am|2]
         ↑ shrink
Après:  [Am|1] [  |1]
```

---

## Audio

### Architecture

```
chord-audio.ts                # Primitives Web Audio API
├── playChord(chord, inst, capo)    # Accord complet (strum simulé)
├── playNote(freq, isPiano)         # Note isolée
└── playMetronomeTick(accent)       # Click métronome

use-playback.ts               # Hook lecture de grille
├── buildSequence(sections, beatMs) # Construit la liste des steps
├── playSequence / playRow / playSection
├── togglePlay / stop
└── activeStep                      # Cellule en cours (highlight UI)

use-groove-box.ts             # Hook boîte à rythmes
├── 8 patterns (rock, pop, jazz, blues, reggae, funk, bossa, country)
├── Samples CR78 (Tone.js CDN) avec synthèse de secours
├── GENRE_MAP : genres de la grille → pattern
└── Scheduler avec Web Audio clock (lookahead 100ms, tick 25ms)
```

### Tuning des instruments

```typescript
OPEN_FREQS = {
  guitar:  { 1:329.63, 2:246.94, 3:196.00, 4:146.83, 5:110.00, 6:82.41 },
  ukulele: { 1:440.00, 2:329.63, 3:261.63, 4:392.00 },
  mandolin:{ 1:659.25, 2:440.00, 3:293.66, 4:196.00 },
  banjo:   { 1:293.66, 2:246.94, 3:196.00, 4:146.83, 5:392.00 },
  bass:    { 1:98.00,  2:73.42,  3:55.00,  4:41.20  },
}
```

### Oscillateurs

- Cordes : `triangle` (plus chaud que `sine`)
- Piano : `sine`
- Métronome : `square` (440 Hz accent, 800 Hz temps normal)
- Decay : 2.2s cordes, 1.8s piano

---

## SVG Chord Diagram

### Coordonnées

```
sm (size='sm')          md (size='md')
W ≈ 110-130px           W ≈ 170-198px
H = 158px               H = 240px
PAD = 20px              PAD = 30px
CELL_W = 18px           CELL_W = 28px
DOT_R = 7px             DOT_R = 13px
```

### Calculs clés

```typescript
const getSX = (s) => RIGHT - (s - 1) * CELL_W;  // X corde (1=aigu, N=grave)
const getFY = (f) => TOP + (f - startFret) * CELL_H + CELL_H / 2;  // Y case
```

---

## Historique des Décisions

### 2024-01 — Structure Cellules
- Choix de `span` en temps (multiples de 0.25) vs colonnes entières
- Raison : plus intuitif pour les musiciens

### 2024-02 — Firestore vs Realtime Database
- Choix : Firestore
- Raison : requêtes complexes, offline, structure de document

### 2024-03 — CustomChords dans Sheet
- Choix : embedded dans le document Sheet
- Alternative rejetée : collection séparée
- Raison : évite les jointures, données cohérentes

### 2024-04 — Conversion fingers pour Firestore
- Problème : Firestore refuse les tableaux imbriqués
- Solution : conversion `[s,f,d]` → `{s,f,d}` dans helpers

### 2024-05 — GrooveBox (patterns par genre)
- GENRE_MAP mappe les genres de la grille vers un pattern de batterie
- Samples CR78 chargés depuis Tone.js CDN, synthèse de secours si indisponibles
- Scheduler Web Audio avec lookahead 100ms pour éviter les glitches

---

## Mise à Jour de cette Doc

**Quand mettre à jour :**
- Ajout d'un nouveau composant majeur
- Changement de structure de données
- Nouvelle collection Firestore
- Modification du flux de données

**Fichiers à vérifier :**
- `CLAUDE.md` : Quick Reference et Fichiers Clés
- `docs/ARCHITECTURE.md` : ce fichier
- `docs/IMPORT.md` : si le parser change
