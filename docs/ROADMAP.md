# Roadmap

Ce qui est décidé mais pas fait, ce qui a été écarté et pourquoi, ce qui attend
une décision. Document partagé : il sert autant à retrouver le fil qu'à éviter de
re-proposer ce qui a déjà été tranché.

Établi le 4 août 2026. Les absences citées ont été vérifiées dans le code à cette
date ; l'ordre de priorité, lui, est un jugement.

---

## Décidé, à faire

### 1. Fonctionner hors ligne

Il y a un manifeste (l'application s'installe) mais aucun service worker : rien
n'est mis en cache. Pas de réseau en cave de répétition ou sur scène, pas de
setlist.

C'est le point qui décide de tout le reste. Tant qu'un musicien ne peut pas
compter dessus le soir du concert, la bibliothèque d'accords et la boîte à rythme
ne servent à rien : il aura imprimé ses grilles.

Portée minimale : la coque de l'application, les grilles du book et les setlists
consultées récemment.

### 2. Empêcher l'écran de s'éteindre

Aucun appel à l'API Wake Lock dans le code. Une tablette posée sur un pied
s'endort au deuxième couplet.

Vingt lignes, sur le mode concert et sur la consultation d'une grille. Le meilleur
rapport effort sur valeur de cette liste. À relâcher quand l'onglet passe en
arrière-plan, et à reprendre au retour (le verrou est perdu à chaque masquage).

### 3. Import et export ChordPro

C'est le format d'échange de ce monde (OnSong, SongBook, les exports d'Ultimate
Guitar). Deux besoins distincts, également importants :

- **entrer** : un créateur avec deux cents morceaux ailleurs ne les recopiera pas
  à la main ;
- **sortir** : on n'entre pas dans un outil dont on ne peut pas ressortir.

L'import texte existant (`docs/IMPORT.md`) lit un format de tablature, pas
ChordPro. À voir s'il se généralise ou s'il vaut mieux un lecteur séparé, comme
pour les dictionnaires d'accords.

### 4. Historique de version d'une grille

Rien dans le modèle de données : pas de révision, pas de corbeille. Une mauvaise
manipulation sur une grille travaillée pendant des mois est définitive.

Pour quelqu'un qui confie son répertoire entier, c'est le genre d'incident dont un
produit ne se remet pas. Une corbeille avec restauration à trente jours couvre
déjà l'essentiel du risque, pour bien moins cher qu'un historique complet.

### 5. Des tests automatisés

Quarante mille lignes, trois cent soixante-dix-sept commits de correction, zéro
test. C'est le seul endroit où le projet est plus jeune que sa taille.

Les défauts trouvés en août sont exactement ceux qu'un test attrape : un accord
qui ne sonne pas les notes de son nom, une lecture qui joue autre chose que ce
qu'elle affiche, un barré qui traverse une corde à vide. Les contrôles ont été
écrits à chaque fois, mais en scripts jetables : ils ont vérifié une fois puis
disparu.

Commencer par figer une vingtaine d'entre eux, sur les fonctions pures : théorie
des accords, résolution des variantes, règles du catalogue, durées de lecture.

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
