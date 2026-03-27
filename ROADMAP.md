# ChordSheet - Roadmap V2

## Priorité 1 - Corrections urgentes

- [ ] **Bug caractères spéciaux** : Le "é" dans les noms d'utilisateur est cassé

## Priorité 2 - Enrichissement des métadonnées

### Infos musique
- [ ] **Date de sortie** : Champ année + filtre dans l'explorateur
- [ ] **Genre musical** : Tags multiples (Rock, Jazz, Pop, etc.) + filtre
- [ ] **Difficulté** : Niveau 1-5 étoiles + filtre
- [ ] **Capo** : Champ dans l'éditeur (affichage "Capo 2" sur la grille)

### Éditeur
- [ ] **Grille ternaire** : Option 3 temps par mesure (valse, 6/8, etc.)

## Priorité 3 - Fonctionnalités sociales

### Mon Book (favoris)
- [ ] Collection `bookmarks` : `{ userId, sheetId, addedAt }`
- [ ] Bouton "Ajouter à mon book" sur les grilles publiques
- [ ] Page `/book` : Mes grilles likées

### Mes Sets / Listes
- [ ] Collection `sets` : `{ name, ownerId, sheetIds[], isPublic, createdAt }`
- [ ] Page `/sets` : Liste des sets
- [ ] Page `/sets/[id]` : Détail d'un set avec ordre des morceaux
- [ ] Glisser-déposer pour réorganiser
- [ ] Mode "Concert" : Navigation rapide entre les grilles

## Priorité 4 - Gestion utilisateur

### Page profil
- [ ] Page `/profile` : Modifier nom, photo, etc.
- [ ] Changer d'email / mot de passe
- [ ] Supprimer son compte

### Administration
- [ ] Champ `role` dans la collection `users` : "user" | "moderator" | "admin"
- [ ] Admin par défaut : `alex.vauthier@gmail.com`
- [ ] Page `/admin` : Gestion des utilisateurs, modération des grilles

## Priorité 5 - Pages artistes (optionnel)

- [ ] Collection `artists` : `{ name, genres[], imageUrl, bio }`
- [ ] Page `/artists` : Liste des artistes
- [ ] Page `/artists/[slug]` : Toutes les grilles d'un artiste
- [ ] Auto-complétion artiste dans l'éditeur

---

## Modèle de données à ajouter

```
// Collection bookmarks
bookmarks/{bookmarkId}
├── userId: string
├── sheetId: string
└── addedAt: timestamp

// Collection sets
sets/{setId}
├── name: string
├── ownerId: string
├── sheetIds: string[]
├── isPublic: boolean
├── createdAt: timestamp
└── updatedAt: timestamp

// Champs à ajouter dans sheets
sheets/{sheetId}
├── ... (existants)
├── releaseYear: number | null
├── genres: string[]
├── difficulty: 1 | 2 | 3 | 4 | 5 | null
└── capo: number | null

// Champ à ajouter dans users
users/{userId}
├── ... (existants)
└── role: "user" | "moderator" | "admin"
```

---

## Par où commencer ?

Je recommande de commencer par :
1. **Fixer le bug des caractères spéciaux** (rapide)
2. **Ajouter les métadonnées simples** (genre, difficulté, capo)
3. **Implémenter Mon Book** (favoris)

Tu veux qu'on commence par quoi ?
