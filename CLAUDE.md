# ChordSheet - Guide Claude

> Application web pour créer, partager et imprimer des grilles d'accords.

## Quick Reference

| Aspect | Valeur |
|--------|--------|
| **Stack** | Next.js 15 (App Router) + React 19 + Firebase + Tailwind CSS 4 |
| **Langue UI** | Français |
| **Langue code** | Anglais (noms de variables, types) |
| **Repo** | github.com/Alexandre-vauthier/chordsheet |

---

## Structure du Projet

**i18n (en cours)** : toutes les routes pages vivent sous `app/[locale]/` (`fr`/`en`, `fr` par défaut) — voir `src/i18n/` (routing, navigation, request config) et `src/proxy.ts` (détection/redirection de locale, ex-`middleware.ts` renommé par Next 16). Utiliser `Link`/`useRouter`/`usePathname`/`redirect` depuis `@/i18n/navigation` (jamais `next/link`/`next/navigation` directement) — `usePathname()` renvoie le chemin sans le préfixe de locale. `src/app/export/` reste volontairement HORS `[locale]` (cible de rendu Puppeteer pour le PDF, jamais visitée par un humain) et a son propre `layout.tsx` racine. Phase actuelle : infrastructure de routing en place, extraction des textes UI vers `messages/{fr,en}.json` pas encore faite (l'UI reste 100% française pour l'instant, y compris sous `/en`).

```
src/
├── app/                    # Pages Next.js (App Router)
│   ├── [locale]/           # Wrapper i18n (fr/en) — layout racine (html/body) ici
│   │   ├── (auth)/         # Routes auth (login, register)
│   │   ├── (main)/         # Routes principales (avec navbar)
│   │   │   ├── dashboard/      # Mes grilles
│   │   │   ├── book/           # Mon book (favoris)
│   │   │   ├── explore/        # Grilles publiques
│   │   │   ├── sets/           # Setlists + mode concert (sets/[id]/play)
│   │   │   ├── sheet/          # CRUD grilles
│   │   │   │   ├── new/        # Création
│   │   │   │   └── [id]/       # Consultation + édition
│   │   │   ├── chords/         # Bibliothèque d'accords
│   │   │   ├── artist/[name]/  # Grilles d'un artiste
│   │   │   ├── user/[id]/      # Profil public utilisateur
│   │   │   ├── profile/        # Mon profil (préférences)
│   │   │   ├── admin/          # Administration (admins uniquement)
│   │   │   └── legal/          # Pages légales (CGU, CGV...)
│   │   └── layout.tsx      # Layout racine (html/body, providers, i18n)
│   └── export/              # Export PDF (hors [locale], cible Puppeteer)
│
├── components/
│   ├── chord/              # Diagrammes d'accords
│   │   ├── chord-diagram.tsx      # SVG manche guitare
│   │   ├── chord-editor.tsx       # Éditeur positions doigts
│   │   ├── chord-editor-modal.tsx # Modal édition
│   │   ├── chord-card.tsx         # Carte d'accord (bibliothèque)
│   │   ├── chord-finder.tsx       # Recherche dans la bibliothèque
│   │   ├── chord-summary.tsx      # Résumé accords grille
│   │   ├── chord-suggestions.tsx  # Suggestions variantes
│   │   ├── piano-keyboard.tsx     # SVG clavier piano
│   │   └── instrument-selector.tsx
│   │
│   ├── sheet/              # Grille d'accords
│   │   ├── sheet-editor.tsx       # Éditeur complet
│   │   ├── sheet-viewer.tsx       # Mode consultation (+ transposition)
│   │   ├── section-block.tsx      # Section (Intro, Refrain...)
│   │   ├── grid-row.tsx           # Ligne de mesure
│   │   ├── beat-cell.tsx          # Cellule (1 temps)
│   │   ├── import-sheet-modal.tsx # Import depuis texte (UG format)
│   │   ├── coach-mark.tsx         # Hints tutoriels
│   │   └── rating-stars.tsx       # Étoiles de notation
│   │
│   ├── explore/            # Composants liste
│   │   ├── sheet-card.tsx         # Carte aperçu grille
│   │   └── welcome-banner.tsx     # Hero section
│   │
│   ├── layout/             # Layout
│   │   ├── navbar.tsx
│   │   └── footer.tsx
│   │
│   └── ui/                 # Composants génériques
│       ├── button.tsx
│       └── input.tsx
│
├── lib/                    # Logique métier
│   ├── firebase.ts              # Config Firebase
│   ├── firestore-helpers.ts     # CRUD Firestore
│   ├── auth-context.tsx         # Context auth
│   ├── library-chords-context.tsx  # Context bibliothèque accords (overrides admin)
│   ├── chord-data.ts            # Bibliothèque accords (7 instruments)
│   ├── chord-audio.ts           # Synthèse audio Web Audio API
│   ├── chord-finder.ts          # Logique recherche accords
│   ├── chord-sheet-parser.ts    # Parser import texte (Ultimate Guitar)
│   ├── transpose.ts             # Transposition des accords
│   ├── compute-difficulty.ts    # Calcul automatique difficulté
│   ├── use-playback.ts          # Hook lecture audio grille complète
│   ├── use-groove-box.ts        # Hook boîte à rythmes (patterns par genre)
│   ├── use-bookmarks.ts         # Hook favoris
│   ├── use-ratings.ts           # Hook notes
│   ├── use-sets.ts              # Hook setlists
│   ├── use-artwork.ts           # Hook artwork album (fetch externe)
│   ├── use-chord-color.ts       # Hook couleur des accords
│   ├── use-chord-notation.ts    # Hook conversion notation américain/français
│   └── use-chord-variants.ts    # Hook variantes de doigtés
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
  tempoUnit?: 'quarter' | 'eighth';  // Unité de tempo (noire ou croche)
  ownerId: string;
  ownerName: string;
  isPublic: boolean;
  isUnlisted?: boolean;     // Accessible via lien, non listé dans Explore
  sections: Section[];      // Intro, Couplet, Refrain...
  tags: string[];
  genres: string[];         // Rock, Pop, Jazz...
  difficulty: 1|2|3 | null;
  capo: number | null;
  instrumentId?: InstrumentId;
  customChords?: Record<string, CustomChord>;  // Accords personnalisés
  referenceUrl?: string;    // Lien YouTube/Spotify
  forkedFrom?: string;      // id de la grille source si fork
  lyrics?: string;          // Paroles (instrument Voix)
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
  rowRepeats?: number[];    // Répétitions par mesure (index = rowIndex)
}

type Row = Cell[];          // Une mesure

// CellSpan = tout multiple de 0.25 de 0.25 à 4
// Chaque 0.25 = 1 colonne dans une grille de 16 colonnes
type CellSpan = 0.25 | 0.5 | 0.75 | 1 | 1.25 | ... | 4;

interface Cell {
  chord: string;            // "Am", "G7", ""
  span: CellSpan;           // Durée en temps
}
```

### User (Utilisateur)

```typescript
interface User {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: 'user' | 'admin';
  preferredInstrument?: InstrumentId;
  notationPreference?: 'american' | 'french';
  chordColorCoding?: boolean;
  showInlineDiagram?: boolean;
  darkMode?: boolean;
  minimizeRepeatedSections?: boolean;
  printMinimizeRepeatedSections?: boolean;
  printChordDiagrams?: boolean;
}
```

### Accords

```typescript
// Accord à cordes (guitare, ukulele, mandoline, banjo, basse)
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
| Import texte | `import-sheet-modal.tsx`, `chord-sheet-parser.ts` — voir `docs/IMPORT.md` |
| Diagrammes accords | `chord-diagram.tsx`, `piano-keyboard.tsx` |
| Édition accord custom | `chord-editor.tsx`, `chord-editor-modal.tsx` |
| Transposition | `transpose.ts`, contrôles dans `sheet-viewer.tsx` |
| Persistance | `firestore-helpers.ts` |
| Audio / lecture | `chord-audio.ts`, `use-playback.ts` |
| Boîte à rythmes | `use-groove-box.ts` |
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
| bass | Basse | 4 |
| piano | Piano | - |
| voice | Voix | - |

---

## Documentation Détaillée

- `docs/ARCHITECTURE.md` : hiérarchie composants, flux données, règles Firestore, audio
- `docs/IMPORT.md` : parser d'import texte (Ultimate Guitar), logique d'inférence des durées
