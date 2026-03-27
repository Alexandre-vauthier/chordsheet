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

## V3 - En cours

### Bugs à corriger

- [ ] **Sets disparaissent** : Problème d'index Firestore composite ?
- [ ] **Admin stats à 0** : Vérifier le chargement des données

### Gestion des accords (diagrammes)

- [ ] **Diagrammes SVG** : Positions d'accords guitare et piano
  - Format : `Am-guitare-1.svg`, `Am-guitare-2.svg`, `Am-piano-1.svg`...
  - Plusieurs variantes par accord (positions différentes)
- [ ] **Switch guitare/piano** : Dans la consultation de grille
- [ ] **Préférence notation** : Américain (Am, C, G) ou Français (La m, Do, Sol)
  - Tableau de correspondance dans le profil utilisateur
  - Affichage adapté selon la préférence

### Page Explorer améliorée

- [x] **Système de notation** : Étoiles/notes sur les grilles publiques
- [x] **Filtres avancés** :
  - Par genre musical
  - Par difficulté (1-5 étoiles)
  - Mieux notés
  - Plus récents
  - Plus consultés (viewCount)

### Détection des doublons

- [ ] Alerter si une grille existe déjà (même titre + même artiste)
- [ ] Suggérer les grilles similaires lors de la création

---

## V4 - Futur

### Pages artistes

- [ ] Collection `artists` : `{ name, genres[], imageUrl, bio }`
- [ ] Page `/artists` : Liste des artistes
- [ ] Page `/artists/[slug]` : Toutes les grilles d'un artiste
- [ ] Auto-complétion artiste dans l'éditeur

### Autres idées

- [ ] Transposition automatique des accords
- [ ] Mode sombre
- [ ] PWA (offline)
- [ ] Export PDF amélioré
- [ ] Partage par QR code

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
