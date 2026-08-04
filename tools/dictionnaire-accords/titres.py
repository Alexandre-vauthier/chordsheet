"""
Lecture des titres imprimés sur chaque carte.

L'ordre des colonnes n'est pas le même d'une page à l'autre, et le document
comporte des coquilles (un « Csus4 » là où il fallait lire un dièse). Déduire le
nom de la position serait donc faux ; on lit le titre, glyphe par glyphe.

Le texte est bleu, tout le reste de la carte est gris : la couleur suffit à
l'isoler. Les glyphes de cette fonte matricielle sont identiques d'une carte à
l'autre, on les regroupe donc et on ne les nomme qu'une fois.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dico import LARG


def pixels(im, xc, ynut):
    px = []
    for y in range(ynut - 26, ynut - 11):
        for x in range(xc - 6, xc + LARG + 8):
            r, g, b = im.rgb(x, y)
            if b > 120 and b - r > 45 and b - g > 25: px.append((x, y))
    return px


def glyphes(px):
    """Découpe le titre en glyphes : colonnes bleues contiguës."""
    if not px: return []
    s = set(px)
    xs = sorted({x for x, _ in px}); ymin = min(y for _, y in px); ymax = max(y for _, y in px)
    groupes, courant = [], [xs[0]]
    for x in xs[1:]:
        if x - courant[-1] <= 1: courant.append(x)
        else: groupes.append(courant); courant = [x]
    groupes.append(courant)
    out = []
    for g in groupes:
        motif = tuple(''.join('1' if (x, y) in s else '0' for x in range(g[0], g[-1] + 1))
                      for y in range(ymin, ymax + 1))
        # On rogne les lignes vides du haut et du bas, mais on garde le décalage :
        # il distingue un « m » d'un « n » et un « j » de son point.
        haut = next((i for i, l in enumerate(motif) if '1' in l), 0)
        bas = len(motif) - next((i for i, l in enumerate(reversed(motif)) if '1' in l), 0)
        out.append((haut, motif[haut:bas]))
    return out
