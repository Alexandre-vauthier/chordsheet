"""
Passage du dictionnaire au format de l'application.

Deux écarts de vocabulaire à ne pas écraser :

- le document écrit les altérations en dièses, l'application en bémols (sauf fa#) ;
- ce que le document appelle « dim » est un **diminué septième** : A dim y sonne
  A C Eb Gb. L'accord que l'application nomme « Adim » est la triade A C Eb. Les
  cartes « dim » deviennent donc des `dim7`, et les triades existantes sont
  laissées telles quelles plutôt que remplacées par autre chose qu'elles.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from final import extraire

RACINE = {'A#': 'Bb', 'C#': 'Db', 'D#': 'Eb', 'F#': 'F#', 'G#': 'Ab'}
SUFFIXE = {'': '', 'm': 'm', '5': '5', 'aug': 'aug', 'dim': 'dim7', 'sus2': 'sus2',
           'sus4': 'sus4', '6': '6', 'm6': 'm6', '7': '7', 'm7': 'm7', 'Maj7': 'maj7',
           '7sus4': '7sus4', 'm7/b5': 'm7b5', '9': '9', 'add9': 'add9', 'm9': 'm9',
           '11': '11', '13': '13'}
CATEGORIE = {'': 'major', 'm': 'minor', '5': 'power', 'aug': 'aug', 'dim7': 'dim7',
             'sus2': 'sus2', 'sus4': 'sus4', '6': '6', 'm6': 'm6', '7': 'dom7',
             'm7': 'min7', 'maj7': 'maj7', '7sus4': '7sus4', 'm7b5': 'm7b5',
             '9': '9', 'add9': 'add9', 'm9': 'm9', '11': '11', '13': '13'}
PLEIN = {'': 'major', 'm': 'minor', '5': '5', 'aug': 'aug', 'dim7': 'dim7', 'sus2': 'sus2',
         'sus4': 'sus4', '6': '6', 'm6': 'm6', '7': '7', 'm7': 'min7', 'maj7': 'maj7',
         '7sus4': '7sus4', 'm7b5': 'm7b5', '9': '9', 'add9': 'add9', 'm9': 'm9',
         '11': '11', '13': '13'}


def convertir():
    accords, _ = extraire()
    out = []
    for e in accords:
        racine = RACINE.get(e['racine'], e['racine'])
        suf = SUFFIXE[e['type']]
        nom = racine + suf
        depart = e['depart']
        doigts = sorted(((int(k), depart + v - 1) for k, v in e['doigts'].items()))
        barre = e['barre'] and {'fret': depart + e['barre']['case'] - 1,
                                'fromString': e['barre']['de'], 'toString': e['barre']['a']}
        out.append(dict(
            id='g' + nom.replace('#', 's').replace('/', ''),
            name=nom, full=f"{racine} {PLEIN[suf]}".strip(),
            category=CATEGORIE[suf], barre=barre,
            fingers=[[c, f, 1] for c, f in doigts],
            open=e['vides'], muted=e['muettes'], startFret=depart,
        ))
    return out


if __name__ == '__main__':
    r = convertir()
    S = os.path.dirname(os.path.abspath(__file__))
    json.dump(r, open(os.path.join(S, 'pdf-app.json'), 'w'))
    print('accords convertis:', len(r))
    from collections import Counter
    print(Counter(c['category'] for c in r))
