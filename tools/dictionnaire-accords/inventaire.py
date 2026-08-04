"""
Inventaire des accords selon leur provenance.

Trois provenances coexistent dans `chord-data.ts`, et rien ne les distinguait :

- **relevé** sur un document imprimé, puis vérifié contre le nom de l'accord ;
- **hérité** : présent dans la bibliothèque avant ces relevés, sur aucun document,
  donc sans référence extérieure ;
- **calculé** : produit à la volée par `generateStringVoicing`, sans référence non
  plus, mais construit pour ne contenir que les notes de l'accord.

Ce qui est relevé fait foi. Ce qui est hérité mérite d'être revu le jour où un
document couvre ces accords. Le calculé est un filet, et se remplace de lui-même
dès qu'un doigté relevé porte le même nom.

    python3 inventaire.py > INVENTAIRE.md

Les quatre documents sources doivent être accessibles (voir le README).
"""
import os
import re
import sys

S = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, S)

RACINE_PROJET = os.path.abspath(os.path.join(S, '..', '..'))
CHORD_DATA = os.path.join(RACINE_PROJET, 'src', 'lib', 'chord-data.ts')

DOCUMENTS = [
    ('guitar', 'Guitare', 'dictionnaire-accords-guitare-complet.pdf', 'GUITAR_CHORDS'),
    ('ukulele', 'Ukulélé', 'ukulele-chords.png', 'UKULELE_CHORDS'),
    ('mandolin', 'Mandoline', 'mandoline-chords.png', 'MANDOLIN_CHORDS'),
    ('banjo', 'Banjo', 'banjo-chords.png', 'BANJO_CHORDS'),
]
SANS_DOCUMENT = [('bass', 'Basse', 'BASS_CHORDS'), ('piano', 'Piano', 'PIANO_CHORDS')]


def noms_statiques(tableau):
    """Noms d'accords d'un tableau de `chord-data.ts`, dans l'ordre du fichier."""
    s = open(CHORD_DATA, encoding='utf-8').read()
    deb = s.index(f'export const {tableau}')
    fin = s.index('\n];', deb)
    return [m.group(1) for m in re.finditer(r'name: [\'"]([^\'"]+)[\'"]', s[deb:fin])]


def releves():
    """Noms relevés sur chaque document, par instrument."""
    from convertir import convertir as guitare
    from convertir_ukulele import convertir as uku
    from convertir_mandoline import convertir as mando
    from convertir_banjo import convertir as bjo

    bureau = os.path.expanduser('~/Desktop')
    out = {}
    out['guitar'] = [c['name'] for c in guitare()]
    out['ukulele'] = [c['name'] for c in uku(os.path.join(bureau, 'ukulele-chords.png'))[0]]
    out['mandolin'] = [c['name'] for c in mando(os.path.join(bureau, 'mandoline-chords.png'))]
    out['banjo'] = [c['name'] for c in bjo(os.path.join(bureau, 'banjo-chords.png'))[0]]
    return out


def en_lignes(noms, par_ligne=12):
    """Une liste de noms en lignes de code, lisibles sans défiler."""
    noms = sorted(set(noms))
    return '\n'.join('`' + '` `'.join(noms[i:i + par_ligne]) + '`'
                     for i in range(0, len(noms), par_ligne))


def main():
    rel = releves()
    print('# Inventaire des accords par provenance\n')
    print('Généré par `python3 inventaire.py > INVENTAIRE.md`. À refaire après toute')
    print('reprise de document.\n')
    print('| Provenance | Ce que ça vaut |')
    print('|---|---|')
    print('| **Relevé** | Lu sur un document imprimé, puis vérifié contre le nom de '
          "l'accord : aucune note étrangère. C'est la référence. |")
    print('| **Hérité** | Déjà dans la bibliothèque avant ces relevés, sur aucun '
          'document. Sans référence extérieure — à revoir en priorité. |')
    print('| **Calculé** | Produit à la volée par le générateur pour tout nom '
          "qu'aucun doigté ne couvre. Sans référence, mais construit pour ne "
          "contenir que les notes de l'accord. |\n")

    total_rel = total_her = 0
    print('## Vue d\'ensemble\n')
    print('| Instrument | Document | Relevés | Hérités |')
    print('|---|---|---:|---:|')
    for cle, libelle, doc, tableau in DOCUMENTS:
        statiques = noms_statiques(tableau)
        r = [n for n in statiques if n in set(rel[cle])]
        h = [n for n in statiques if n not in set(rel[cle])]
        total_rel += len(r); total_her += len(h)
        print(f'| {libelle} | `{doc}` | {len(r)} | {len(h)} |')
    for cle, libelle, tableau in SANS_DOCUMENT:
        h = noms_statiques(tableau)
        total_her += len(h)
        print(f'| {libelle} | — | 0 | {len(h)} |')
    print(f'| **Total** | | **{total_rel}** | **{total_her}** |\n')

    for cle, libelle, doc, tableau in DOCUMENTS:
        statiques = noms_statiques(tableau)
        r = [n for n in statiques if n in set(rel[cle])]
        h = [n for n in statiques if n not in set(rel[cle])]
        print(f'## {libelle}\n')
        print(f'Source : `{doc}`\n')
        print(f'### Relevés sur le document ({len(r)})\n')
        print(en_lignes(r) + '\n')
        if h:
            print(f'### Hérités, sans référence ({len(h)})\n')
            print(en_lignes(h) + '\n')

    for cle, libelle, tableau in SANS_DOCUMENT:
        h = noms_statiques(tableau)
        print(f'## {libelle}\n')
        print(f'Aucun document. Les {len(h)} accords sont hérités.\n')
        print(en_lignes(h) + '\n')


if __name__ == '__main__':
    main()
