"""
Extraction définitive du dictionnaire, chiffre imprimé faisant foi.

Le numéro bleu à droite du manche nomme la **première case affichée**, pas la case
qu'il touche du regard : sur le Gm, le « 2 » annonce une fenêtre ouverte en
deuxième case, et le barré, dessiné dans la deuxième rangée, tombe donc en
troisième. Déduire ce décalage de la théorie ne suffisait pas : les accords à cinq
et six sons omettent des notes, plusieurs décalages sonnent alors juste, et les
accords symétriques (augmentés, diminués septième) en admettent trois ou quatre.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dico import *
from collections import defaultdict

VALEURS = [3, 2, 5, 4, 6, 7, 8, 9]   # glyphes, du plus fréquent au plus rare


def glyphes():
    """Table des chiffres imprimés, apprise sur la planche entière."""
    formes = defaultdict(int)
    for im, racine, typ, xc, ynut in toutes_cartes():
        px = chiffre_bleu(im, xc, ynut)
        if not px: continue
        formes[empreinte(px)] += 1
    ordre = sorted(formes.items(), key=lambda kv: -kv[1])
    return {bits: v for (bits, _), v in zip(ordre, VALEURS)}


def empreinte(px):
    xs = [p[0] for p in px]; ys = [p[1] for p in px]
    s = set(px)
    return tuple(''.join('1' if (x, y) in s else '0' for x in range(min(xs), max(xs) + 1))
                 for y in range(min(ys), max(ys) + 1))


def extraire():
    table = glyphes()
    out = []
    for im, racine, typ, xc, ynut in toutes_cartes():
        doigts, vides, muettes, barre = lire_carte(im, xc, ynut)
        px = chiffre_bleu(im, xc, ynut)
        depart = table.get(empreinte(px), None) if px else 1
        attendu = {(NOMS.index(racine) + i) % 12 for i in FORMULES[typ]}
        jouees = hauteurs(doigts, vides, depart) if depart else set()
        out.append(dict(
            nom=racine + typ, racine=racine, type=typ, depart=depart,
            doigts={str(k): v for k, v in sorted(doigts.items())},
            vides=vides, muettes=muettes, barre=barre,
            exact=jouees == attendu,
            etrangere=sorted(jouees - attendu),
            fondamentale=NOMS.index(racine) in jouees,
        ))
    return out


if __name__ == '__main__':
    r = extraire()
    json.dump(r, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dico-final.json'), 'w'))
    print('cartes           :', len(r))
    print('sans chiffre lu  :', sum(1 for e in r if e['depart'] is None))
    print('accord exact     :', sum(1 for e in r if e['exact']))
    print('note etrangere   :', sum(1 for e in r if e['etrangere']))
    print('sans fondamentale:', sum(1 for e in r if not e['fondamentale']))
    print()
    for e in r:
        if e['etrangere']:
            print('  etrangere:', e['nom'], 'depart', e['depart'], e['doigts'], 'vides', e['vides'])
