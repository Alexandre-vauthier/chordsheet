"""
Relevé de la planche « Mandolin Chords ».

Rien à voir avec le dictionnaire guitare, et c'est pourquoi ce lecteur est séparé
plutôt que paramétré : une seule page, quatre-vingt-seize accords, les
fondamentales en colonnes et les types en rangées (l'inverse du document guitare),
des étiquettes en noir au-dessus de chaque carte, et le numéro de case en tout
petit à gauche du manche au lieu d'un chiffre coloré à droite.

Ce qui se réutilise, c'est la méthode : mesurer la géométrie sur l'image plutôt
que la deviner, et ne retenir un doigté que s'il fait sonner les notes de son nom.

    python3 mandoline.py ~/Desktop/mandoline-chords.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import png

# Géométrie, mesurée sur l'image : douze colonnes au pas de 64,45 px, huit rangées
# de sillets, quatre cordes réparties sur 40,5 px, frettes tous les 11,2 px.
X0, PAS_COL, LARG = 22, 64.45, 40.5
NB_COL, NB_CORDES = 12, 4
PAS_CORDE = LARG / (NB_CORDES - 1)
PAS_FRETTE = 11.2
# Les pastilles sont noires, les marqueurs de cordes à vide d'un gris bien plus clair.
SEUIL_PASTILLE, SEUIL_MARQUE = 140, 215
SILLETS = [185, 286, 387, 487, 588, 689, 790, 890]

RACINES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
TYPES = ['', 'm', '7', 'maj7', 'm7', 'sus4', 'sus2', 'dim']

# Corde 1 = mi aigu, corde 4 = sol grave, comme dans l'application.
CORDES = {1: 76, 2: 69, 3: 62, 4: 55}
NOMS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
FORMULES = {
    '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11],
    'm7': [0, 3, 7, 10], 'sus4': [0, 5, 7], 'sus2': [0, 2, 7],
    'dim': [0, 3, 6], 'dim7': [0, 3, 6, 9],
}


class Planche:
    def __init__(self, chemin):
        self.w, self.h, self.raw = png.lire(os.path.expanduser(chemin))

    def gris(self, x, y):
        if x < 0 or y < 0 or x >= self.w or y >= self.h: return 255
        i = (y * self.w + x) * 3
        return (self.raw[i] + self.raw[i + 1] + self.raw[i + 2]) // 3

    def sombre(self, x, y, r=2, seuil=SEUIL_PASTILLE):
        t = n = 0
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                t += self.gris(int(x + dx), int(y + dy)); n += 1
        return t / n < seuil


def lire_carte(p: Planche, xc: int, ynut: int):
    """Doigts, cordes à vide et cordes étouffées d'une carte."""
    xs = [xc + PAS_CORDE * i for i in range(NB_CORDES)]      # à gauche, la plus grave
    centres = [ynut + PAS_FRETTE * (k + 0.5) for k in range(5)]

    doigts, vides, muettes = {}, [], []
    for i, x in enumerate(xs):
        corde = NB_CORDES - i
        cases = [c for c, y in enumerate(centres, 1) if p.sombre(x, y)]
        if cases:
            doigts[corde] = max(cases)
            continue
        # Au-dessus du sillet : un cercle (corde à vide) ou une croix (étouffée).
        # Les deux sont tracés en gris clair, bien plus clair que les pastilles :
        # au seuil des pastilles ils étaient invisibles, et des cartes entières
        # passaient pour muettes.
        #
        # Ce qui les sépare est leur centre — la croix en a un, le cercle est creux.
        # Mais le symbole n'est pas exactement centré sur sa corde, à un ou deux
        # pixels près, et sonder le centre supposé prenait le bord d'un cercle pour
        # le cœur d'une croix. On repère donc le symbole, puis on teste *son* centre.
        encre = [(dx, dy) for dy in range(-10, -1) for dx in range(-5, 6)
                 if p.gris(int(x + dx), ynut + dy) < SEUIL_MARQUE]
        if len(encre) < 6:
            muettes.append(corde)
            continue
        cx = (min(d for d, _ in encre) + max(d for d, _ in encre)) / 2
        cy = (min(d for _, d in encre) + max(d for _, d in encre)) / 2
        creux = not any(abs(dx - cx) <= 0.6 and abs(dy - cy) <= 0.6 for dx, dy in encre)
        (vides if creux else muettes).append(corde)
    return doigts, sorted(vides), sorted(muettes)


def a_un_repere(p: Planche, xc: int, ynut: int) -> bool:
    """
    Le petit « 4fr » à gauche du manche, qui annonce une fenêtre décalée.

    Trop menu pour être lu (six pixels sur trois) ; on se contente de savoir qu'il
    est là, et l'harmonie donne la case. Les pastilles de la première corde
    débordent sur la marge, mais jamais au-delà de quatre pixels : le repère, lui,
    va plus loin. C'est ce qui les distingue.
    """
    return any(p.gris(x, y) < 170
               for y in range(ynut + 1, ynut + 13)
               for x in range(xc - 14, xc - 5))


def hauteurs(doigts, vides, depart):
    out = set()
    for corde, case in doigts.items():
        out.add((CORDES[corde] + case + depart - 1) % 12)
    for corde in vides:
        out.add(CORDES[corde] % 12)
    return out


def manches(p: Planche, ynut: int):
    """
    Abscisses des douze manches d'une rangée, relevées sur le sillet lui-même.

    Le pas n'est pas tout à fait constant — soixante-quatre pixels ici, soixante-cinq
    là — et deux pixels suffisent à faire manquer une pastille : la corde est fine,
    et on la sonde à sa position supposée. Calculer les colonnes donnait des cartes
    entières vides. On les mesure donc, rangée par rangée.
    """
    trouves = set()
    # Les sillets d'une même rangée ne sont pas alignés au pixel près : on balaie
    # trois lignes et on retient chaque manche une fois.
    for y in (ynut - 1, ynut, ynut + 1):
        x = 0
        while x < p.w:
            if p.gris(x, y) < 150:
                debut = x
                while x < p.w and p.gris(x, y) < 150: x += 1
                if 33 <= x - debut <= 52 and not any(abs(debut - v) <= 3 for v in trouves):
                    trouves.add(debut)
            else:
                x += 1
    return sorted(trouves)


def toutes_cartes(p: Planche):
    for r, ynut in enumerate(SILLETS):
        xs = manches(p, ynut)
        if len(xs) != NB_COL:
            raise ValueError(f'rangée {ynut} : {len(xs)} manches trouvés, {NB_COL} attendus')
        for c, xc in enumerate(xs):
            yield RACINES[c], TYPES[r], xc, ynut


def extraire(chemin, type_dim='dim'):
    """
    Rend (accords retenus, cartes à inspecter).

    La case de départ vaut 1 sauf repère ; dans ce cas on cherche le décalage qui
    fait sonner l'accord, en s'interdisant 1 puisque le repère dit le contraire.
    """
    p = Planche(chemin)
    accords, rejets = [], []
    for racine, typ, xc, ynut in toutes_cartes(p):
        doigts, vides, muettes = lire_carte(p, xc, ynut)
        cle = type_dim if typ == 'dim' else typ
        attendu = {(NOMS.index(racine) + i) % 12 for i in FORMULES[cle]}

        if a_un_repere(p, xc, ynut):
            candidats = [d for d in range(2, 13) if hauteurs(doigts, vides, d) == attendu]
            depart = candidats[0] if len(candidats) == 1 else None
        else:
            depart = 1

        jouees = hauteurs(doigts, vides, depart) if depart else set()
        e = dict(nom=racine + typ, racine=racine, type=typ, depart=depart,
                 doigts={str(k): v for k, v in sorted(doigts.items())},
                 vides=vides, muettes=muettes,
                 notes=sorted(NOMS[x] for x in jouees),
                 etrangeres=sorted(NOMS[x] for x in jouees - attendu),
                 fondamentale=NOMS.index(racine) in jouees)
        (accords if depart and not e['etrangeres'] and e['fondamentale'] else rejets).append(e)
    return accords, rejets


if __name__ == '__main__':
    chemin = os.path.expanduser(sys.argv[1]) if len(sys.argv) > 1 else '~/Desktop/mandoline-chords.png'
    for dim in ('dim', 'dim7'):
        a, r = extraire(chemin, dim)
        print(f'« dim » lu comme {dim:5s} : {len(a)} retenus, {len(r)} a inspecter')
    a, r = extraire(chemin)
    for e in r:
        print(f"  {e['nom']:9s} depart {e['depart']} doigts {e['doigts']} vides {e['vides']} "
              f"muettes {e['muettes']} -> {' '.join(e['notes'])} | de trop {' '.join(e['etrangeres'])}")
