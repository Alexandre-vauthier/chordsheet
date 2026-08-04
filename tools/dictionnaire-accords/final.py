"""
Lecture définitive : ordre des colonnes propre à chaque page, contrôle par les notes.

Le document n'est pas régulier. Les pages 1 et 3 rangent les dix-neuf types dans
l'ordre annoncé ; la page 2 les permute (sus4 monte en sixième colonne, sus2 et
Maj7 descendent en seconde rangée), n'a pas de m9, et répète quatre fois la même
carte « Csus4 » à la septième colonne, notes comprises — une coquille de la source,
que rien ne rattrape et qu'on écarte.

Le contrôle ne peut pas exiger l'accord complet : un 9, un 11 ou un 13 se joue à
cinq doigts sur six cordes, et le guitariste omet la quinte ou la tierce. On exige
donc qu'aucune note étrangère ne sonne, et que la fondamentale soit là.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dico import *
from extraire_final import glyphes as table_chiffres, empreinte

ORDRE_STANDARD = ['', 'm', '5', 'aug', 'dim', 'sus2', 'sus4', '6', 'm6', '7',
                  'm7', 'Maj7', '7sus4', 'm7/b5', '9', 'add9', 'm9', '11', '13']
ORDRE_PAGE2 = ['', 'm', '5', 'aug', 'dim', 'sus4', None, '6', 'm6', '7',
               'm7', 'sus2', '7sus4', 'm7/b5', '9', 'add9', 'Maj7', '11', '13']
ORDRES = [ORDRE_STANDARD, ORDRE_PAGE2, ORDRE_STANDARD]
PAGE_DE = {'A': 0, 'A#': 0, 'B': 0, 'C': 0, 'C#': 1, 'D': 1, 'D#': 1, 'E': 1,
           'F': 2, 'F#': 2, 'G': 2, 'G#': 2}


def extraire():
    table = table_chiffres()
    accords, rejets = [], []
    for i, (im, racine, _, xc, ynut) in enumerate(toutes_cartes()):
        page = PAGE_DE[racine]
        typ = ORDRES[page][i % 19]
        if typ is None: continue                       # la carte répétée du document
        doigts, vides, muettes, barre = lire_carte(im, xc, ynut)
        px = chiffre_bleu(im, xc, ynut)
        depart = table.get(empreinte(px)) if px else 1
        jouees = hauteurs(doigts, vides, depart) if depart else set()
        r = NOMS.index(racine)
        attendu = {(r + x) % 12 for x in FORMULES[typ]}
        e = dict(nom=racine + typ, racine=racine, type=typ, depart=depart,
                 doigts={str(k): v for k, v in sorted(doigts.items())},
                 vides=vides, muettes=muettes, barre=barre,
                 notes=sorted(NOMS[p] for p in jouees),
                 etrangeres=sorted(NOMS[p] for p in jouees - attendu),
                 fondamentale=r in jouees)
        (accords if not e['etrangeres'] and e['fondamentale'] else rejets).append(e)
    return accords, rejets


if __name__ == '__main__':
    a, r = extraire()
    S = os.path.dirname(os.path.abspath(__file__))
    json.dump(dict(accords=a, rejets=r), open(os.path.join(S, 'dico-ok.json'), 'w'))
    print(f'accords retenus : {len(a)}')
    print(f'a inspecter     : {len(r)}')
    for e in r:
        print(f"  {e['nom']:9s} depart {e['depart']} notes {e['notes']} "
              f"etrangeres {e['etrangeres']} fonda {e['fondamentale']}")
