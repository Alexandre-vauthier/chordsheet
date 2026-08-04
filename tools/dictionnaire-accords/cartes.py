"""
Repérage des cartes du dictionnaire, par le sillet.

Le sillet est le seul trait horizontal continu large de tout le manche : plus long
qu'une frette (qui l'est autant, mais plus clair) et sans équivalent dans le reste
de la page. On le cherche donc franc et noir, on regroupe, et chaque carte se
déduit de son sillet.
"""
import os
S = os.path.dirname(os.path.abspath(__file__))
PAGES = [('img5', 812, 1024), ('img10', 812, 1029), ('img15', 812, 1040)]

class Image:
    def __init__(self, nom, w, h):
        self.raw = open(os.path.join(S, nom + '.raw'), 'rb').read()
        self.w, self.h = w, h
    def rgb(self, x, y):
        i = (y * self.w + x) * 3
        return self.raw[i], self.raw[i+1], self.raw[i+2]
    def gris(self, x, y):
        if x < 0 or y < 0 or x >= self.w or y >= self.h: return 255
        i = (y * self.w + x) * 3
        return (self.raw[i] + self.raw[i+1] + self.raw[i+2]) // 3

def sillets(im, seuil=170, longueur=38):
    """Segments horizontaux sombres d'au moins `longueur` pixels : les sillets."""
    trouves = []
    for y in range(im.h):
        x = 0
        while x < im.w:
            if im.gris(x, y) < seuil:
                d = x
                while x < im.w and im.gris(x, y) < seuil: x += 1
                if x - d >= longueur: trouves.append((y, d, x - 1))
            else: x += 1
    # Un sillet fait deux ou trois pixels de haut : on fusionne les lignes voisines.
    trouves.sort()
    cartes, vus = [], set()
    for i, (y, g, d) in enumerate(trouves):
        if i in vus: continue
        groupe = [(y, g, d)]
        for j in range(i + 1, len(trouves)):
            y2, g2, d2 = trouves[j]
            if y2 - y > 3: break
            if abs(g2 - g) <= 3 and abs(d2 - d) <= 3:
                groupe.append((y2, g2, d2)); vus.add(j)
        cartes.append((groupe[0][0], groupe[0][1], groupe[0][2]))
    return cartes
