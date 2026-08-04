# Roadmap

Ce qui est décidé mais pas fait, ce qui a été écarté et pourquoi, ce qui attend
une décision. Document partagé : il sert autant à retrouver le fil qu'à éviter de
re-proposer ce qui a déjà été tranché.

Établi le 4 août 2026. Les absences citées ont été vérifiées dans le code à cette
date ; l'ordre de priorité, lui, est un jugement.

---

## Fait

- **Des tests, là où ça a fait mal** (5 août 2026) : vingt-sept contrôles lancés
  par `npm test`, sans nouvelle dépendance de production. Ils portent sur la
  théorie des accords, l'ordre des variantes et les règles du service worker.
  Chacun a été vérifié en remettant le défaut d'origine : un test qui passe sans
  attraper ce qu'il vise ne vaut rien, et le premier écrit était dans ce cas.
- **Le verrou d'écran** (4 août 2026) : `useWakeLock`, actif sur le mode concert,
  la session live et la consultation d'une grille. Le verrou se relâche quand la
  page passe en arrière-plan et se reprend au retour, ce qui le rend sans danger
  sur une simple consultation.
- **Le hors ligne** (4 août 2026), en deux couches : le cache persistant de
  Firestore (une grille consultée reste lisible sans réseau, les modifications
  partent au retour de la connexion) et un service worker pour la coque, avec une
  page de repli à `/offline`.
- **Le préchargement d'une setlist et le signalement hors ligne** (4 août 2026) :
  un bouton sur la page d'une setlist met ses grilles en cache d'avance, et un
  bandeau discret apparaît quand la connexion tombe. Le premier existe parce qu'on
  prépare un concert chez soi et qu'on le joue ailleurs ; le second parce que sans
  lui la coupure ne se voit qu'au moment où elle déçoit, et passe pour une panne
  de l'application.

## Décidé, à faire

### 1. Import et export ChordPro

C'est le format d'échange de ce monde (OnSong, SongBook, les exports d'Ultimate
Guitar). Deux besoins distincts, également importants :

- **entrer** : un créateur avec deux cents morceaux ailleurs ne les recopiera pas
  à la main ;
- **sortir** : on n'entre pas dans un outil dont on ne peut pas ressortir.

L'import texte existant (`docs/IMPORT.md`) lit un format de tablature, pas
ChordPro. À voir s'il se généralise ou s'il vaut mieux un lecteur séparé, comme
pour les dictionnaires d'accords.

### 2. Historique de version d'une grille

Rien dans le modèle de données : pas de révision, pas de corbeille. Une mauvaise
manipulation sur une grille travaillée pendant des mois est définitive.

Pour quelqu'un qui confie son répertoire entier, c'est le genre d'incident dont un
produit ne se remet pas. Une corbeille avec restauration à trente jours couvre
déjà l'essentiel du risque, pour bien moins cher qu'un historique complet.

### 3. Étendre les tests

Vingt-sept tests existent (`npm test`), posés là où les défauts ont eu lieu :
théorie des accords, résolution des variantes, règles du service worker. Chacun a
été éprouvé en réintroduisant le défaut historique qu'il doit attraper.

Restent sans filet, par ordre d'intérêt :

- **les durées de lecture** (`buildSequence`, `buildChordSequence`) : les
  répétitions de mesure et de section s'y comptent, et une erreur y décale tout
  un morceau ;
- **les règles du catalogue** (`sheet-catalogue.ts`) : ce qui est public, ce qui
  est une copie de groupe. Un défaut y cache des grilles sans rien dire ;
- **le parseur d'import** (`chord-sheet-parser.ts`), déjà couvert par des essais
  manuels lors de son écriture, jamais figés.

---

## Écarté

### Les accords au-dessus des paroles

**Décision d'Alexandre, août 2026 : non.** Ce n'est pas la direction prise par le
produit, et la mise en forme propre n'est pas évidente (aligner un accord sur une
syllabe demande un modèle de données et une édition entièrement différents de la
grille de mesures).

Les paroles restent ce qu'elles sont : un bloc de texte, sur l'instrument Voix.

Consigné ici pour ne pas revenir le proposer.

---

## En attente d'une décision

- **Les dix-neuf grilles de groupe existantes** : leur `ownerId` est encore
  personnel alors que les nouvelles copies appartiennent au groupe. Quatorze sont
  publiques, donc changer l'auteur affiché se voit de l'extérieur.
- **Les sets créés dans un groupe** portent eux aussi un `ownerId` personnel.
  Même question, pas engagée.
- **Les surcharges et ajouts de la bibliothèque d'accords** : Alexandre s'en
  occupe lui-même. Pour mémoire, au 4 août : 56 surcharges (10 guitare, 41
  mandoline, 5 banjo) et 44 ajouts (24 guitare, 18 mandoline, 2 piano). Une partie
  masque les doigtés relevés sur les documents, et quinze ne sonnent pas leur nom.
- **Les messages d'erreur des routes API** ne sont pas traduits. Chantier à part.

---

## Dette connue, sans urgence

- **`ride.wav` du kit Classic** a une crête de 0,16 quand les autres sont à 1,0 :
  inaudible sur les rythmes jazz, qui reposent dessus. À remonter dans l'éditeur
  audio, ou à compenser par un gain.
- **Cent quatre-vingt-onze accords sans référence extérieure** (voir
  `tools/dictionnaire-accords/INVENTAIRE.md`), dont les cent dix-neuf du piano et
  les triades diminuées des quatre instruments à cordes. Aucun document ne les
  couvre encore.
- **Trois voix de la boîte à rythme ne servent dans aucun motif** : les deux toms
  et le tambourin. À employer ou à retirer.
