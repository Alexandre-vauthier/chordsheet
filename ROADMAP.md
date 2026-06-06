# ChordSheet - Roadmap

## V2 - Complété

- [x] Bug caractères spéciaux (latin-ext fonts)
- [x] Métadonnées : genre, difficulté, capo
- [x] Grille ternaire (3/4, 6/8)
- [x] Mon Book (favoris)
- [x] Mes Sets (setlists avec drag-and-drop et mode concert)
- [x] Page profil (modification nom, avatar initiale)
- [x] Administration (rôle admin, stats, suppression grilles)
- [x] Validation création grille (titre, artiste, 1 accord minimum)

---

## V3 - Complété

### Bugs corrigés

- [x] **Sets disparaissent** : Fallback client-side si index Firestore composite manquant
- [x] **Admin stats à 0** : Chargement des données corrigé via Promise.all

### Gestion des accords

- [x] **Diagrammes SVG** : Positions d'accords guitare et piano (chord-diagram.tsx, piano-keyboard.tsx)
- [x] **Switch guitare/piano** : Sélecteur d'instrument dans la consultation de grille
- [x] **Préférence notation** : Américain (Am, C, G) ou Français (La m, Do, Sol) dans le profil

### Import de grilles

- [x] **Import depuis texte** : Extraction titre, artiste, tonalité, capo, URL YouTube, durée des accords inférée depuis la position

### Page Explorer

- [x] **Système de notation** : Étoiles/notes sur les grilles publiques
- [x] **Filtres avancés** : Genre, difficulté, mieux notés, plus récents, plus consultés

### Reste à faire

- [ ] **Détection des doublons** : Alerter si une grille existe déjà (même titre + même artiste), suggérer les grilles similaires lors de la création

---

## V4 - En cours

### Complété

- [x] **Pages artistes** : Page `/artist/[name]` avec toutes les grilles et artwork
- [x] **Transposition automatique** : Contrôles de transposition dans le mode consultation
- [x] **Mode sombre** : Toggle dans le profil, variables CSS complètes

### À faire

- [ ] **Auto-complétion artiste** : Dans l'éditeur (champ artiste actuellement en saisie libre)
- [ ] **Page `/artists`** : Liste de tous les artistes + collection `artists` `{ name, genres[], imageUrl, bio }`
- [ ] **Export PDF amélioré** : Génération programmatique (actuellement : impression navigateur uniquement)
- [ ] **PWA (offline)** : manifest.json + service worker
- [ ] **Partage par QR code**

---

## Correspondance notation accords

| Américain | Français |
|-----------|----------|
| C | Do |
| D | Ré |
| E | Mi |
| F | Fa |
| G | Sol |
| A | La |
| B | Si |
| m (minor) | m (mineur) |
| M (major) | M (majeur) |
| 7 | 7 |
| maj7 | maj7 |
| sus4 | sus4 |
| dim | dim |
| aug | aug |

Exemples :
- Am = La m
- C#m7 = Do# m7
- Gmaj7 = Sol maj7
- Fsus4 = Fa sus4
