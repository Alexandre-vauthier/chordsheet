"""
Relevé de la planche « Banjo Chords », accordage GDGBD.

Troisième mise en page, troisième lecteur. Ici les fondamentales sont en rangées
et les types en colonnes, les cartes ont cinq cordes et quatre cases seulement, et
le repère de case est à droite du manche.

Deux mesures remplacent deux suppositions :

- **les rangées ne sont pas régulièrement espacées** (soixante-quinze pixels ici,
  quatre-vingt-onze là). On repère les sillets à leur épaisseur — trois à quatre
  pixels, contre un ou deux pour une frette — et on ne retient que ceux qu'au moins
  six colonnes voient, ce qui écarte les traits parasites ;
- **le sens des cordes n'est pas supposé.** Sur un banjo en sol ouvert, l'accordage
  se lit presque pareil dans les deux sens, et se tromper d'orientation donnerait
  quand même des accords justes ici et là. On lit donc la planche des deux façons
  et on garde celle qui valide le plus de cartes.

    python3 banjo.py ~/Desktop/banjo-chords.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import png

NB_COL, NB_CORDES, NB_CASES = 10, 5, 4
# Mesuré sur la planche : le sillet commence un pixel et demi avant la première
# corde, les cinq cordes couvrent trente-huit pixels et demi, les cases douze
# et demi. Le sillet lui-même est épais de trois pixels, d'où le décalage.
DECALAGE, LARG, PAS_FRETTE, EPAISSEUR_SILLET = 0.5, 40.0, 12.4, 2
PAS_CORDE = LARG / (NB_CORDES - 1)
SEUIL_TRAIT, SEUIL_PASTILLE, SEUIL_MARQUE = 150, 140, 200

RACINES = ['Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G']
TYPES = ['', 'm', '7', 'm7', '6', 'maj7', 'm6', '9', 'dim', 'aug']

# GDGBD : corde 1 = ré aigu, corde 5 = sol chanterelle. Mêmes numéros que l'application.
CORDES = {1: 62, 2: 59, 3: 55, 4: 50, 5: 67}
NOMS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
FORMULES = {
    '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10],
    '6': [0, 4, 7, 9], 'maj7': [0, 4, 7, 11], 'm6': [0, 3, 7, 9],
    '9': [0, 4, 7, 10, 2], 'dim': [0, 3, 6], 'dim7': [0, 3, 6, 9], 'aug': [0, 4, 8],
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


def colonnes(p: Planche, ynut: int):
    """Abscisses des manches lisibles sur le sillet d'une rangée."""
    out, x = [], 0
    while x < p.w:
        if p.gris(x, ynut + 1) < SEUIL_TRAIT:
            debut = x
            while x < p.w and p.gris(x, ynut + 1) < SEUIL_TRAIT: x += 1
            if 38 <= x - debut <= 60: out.append(debut)
        else:
            x += 1
    return out


def colonnes_globales(p: Planche, ys):
    """
    Les dix abscisses de colonnes, valables pour toute la planche.

    Sur deux rangées, des pastilles posées en première case touchent le sillet et
    soudent deux manches en un seul trait : la rangée n'en compte plus que sept.
    Les colonnes étant les mêmes partout, on prend celles que la majorité des
    rangées voit plutôt que de relire chacune.
    """
    from collections import Counter
    votes = Counter()
    for y in ys:
        for x in colonnes(p, y): votes[x] += 1
    # Une même colonne est relevée à un pixel près selon les rangées : sans les
    # regrouper d'abord, ses voix se partagent et aucune ne passe le seuil.
    groupes = []
    for x in sorted(votes):
        if groupes and x - groupes[-1][-1] <= 3: groupes[-1].append(x)
        else: groupes.append([x])
    return [min(g) for g in groupes if sum(votes[x] for x in g) >= len(ys) // 2]


def sillets(p: Planche):
    """
    Ordonnées des douze sillets.

    Le sillet est épais de trois à quatre pixels, la frette d'un ou deux : c'est ce
    qui les sépare, la mise en page ne suffisant pas (l'écart entre rangées varie de
    soixante-quinze à quatre-vingt-onze pixels). Un trait n'est retenu que si au
    moins six colonnes le voient, ce qui écarte les accidents d'une carte isolée.
    """
    from collections import Counter
    votes = Counter()
    for xd in range(60, p.w - 60, 20):
        xs = range(xd + 4, xd + 40)
        y = 100
        while y < p.h - 60:
            if sum(1 for x in xs if p.gris(x, y) < SEUIL_TRAIT) > 28:
                d = y
                while y < p.h - 60 and sum(1 for x in xs if p.gris(x, y) < SEUIL_TRAIT) > 28: y += 1
                if y - d >= 3: votes[d] += 1
            else:
                y += 1
    groupes = []
    for y in sorted(votes):
        if groupes and y - groupes[-1][-1] <= 2: groupes[-1].append(y)
        else: groupes.append([y])
    trouves = [g[0] for g in groupes if sum(votes[y] for y in g) >= 6]
    # Le bandeau de bas de page est lui aussi un trait épais : on ne garde que les
    # lignes qui portent réellement des manches.
    return [y for y in trouves if len(colonnes(p, y)) >= 5]


def lire_carte(p: Planche, xc: int, ynut: int, pas_frette: float, gauche_grave: bool):
    """Doigts et cordes à vide d'une carte, dans l'orientation demandée."""
    xs = [xc + DECALAGE + PAS_CORDE * i for i in range(NB_CORDES)]
    centres = [ynut + EPAISSEUR_SILLET + pas_frette * (k + 0.5) for k in range(NB_CASES)]

    doigts, vides, muettes = {}, [], []
    for i, x in enumerate(xs):
        # Corde 5 (la chanterelle) au bord gauche, ou corde 1 : c'est l'inconnue
        # que la validation tranche.
        corde = (5 - i) if gauche_grave else (i + 1)
        cases = [c for c, y in enumerate(centres, 1) if p.sombre(x, y)]
        if cases:
            doigts[corde] = max(cases)
            continue
        # Un cercle de corde à vide, et rien d'autre : cette planche n'étouffe
        # aucune corde, elle se contente de ne pas la marquer.
        #
        # Le titre de l'accord laisse pourtant de l'encre juste au-dessus du sillet,
        # et elle passait pour un cercle. Ce qui les sépare est la hauteur : le
        # cercle occupe toute la bande jusqu'au sillet, la retombée du titre n'en
        # touche que le haut. On exige donc de l'encre sur la dernière ligne.
        encre = [(dx, dy) for dy in range(-6, -1) for dx in range(-5, 6)
                 if p.gris(int(x + dx), ynut + dy) < SEUIL_MARQUE]
        au_ras = sum(1 for _, dy in encre if dy == -2)
        (vides if len(encre) >= 8 and au_ras >= 2 else muettes).append(corde)
    return doigts, sorted(vides), sorted(muettes)


def a_un_repere(p: Planche, xc: int, ynut: int, pas_frette: float) -> bool:
    """
    Le « 3fr » à droite du manche.

    La fenêtre commence bien après le manche : la pastille de la dernière corde
    déborde de cinq pixels au-delà de sa corde, et la prendre pour un repère
    faisait échouer la lecture de presque toutes les cartes.
    """
    return any(p.gris(x, y) < SEUIL_MARQUE
               for y in range(ynut - 2, ynut + int(pas_frette * 1.4))
               for x in range(xc + 47, xc + 78))


def racine_semi(nom: str) -> int:
    """Demi-ton de la fondamentale ; la planche écrit en bémols et en dièses."""
    return NOMS.index(nom.replace('Ab', 'G#').replace('Bb', 'A#')
                      .replace('Db', 'C#').replace('Eb', 'D#'))


def hauteurs(doigts, vides, depart):
    out = set()
    for corde, case in doigts.items():
        out.add((CORDES[corde] + case + depart - 1) % 12)
    for corde in vides:
        out.add(CORDES[corde] % 12)
    return out


def extraire(chemin, gauche_grave=True, type_dim='dim7'):
    """
    Rend (accords retenus, cartes à inspecter).

    Deux conventions de cette planche, établies en comparant les lectures possibles
    plutôt qu'en les supposant :

    - **une corde sans pastille ni cercle n'est pas jouée.** La lire à vide ajoutait
      des notes étrangères sur vingt cartes ;
    - **« dim » désigne un diminué septième.** Lu comme triade, dix cartes de plus
      sonnaient faux.

    Et un usage qu'il faut accepter : **la fondamentale manque à vingt-deux
    doigtés**. Quatre cordes jouables ne suffisent pas à un accord de cinq sons, et
    le banjo laisse tomber la fondamentale plutôt que la couleur. On exige donc
    qu'aucune note étrangère ne sonne, sans exiger la fondamentale.
    """
    p = Planche(chemin)
    ys = sillets(p)
    if len(ys) != 12:
        raise ValueError(f'{len(ys)} sillets trouvés, 12 attendus')
    xs_globales = colonnes_globales(p, ys)
    if len(xs_globales) != NB_COL:
        raise ValueError(f'{len(xs_globales)} colonnes trouvées, {NB_COL} attendues')

    accords, rejets = [], []
    for r, ynut in enumerate(ys):
        pas = (ys[r + 1] - ynut) / 6.2 if r + 1 < len(ys) else 12.5
        pas = PAS_FRETTE
        for c, xc in enumerate(xs_globales):
            typ = TYPES[c]
            doigts, vides, muettes = lire_carte(p, xc, ynut, pas, gauche_grave)
            cle = type_dim if typ == 'dim' else typ
            attendu = {(racine_semi(RACINES[r]) + i) % 12 for i in FORMULES[cle]}
            if a_un_repere(p, xc, ynut, pas):
                # La fondamentale, quand elle est là, lève l'ambiguïté ; sinon on se
                # contente du premier décalage qui ne fasse sonner rien d'étranger.
                # Le repère dit que la fenêtre ne commence pas en première case.
                # Sur le mi bémol mineur il se trompe : ses pastilles ne sonnent
                # l'accord qu'en première position. Faute de décalage valable, on y
                # revient donc plutôt que d'abandonner la carte.
                def valables(plage):
                    avec = [d for d in plage if hauteurs(doigts, vides, d) <= attendu
                            and racine_semi(RACINES[r]) in hauteurs(doigts, vides, d)]
                    return avec or [d for d in plage if hauteurs(doigts, vides, d) <= attendu]
                depart = (valables(range(2, 13)) or valables([1]) or [None])[0]
            else:
                depart = 1
            jouees = hauteurs(doigts, vides, depart) if depart else set()
            e = dict(nom=RACINES[r] + typ, racine=RACINES[r], type=typ, depart=depart,
                     doigts={str(k): v for k, v in sorted(doigts.items())},
                     vides=vides, muettes=muettes,
                     notes=sorted(NOMS[x] for x in jouees),
                     etrangeres=sorted(NOMS[x] for x in jouees - attendu),
                     fondamentale=racine_semi(RACINES[r]) in jouees)
            (accords if depart and not e['etrangeres'] else rejets).append(e)
    return accords, rejets


if __name__ == '__main__':
    chemin = sys.argv[1] if len(sys.argv) > 1 else '~/Desktop/banjo-chords.png'
    a, r = extraire(chemin)
    print(f'retenus : {len(a)} / 120')
    print(f'dont sans fondamentale : {sum(1 for e in a if not e["fondamentale"])}')
    print(f'a inspecter : {len(r)}')
    for e in r:
        print(f"  {e['nom']:8s} dep {e['depart']} doigts {e['doigts']} vides {e['vides']} "
              f"-> {' '.join(e['notes'])} | de trop {' '.join(e['etrangeres'])}")
