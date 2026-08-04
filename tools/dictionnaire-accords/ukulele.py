"""
Relevé de la planche « Ukulele Chords Chart ».

Quatrième mise en page. Douze fondamentales en rangées, neuf types en colonnes,
quatre cordes, cinq cases. Deux particularités qui n'existaient sur aucune des
planches précédentes :

- **certaines cartes portent deux doigtés superposés.** Le premier est dessiné en
  pastilles pleines, le second en cercles creux, parfois débordant sous la grille.
  On ne lit que les pleines ;
- **aucune corde n'est marquée à vide ni étouffée.** Sur un ukulélé les quatre
  cordes sonnent toujours : ce qui ne porte pas de pastille se joue à vide.

La grille n'a pas de sillet dessiné : sa première ligne horizontale est déjà la
première frette, et les positions se lisent donc directement.

    python3 ukulele.py ~/Desktop/ukulele-chords.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import png

NB_COL, NB_CORDES, NB_CASES = 9, 4, 5
PAS_FRETTE = 9.4          # mesuré : identique sur les douze rangées
SEUIL_TRAIT, SEUIL_PASTILLE = 150, 120

RACINES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
TYPES = ['', '7', 'm', 'm7', 'dim', 'aug', '6', 'maj7', '9']

# Sol aigu réentrant : corde 1 = la, corde 4 = sol, comme dans l'application.
CORDES = {1: 69, 2: 64, 3: 60, 4: 67}
NOMS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
FORMULES = {
    '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10],
    'dim': [0, 3, 6], 'dim7': [0, 3, 6, 9], 'aug': [0, 4, 8], '6': [0, 4, 7, 9],
    'maj7': [0, 4, 7, 11], '9': [0, 4, 7, 10, 2],
}


class Planche:
    def __init__(self, chemin):
        self.w, self.h, self.raw = png.lire(os.path.expanduser(chemin))

    def gris(self, x, y):
        if x < 0 or y < 0 or x >= self.w or y >= self.h: return 255
        i = (y * self.w + x) * 3
        return (self.raw[i] + self.raw[i + 1] + self.raw[i + 2]) // 3


def cordes_verticales(p: Planche):
    """Les traits verticaux du manche : quatre par carte, trente-six par rangée."""
    runs = []
    for x in range(p.w):
        y = 60
        while y < p.h - 20:
            if p.gris(x, y) < SEUIL_TRAIT:
                d = y
                while y < p.h - 20 and p.gris(x, y) < SEUIL_TRAIT: y += 1
                if 35 <= y - d <= 70: runs.append((x, d, y - 1))
            else:
                y += 1
    return runs


def grille(p: Planche):
    """
    Rend, pour chaque rangée, (haut, bas, abscisses des trente-six cordes).

    Les cartes ne sont pas alignées au pixel d'une rangée à l'autre, et une pastille
    posée sur une corde masque son trait : certaines rangées n'en laissent voir que
    trente-trois. On relève donc ce qui est visible, puis on reconstruit la grille
    complète à partir du pas mesuré — celui des cordes dans une carte, celui des
    cartes dans la rangée.
    """
    runs = cordes_verticales(p)
    tops = sorted({d for _, d, _ in runs})
    paquets = []
    for y in tops:
        if paquets and y - paquets[-1][-1] <= 12: paquets[-1].append(y)
        else: paquets.append([y])

    brut = []
    for paquet in paquets:
        haut = min(paquet)
        proches = [(x, d, f) for x, d, f in runs if abs(d - haut) <= 12]
        bas = max(f for _, _, f in proches)
        xs = sorted({x for x, _, _ in proches})
        groupes = []
        for x in xs:
            if groupes and x - groupes[-1][-1] <= 3: groupes[-1].append(x)
            else: groupes.append([x])
        brut.append((haut, bas, [sum(g) / len(g) for g in groupes]))

    # Les cartes ne sont pas régulièrement espacées : deux d'entre elles se touchent
    # presque, et un seuil d'écart ne les sépare pas. Sur une rangée complète, en
    # revanche, les huit plus grands écarts sont forcément les huit changements de
    # carte. On établit la disposition là, puis on la recale sur les autres rangées.
    def decouper(centres):
        ecarts = sorted(range(len(centres) - 1), key=lambda i: centres[i + 1] - centres[i])
        coupures = sorted(ecarts[-(NB_COL - 1):])
        cartes, debut = [], 0
        for i in coupures:
            cartes.append(centres[debut:i + 1]); debut = i + 1
        cartes.append(centres[debut:])
        return cartes

    completes = [c for _, _, c in brut if len(c) == NB_COL * NB_CORDES]
    if not completes:
        raise ValueError('aucune rangée ne montre ses trente-six cordes')
    modeles = [decouper(c) for c in completes]
    reference = [[sum(m[i][s] - m[0][0] for m in modeles) / len(modeles)
                  for s in range(NB_CORDES)] for i in range(NB_COL)]

    # Une pastille masque parfois le trait de sa corde : la rangée n'en montre alors
    # que trente-trois. Sa première carte, elle, est toujours entière — elle sert
    # d'ancre pour poser la disposition de référence.
    out = []
    for haut, _, centres in brut:
        cartes = [[centres[0] + dx for dx in carte] for carte in reference]
        out.append((frettes(haut), cartes))
    return out


def frettes(haut: int):
    """
    Ordonnées des six frettes d'une rangée.

    Le pas est le même sur toute la planche, neuf pixels et demi ; le haut de la
    grille, lui, est mesuré. On les divisait auparavant d'après la hauteur des
    traits verticaux, qui s'arrêtent onze pixels trop tôt sur la dernière rangée :
    ses cases s'en trouvaient comprimées et tous ses accords sonnaient une case
    trop haut.
    """
    return [haut + PAS_FRETTE * k for k in range(NB_CASES + 1)]


def pastille_pleine(p: Planche, x, y, r=2):
    """Une pastille pleine, par opposition au cercle creux du doigté de rechange."""
    if p.gris(int(x), int(y)) >= SEUIL_PASTILLE:
        return False
    sombres = sum(1 for dy in range(-r, r + 1) for dx in range(-r, r + 1)
                  if p.gris(int(x + dx), int(y + dy)) < SEUIL_PASTILLE)
    return sombres >= (2 * r + 1) ** 2 * 0.6


def lire_carte(p: Planche, xs, lignes):
    """Doigts et cordes à vide d'une carte, une case entre deux frettes."""
    centres = [(lignes[k] + lignes[k + 1]) / 2 for k in range(NB_CASES)]
    doigts, vides = {}, []
    for i, x in enumerate(xs):
        corde = NB_CORDES - i           # à gauche, le sol
        cases = [c for c, y in enumerate(centres, 1) if pastille_pleine(p, x, y)]
        if cases: doigts[corde] = max(cases)
        else: vides.append(corde)
    return doigts, sorted(vides)


def hauteurs(doigts, vides):
    out = set()
    for corde, case in doigts.items(): out.add((CORDES[corde] + case) % 12)
    for corde in vides: out.add(CORDES[corde] % 12)
    return out


def extraire(chemin, type_dim='dim'):
    p = Planche(chemin)
    rangees = grille(p)
    if len(rangees) != 12:
        raise ValueError(f'{len(rangees)} rangées trouvées, 12 attendues')

    accords, rejets = [], []
    for r, (lignes, cartes) in enumerate(rangees):
        for c, xs in enumerate(cartes):
            typ = TYPES[c]
            doigts, vides = lire_carte(p, xs, lignes)
            cle = type_dim if typ == 'dim' else typ
            racine = RACINES[r]
            semi = NOMS.index(racine.replace('Db', 'C#').replace('Eb', 'D#')
                              .replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#'))
            attendu = {(semi + i) % 12 for i in FORMULES[cle]}
            jouees = hauteurs(doigts, vides)
            e = dict(nom=racine + typ, racine=racine, type=typ,
                     doigts={str(k): v for k, v in sorted(doigts.items())}, vides=vides,
                     notes=sorted(NOMS[x] for x in jouees),
                     etrangeres=sorted(NOMS[x] for x in jouees - attendu),
                     fondamentale=semi in jouees)
            (accords if not e['etrangeres'] and e['fondamentale'] else rejets).append(e)
    return accords, rejets


if __name__ == '__main__':
    chemin = sys.argv[1] if len(sys.argv) > 1 else '~/Desktop/ukulele-chords.png'
    for dim in ('dim', 'dim7'):
        a, r = extraire(chemin, dim)
        print(f'dim={dim:5s} : {len(a):3d} retenus, {len(r):3d} a inspecter')
    a, r = extraire(chemin)
    for e in r[:15]:
        print(f"  {e['nom']:8s} doigts {e['doigts']} vides {e['vides']} "
              f"-> {' '.join(e['notes'])} | de trop {' '.join(e['etrangeres'])}")
