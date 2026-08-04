"""
Lecture du dictionnaire d'accords guitare, carte par carte.

La mise en page est parfaitement régulière : dix colonnes au pas de 80 px, deux
rangées par fondamentale, quatre fondamentales par page. Seule la position du
sillet varie d'une rangée à l'autre ; on la mesure, le reste se déduit.

Le sillet se distingue d'un barré, qui a la même largeur, par sa place : c'est le
premier trait de la carte, et il commence exactement au bord du manche, là où un
barré est légèrement rentré.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cartes import Image, PAGES

X0, PAS_COL, LARG = 22, 80, 43
# Un autre instrument n'a pas six cordes : tout ce qui suit s'y adapte, seule la
# géométrie ci-dessus est à remesurer sur le nouveau document.
NB_CORDES = 6
PAS_CORDE = LARG / (NB_CORDES - 1)
PAS_FRETTE = 11.4
NB_COL = 10

RACINES = [['A', 'A#', 'B', 'C'], ['C#', 'D', 'D#', 'E'], ['F', 'F#', 'G', 'G#']]
TYPES = ['', 'm', '5', 'aug', 'dim', 'sus2', 'sus4', '6', 'm6', '7',
         'm7', 'Maj7', '7sus4', 'm7/b5', '9', 'add9', 'm9', '11', '13']
CORDES = {1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40}      # MIDI à vide
NOMS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
FORMULES = {
    '': [0,4,7], 'm': [0,3,7], '5': [0,7], 'aug': [0,4,8], 'dim': [0,3,6,9],   # le dictionnaire note « dim » un diminué septième
    'sus2': [0,2,7], 'sus4': [0,5,7], '6': [0,4,7,9], 'm6': [0,3,7,9],
    '7': [0,4,7,10], 'm7': [0,3,7,10], 'Maj7': [0,4,7,11], '7sus4': [0,5,7,10],
    'm7/b5': [0,3,6,10], '9': [0,4,7,10,2], 'add9': [0,4,7,2], 'm9': [0,3,7,10,2],
    '11': [0,4,7,10,2,5], '13': [0,4,7,10,2,9],
}


def sillets(im):
    """Ordonnées des sillets, une par rangée de cartes."""
    lignes = {}
    for y in range(im.h):
        n = 0
        for i in range(NB_COL):
            x = X0 + PAS_COL * i
            # Le filet qui souligne le titre d'une fondamentale traverse toute la
            # page : le manche, lui, s'arrête net. On exige donc du clair de part
            # et d'autre.
            if (all(im.gris(px, y) < 200 for px in range(x, x + LARG + 1))
                    and im.gris(x - 5, y) > 200 and im.gris(x + LARG + 5, y) > 200):
                n += 1
        if n >= 5: lignes[y] = n
    # Le sillet fait deux à trois pixels : on garde le premier de chaque groupe,
    # et on écarte les frettes, qui suivent onze pixels plus bas.
    ys = sorted(lignes)
    rangees, precedent = [], -99
    for y in ys:
        if y - precedent > 8: rangees.append(y)
        precedent = y
    # Reste à distinguer le sillet du barré, qui a la même largeur et commence au
    # même bord. Ce qui les sépare est ce qu'ils ont au-dessus : rien pour le
    # sillet, une frette ou le sillet lui-même pour le barré.
    def coiffe(y):
        for dy in range(9, 20):
            if sum(1 for i in range(NB_COL)
                   if all(im.gris(px, y - dy) < 200
                          for px in range(X0 + PAS_COL * i, X0 + PAS_COL * i + LARG + 1))) >= 5:
                return True
        return False
    return [y for y in rangees if not coiffe(y)]


def sombre(im, x, y, r=2, seuil=150):
    t = n = 0
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            t += im.gris(int(x + dx), int(y + dy)); n += 1
    return t / n < seuil


def lire_carte(im, xc, ynut):
    """Doigts, cordes à vide, cordes muettes et barré d'une carte."""
    xs = [xc + PAS_CORDE * i for i in range(NB_CORDES)]  # à gauche, la plus grave
    centres = [ynut + PAS_FRETTE * (k + 0.5) for k in range(5)]

    presse = {}
    for i, x in enumerate(xs):
        corde = NB_CORDES - i
        cases = [c for c, y in enumerate(centres, 1) if sombre(im, x, y)]
        if cases: presse[corde] = cases

    # Barré : le trait court **entre** deux cordes, pas seulement dessus.
    barre = None
    for c, y in enumerate(centres, 1):
        prises = sorted(k for k, v in presse.items() if c in v)
        if len(prises) < 2: continue
        a, b = min(prises), max(prises)
        xa, xb = xs[NB_CORDES - b], xs[NB_CORDES - a]
        entre = range(int(xa) + 3, int(xb) - 2)
        if entre and all(im.gris(x, int(y)) < 150 for x in entre):
            barre = {'case': c, 'de': a, 'a': b}
            break

    # Sur un barré, le doigt qui sonne est celui posé **au-dessus** : on retient la
    # case la plus haute de chaque corde.
    doigts = {k: max(v) for k, v in presse.items()}

    # Au-dessus du sillet : X (étouffée) ou losange (à vide). Le X est le plus
    # encré des deux, mais le titre de l'accord descend parfois dans la fenêtre de
    # mesure et faisait passer un losange pour un X. Le titre est bleu, les
    # marqueurs sont gris : on ne compte que l'encre neutre.
    def neutre(x, y):
        r, g, b = im.rgb(int(x), int(y))
        return max(r, g, b) - min(r, g, b) < 30 and (r + g + b) // 3 < 190

    vides, muettes = [], []
    for i, x in enumerate(xs):
        corde = NB_CORDES - i
        if corde in doigts: continue
        encre = sum(1 for dy in range(-11, -3) for dx in range(-4, 5)
                    if neutre(x + dx, ynut + dy))
        (muettes if encre >= 10 else vides if encre >= 4 else muettes).append(corde)
    return doigts, sorted(vides), sorted(muettes), barre


def chiffre_bleu(im, xc, ynut):
    """Pixels bleus à droite du manche : le numéro de case imprimé, s'il existe."""
    px = []
    for y in range(ynut - 4, ynut + int(PAS_FRETTE * 5) + 4):
        for x in range(xc + LARG + 1, xc + LARG + 16):
            r, g, b = im.rgb(x, y)
            if b > 120 and b - r > 45 and b - g > 25: px.append((x, y))
    return px


def hauteurs(doigts, vides, depart):
    out = set()
    for corde, case in doigts.items():
        out.add((CORDES[corde] + case + depart - 1) % 12)
    for corde in vides:
        out.add(CORDES[corde] % 12)
    return out


def toutes_cartes():
    for page, (nom, w, h) in enumerate(PAGES):
        im = Image(nom, w, h)
        ys = sillets(im)
        for r, ynut in enumerate(ys):
            racine = RACINES[page][r // 2]
            base = (r % 2) * NB_COL
            for col in range(NB_COL):
                idx = base + col
                if idx >= len(TYPES): continue
                xc = X0 + PAS_COL * col
                yield im, racine, TYPES[idx], xc, ynut
