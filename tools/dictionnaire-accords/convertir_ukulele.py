"""
Passage de la planche ukulélé au format de l'application.

Même vocabulaire de fondamentales, à une exception : la planche écrit « Gb » là où
l'application dit « F# ». Et comme les deux autres documents, elle appelle « dim »
un diminué septième.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ukulele import extraire

RACINE = {'Gb': 'F#'}
SUFFIXE = {'': '', '7': '7', 'm': 'm', 'm7': 'm7', 'dim': 'dim7', 'aug': 'aug',
           '6': '6', 'maj7': 'maj7', '9': '9'}
CATEGORIE = {'': 'major', '7': 'dom7', 'm': 'minor', 'm7': 'min7', 'dim7': 'dim7',
             'aug': 'aug', '6': '6', 'maj7': 'maj7', '9': '9'}
PLEIN = {'': 'major', '7': '7', 'm': 'minor', 'm7': 'min7', 'dim7': 'dim7',
         'aug': 'aug', '6': '6', 'maj7': 'maj7', '9': '9'}


def convertir(chemin):
    accords, rejets = extraire(chemin, 'dim7')
    # Le critère du document : aucune note étrangère. La fondamentale manque à
    # treize doigtés — douze neuvièmes, qui demandent cinq sons pour quatre cordes.
    retenus = [e for e in accords + rejets if not e['etrangeres']]
    ecartes = [e for e in accords + rejets if e['etrangeres']]

    out = []
    for e in retenus:
        racine = RACINE.get(e['racine'], e['racine'])
        suf = SUFFIXE[e['type']]
        nom = racine + suf
        doigts = sorted((int(k), v) for k, v in e['doigts'].items())
        out.append(dict(
            id='u' + nom.replace('#', 's'),
            name=nom, full=f'{racine} {PLEIN[suf]}',
            category=CATEGORIE[suf],
            fingers=[[c, f, 1] for c, f in doigts],
            open=e['vides'], muted=[], startFret=1,
        ))
    return out, ecartes


if __name__ == '__main__':
    chemin = sys.argv[1] if len(sys.argv) > 1 else '~/Desktop/ukulele-chords.png'
    r, ecartes = convertir(chemin)
    S = os.path.dirname(os.path.abspath(__file__))
    json.dump(r, open(os.path.join(S, 'ukulele-app.json'), 'w'))
    from collections import Counter
    print('accords convertis:', len(r), '| ecartes:', [e['nom'] for e in ecartes])
    print(Counter(c['category'] for c in r))
