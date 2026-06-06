# Import depuis texte — ChordSheet

Fichier : `src/lib/chord-sheet-parser.ts`  
Composant : `src/components/sheet/import-sheet-modal.tsx`

---

## Ce que le parser extrait

| Champ | Source dans le texte |
|-------|---------------------|
| `title` | Première ligne non-URL (`"Le Sud Accords par Nino Ferrer"`, `"Title - Artist"`) |
| `artist` | Même ligne que le titre |
| `capo` | `"Capodastre: 2"` ou `"Capo 2"` (français et anglais) |
| `key` | `"Tonalité: Am"` ou `"Key: Am"` — sinon premier accord de la première section |
| `referenceUrl` | URL YouTube (`youtube.com` ou `youtu.be`) — préférence pour la ligne qui contient aussi le capo |
| `sections` | Blocs délimités par `[Section]` |

---

## Filtrage des lignes parasites (isNoiseLine)

Les lignes suivantes sont **ignorées** :

- Lignes vides
- `Page N/N`
- URLs (`https://...`)
- Tablatures guitare/basse : `e|---`, `B|---`, etc.
- En-têtes de métadonnées : `Difficulté:`, `Accordage:`, `Tonalité:`, `Tuning:`, `Key:`, `Difficulty:`, `Accords:`
- Lignes BPM (`120 bpm`, `BPM: 90`)
- Marqueurs de rythme strumming (lignes composées de chiffres, `&`, espaces)
- Annotations capo courtes (`Capodastre: 2`, `Capo 2`, `no capo`)

---

## Détection des sections

- Marqueur : ligne de la forme `[Label]` (entre crochets, seule sur sa ligne)
- Labels traduits automatiquement (anglais → français) :

| Anglais | Français |
|---------|---------|
| intro | Intro |
| verse | Couplet |
| chorus | Refrain |
| pre-chorus | Pré-refrain |
| bridge | Bridge |
| outro | Outro |
| solo | Solo |
| interlude | Interlude |
| instrumental | Instrumental |

Les numéros sont conservés : `[Verse 2]` → `Couplet 2`

---

## Détection des lignes d'accords (isChordLine)

Une ligne est considérée comme ligne d'accords si **≥ 80% de ses tokens sont des accords valides**.

Regex accord reconnu :
```
[A-G][#b]? + (modificateurs : m, maj, min, dim, aug, sus2, sus4, 7, 9, 11, 13, add9...)
             + (altérations : b5, #9, -5...)
             + (basse : /G, /F#...)
```

Exemples valides : `Am`, `G7`, `C#m7`, `Bb`, `Fmaj7`, `Gsus4`, `D/F#`, `G7b5`, `Bm7-5`

---

## Inférence de la durée (span) depuis la position

La durée de chaque accord dans une mesure est **inférée depuis la position des caractères** sur la ligne (espacement typographique Ultimate Guitar).

### Algorithme

1. **1 accord** → span = `beatsPerMeasure` (mesure entière)
2. **5+ accords** → tous span = 1, découpage en lignes de 4
3. **2-4 accords** :
   - Calculer les gaps de colonnes entre chaque accord
   - Normaliser : `span = (gap / totalWidth) × beatsPerMeasure`
   - Snap vers la valeur valide la plus proche : `[0.5, 1, 2, 3, 4]`
   - Corriger pour que la somme = `beatsPerMeasure`

### Exemple

```
Am      G       C       D
0       8       16      24      (positions colonnes)
gaps =  8,      8,      8,      (8 estimé pour le dernier)
total = 32
spans = 8/32×4, 8/32×4, 8/32×4, 8/32×4 = 1, 1, 1, 1
```

```
Am              G
0               16
gaps = 16, 16
spans = 2, 2
```

---

## Format de sortie (ImportedSheet)

```typescript
interface ImportedSheet {
  title: string;
  artist: string;
  key: string;
  capo: number | null;
  referenceUrl?: string;
  sections: Section[];   // beatsPerMeasure toujours 4 à l'import
}
```

Les sections importées sont injectées dans `SheetEditor` via `onImport(imported)`.  
L'utilisateur peut ensuite ajuster les métadonnées et sauvegarder.

---

## Limitations connues

- `beatsPerMeasure` est toujours 4 à l'import (pas de détection du 3/4)
- Le titre/artiste n'est extrait que si la première ligne suit le format `"Titre - Artiste"` ou `"Titre Accords par Artiste"`
- Les paroles entremêlées aux accords ne sont pas séparées
