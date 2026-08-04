"""
Passage de la planche mandoline au format de l'application.

Le document écrit les altérations en dièses, l'application en bémols (sauf fa
dièse). Ses huit types se nomment déjà comme dans l'application, à la catégorie
près : `7` y est `dom7`, `m7` est `min7`, et le majeur comme le mineur portent
un nom plein plutôt qu'un suffixe.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mandoline import extraire

RACINE = {'A#': 'Bb', 'C#': 'Db', 'D#': 'Eb', 'F#': 'F#', 'G#': 'Ab'}
CATEGORIE = {'': 'major', 'm': 'minor', '7': 'dom7', 'maj7': 'maj7',
             'm7': 'min7', 'sus4': 'sus4', 'sus2': 'sus2', 'dim': 'dim'}
PLEIN = {'': 'major', 'm': 'minor', '7': '7', 'maj7': 'maj7',
         'm7': 'min7', 'sus4': 'sus4', 'sus2': 'sus2', 'dim': 'dim'}


def convertir(chemin):
    accords, rejets = extraire(chemin)
    if rejets:
        raise SystemExit(f'{len(rejets)} cartes non validées : ' +
                         ' '.join(e['nom'] for e in rejets))
    out = []
    for e in accords:
        racine = RACINE.get(e['racine'], e['racine'])
        nom = racine + e['type']
        depart = e['depart']
        doigts = sorted((int(k), depart + v - 1) for k, v in e['doigts'].items())
        out.append(dict(
            id='m' + nom.replace('#', 's'),
            name=nom, full=f"{racine} {PLEIN[e['type']]}",
            category=CATEGORIE[e['type']],
            fingers=[[c, f, 1] for c, f in doigts],
            open=e['vides'], muted=e['muettes'], startFret=depart,
        ))
    return out


if __name__ == '__main__':
    chemin = sys.argv[1] if len(sys.argv) > 1 else '~/Desktop/mandoline-chords.png'
    r = convertir(chemin)
    S = os.path.dirname(os.path.abspath(__file__))
    json.dump(r, open(os.path.join(S, 'mandoline-app.json'), 'w'))
    from collections import Counter
    print('accords convertis:', len(r))
    print(Counter(c['category'] for c in r))
