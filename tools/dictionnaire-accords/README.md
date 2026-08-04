# Relevé d'un dictionnaire d'accords imprimé

Chaîne qui lit les diagrammes d'un dictionnaire d'accords en PDF et les convertit
au format de `src/lib/chord-data.ts`. Elle a servi à reprendre les 231 accords de
guitare ; elle est faite pour resservir sur les autres instruments.

Rien à installer : pas de bibliothèque image sur la machine, tout est en Python
standard. Les pages du PDF sont des images RVB compressées en zlib, on les
décompresse et on travaille sur les octets.

## La chaîne

```bash
cd tools/dictionnaire-accords
python3 pdf.py ~/Desktop/mon-dictionnaire.pdf .   # PDF → img<n>.raw, affiche PAGES
python3 final.py                                  # lecture + contrôle harmonique
python3 convertir.py                              # → pdf-app.json, au format de l'app
```

| Fichier | Rôle |
|---|---|
| `pdf.py` | Sort les pages du PDF en `.raw` et affiche la ligne `PAGES` à reporter |
| `cartes.py` | Accès aux pixels, liste des pages |
| `dico.py` | Géométrie des cartes, lecture d'un diagramme, repérage des rangées |
| `titres.py` | Découpe des titres bleus en glyphes (sert quand l'ordre des colonnes est douteux) |
| `extraire_final.py` | Table des chiffres imprimés, apprise sur le document entier |
| `final.py` | Lecture des cartes + contrôle : aucune note étrangère, fondamentale présente |
| `convertir.py` | Passage au format `StringChord` de l'application |
| `png.py` | Lecture et écriture de PNG, pour **regarder** une carte au lieu de la deviner |

## Les autres instruments

Trois planches PNG, trois mises en page sans rien de commun : un lecteur chacun
plutôt qu'un paramétrage qui les couvrirait mal toutes les trois.

```bash
python3 mandoline.py ~/Desktop/mandoline-chords.png   &&  python3 convertir_mandoline.py
python3 banjo.py     ~/Desktop/banjo-chords.png       &&  python3 convertir_banjo.py
python3 ukulele.py   ~/Desktop/ukulele-chords.png     &&  python3 convertir_ukulele.py
```

| Planche | Disposition | Particularité |
|---|---|---|
| Mandoline | fondamentales en colonnes, types en rangées | numéro de case minuscule à gauche du manche |
| Banjo | fondamentales en rangées, types en colonnes | cinq cordes, chanterelle jamais frettée, repère à droite |
| Ukulélé | fondamentales en rangées, types en colonnes | deux doigtés superposés par carte, le second en cercles creux |

Ce que ces trois relevés ont appris et qui resservira : **ne jamais présumer le
sens des cordes**. En accordage ouvert, une orientation fausse donne quand même
des accords justes ici et là. On lit la planche des deux façons et on garde celle
qui valide le plus de cartes.

## Qui vient d'où — [INVENTAIRE.md](INVENTAIRE.md)

Trois provenances coexistent dans `chord-data.ts`, et rien dans le fichier ne les
distingue à l'œil. L'inventaire les sépare, nom par nom.

| Provenance | Combien | Ce que ça vaut |
|---|---:|---|
| **Relevé** sur un document | 533 | Lu sur une planche imprimée, puis vérifié contre le nom de l'accord : aucune note étrangère. C'est la référence. |
| **Hérité** | 191 | Déjà là avant ces relevés, sur aucun document. Sans référence extérieure : c'est là que restent les erreurs à trouver. |
| **Calculé** | à la demande | Produit par `generateStringVoicing` pour tout nom qu'aucun doigté ne couvre. Sans référence non plus, mais construit pour ne contenir que les notes de l'accord. |

Les 191 hérités sont l'endroit où chercher : les triades diminuées des quatre
instruments à cordes, les augmentés de la mandoline, les douze accords de basse et
les cent dix-neuf du piano, qu'aucun document n'a encore couverts. Les erreurs
trouvées jusqu'ici venaient toutes de là — les douze sus2/sus4 de guitare qui ne
sonnaient pas leur nom, les vingt-trois du banjo, les vingt-deux du ukulélé, le ré
bémol augmenté de mandoline sans sa fondamentale.

```bash
python3 inventaire.py > INVENTAIRE.md   # à refaire après toute reprise de document
```

## Le principe

**Rien n'est présumé, tout est mesuré.** La position de départ ne vient pas d'une
déduction théorique mais du chiffre imprimé à droite du manche, qui nomme la
**première case affichée** (un « 2 » sur un sol mineur ouvre la fenêtre en
deuxième case, et le barré dessiné en deuxième rangée tombe donc en troisième).
Chaque doigté est ensuite confronté au nom de l'accord.

**Le contrôle est tolérant, mais pas complaisant.** Un 9, un 11 ou un 13 se joue à
cinq doigts sur six cordes : le guitariste omet la quinte ou la tierce. On n'exige
donc pas l'accord complet, mais on exige qu'aucune note étrangère ne sonne et que
la fondamentale soit là. Sur le document guitare, cinq cartes ont échoué — elles
sont fautives à la source, et ont été écartées.

**Quand le doute persiste, on regarde.** `png.ecrire` et `png.zoom` sortent
n'importe quelle zone d'une page en image. C'est ce qui a tranché sur les cinq
cartes douteuses, et c'est plus rapide que d'ajuster des seuils à l'aveugle.

## Pour un autre instrument

Dans l'ordre, et en vérifiant à chaque étape :

1. **`pdf.py`** donne la liste `PAGES` → la recopier dans `cartes.py`.
2. **`dico.py`, en haut** : `NB_CORDES`, puis la géométrie `X0`, `PAS_COL`, `LARG`,
   `PAS_FRETTE`, `NB_COL`. Les mesurer sur une page exportée en PNG plutôt que les
   deviner. `CORDES` porte l'accordage en MIDI, corde 1 = la plus aiguë.
3. **`RACINES` et `TYPES`** dans `dico.py` : les fondamentales par page, dans
   l'ordre où elles apparaissent, et les types dans l'ordre des colonnes.
4. **`sillets()`** doit trouver exactement une ligne par rangée de cartes. C'est le
   contrôle qui dit si la géométrie est bonne : `len(sillets(im))` par page.
5. **`final.py`, `ORDRES`** : un ordre de colonnes par page. Le document guitare
   n'était pas régulier — sa page du milieu permutait sus2, sus4 et Maj7, n'avait
   pas de m9, et répétait quatre fois la même carte. Ne pas supposer que le
   prochain le sera. Pour le vérifier sans lire les titres : lancer la lecture avec
   l'ordre supposé et comparer ce que chaque colonne *sonne* à ce qu'elle devrait.
6. **`convertir.py`** : `RACINE` (le document écrit en dièses, l'application en
   bémols sauf fa dièse), `SUFFIXE` et `CATEGORIE`.

Quatre pièges rencontrés, qui se reproduiront :

- **le barré ressemble au sillet** : même largeur, même bord. Ce qui les sépare est
  ce qu'ils ont au-dessus, et c'est ce que teste `coiffe()` ;
- **le titre déborde sur les marqueurs** : le chiffre bleu descendait dans la
  fenêtre qui compte l'encre au-dessus du sillet, et faisait passer un losange
  (corde à vide) pour un X (corde étouffée). D'où le comptage de la seule encre
  neutre ;
- **le pas des colonnes n'est pas constant** : soixante-quatre pixels ici,
  soixante-cinq là. Deux pixels suffisent à manquer une pastille, puisqu'on sonde
  la corde à sa position supposée. Mesurer les manches vaut mieux que les calculer ;
- **les symboles n'ont pas tous la même encre** : sur la planche mandoline, les
  pastilles sont noires et les cercles de cordes à vide d'un gris bien plus clair.
  Au seuil des pastilles, des cartes entières passaient pour muettes. Et le symbole
  n'est pas exactement centré sur sa corde : on le repère, puis on teste **son**
  centre — creux pour un cercle, plein pour une croix.

## Ce qui n'est pas versionné

Les `.raw` et les `.png` : sept méga-octets d'images régénérables en une seconde
avec `pdf.py`. Le PDF source non plus — il vit sur le bureau de son propriétaire.
