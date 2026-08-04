"""
Passage de la planche banjo au format de l'application.

La planche écrit ses fondamentales comme l'application (bémols, sauf fa dièse),
à un détail près : elle note « C# » là où l'application dit « Db ».

Comme le dictionnaire guitare, elle appelle « dim » un diminué septième. Ces
cartes deviennent donc des `dim7`, et les triades diminuées de la bibliothèque
restent en place.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from banjo import extraire

SUFFIXE = {'': '', 'm': 'm', '7': '7', 'm7': 'm7', '6': '6', 'maj7': 'maj7',
           'm6': 'm6', '9': '9', 'dim': 'dim7', 'aug': 'aug'}
CATEGORIE = {'': 'major', 'm': 'minor', '7': 'dom7', 'm7': 'min7', '6': '6',
             'maj7': 'maj7', 'm6': 'm6', '9': '9', 'dim7': 'dim7', 'aug': 'aug'}
PLEIN = {'': 'major', 'm': 'minor', '7': '7', 'm7': 'min7', '6': '6',
         'maj7': 'maj7', 'm6': 'm6', '9': '9', 'dim7': 'dim7', 'aug': 'aug'}


def convertir(chemin):
    accords, rejets = extraire(chemin)
    out = []
    for e in accords:
        racine = e['racine']
        suf = SUFFIXE[e['type']]
        nom = racine + suf
        depart = e['depart']
        doigts = sorted((int(k), depart + v - 1) for k, v in e['doigts'].items())
        out.append(dict(
            id='b' + nom.replace('#', 's'),
            name=nom, full=f'{racine} {PLEIN[suf]}',
            category=CATEGORIE[suf],
            fingers=[[c, f, 1] for c, f in doigts],
            open=e['vides'],
            # Ce que la planche ne marque pas ne se joue pas : sur cinq cordes, une
            # seule main n'en tient pas quatre plus la chanterelle.
            muted=e['muettes'], startFret=depart,
        ))
    return out, rejets


if __name__ == '__main__':
    chemin = sys.argv[1] if len(sys.argv) > 1 else '~/Desktop/banjo-chords.png'
    r, rejets = convertir(chemin)
    S = os.path.dirname(os.path.abspath(__file__))
    json.dump(r, open(os.path.join(S, 'banjo-app.json'), 'w'))
    from collections import Counter
    print('accords convertis:', len(r), '| ecartes:', [e['nom'] for e in rejets])
    print(Counter(c['category'] for c in r))
