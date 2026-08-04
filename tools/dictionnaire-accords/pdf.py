"""
Extraction des pages du dictionnaire, depuis le PDF.

Aucune bibliothèque image n'est installée sur cette machine, et rien n'oblige à en
installer une : les pages du document sont de simples images RVB compressées en
zlib, que le format PDF range dans des objets « XObject ». On les décompresse
telles quelles, et le reste de la chaîne travaille sur ces octets bruts.

Chaque page devient un fichier `.raw` : trois octets par pixel, ligne par ligne,
sans en-tête. `cartes.Image` sait les relire.

    python3 pdf.py ~/Desktop/dictionnaire-accords-guitare-complet.pdf .

Les images du document guitare portent les numéros d'objet 5, 10 et 15 ; d'où les
noms `img5`, `img10`, `img15`. Un autre document aura les siens, et le script les
trouve tout seul.
"""
import os
import re
import sys
import zlib

MOTIF = re.compile(rb'(\d+)\s+0\s+obj\s*<<([^>]*?/Subtype\s*/Image.*?)>>\s*stream\r?\n', re.S)


def entier(dic: bytes, cle: bytes) -> int | None:
    m = re.search(cle + rb'\s+(\d+)', dic)
    return int(m.group(1)) if m else None


def pages(pdf: bytes):
    """Rend (numéro d'objet, largeur, hauteur, pixels RVB) pour chaque page image."""
    for m in MOTIF.finditer(pdf):
        num, dic = int(m.group(1)), m.group(2)

        # On ne veut que les pages : du RVB compressé en zlib. Le document porte
        # aussi un bandeau en JPEG, qui demanderait un décodeur entier pour rien.
        if b'/FlateDecode' not in dic or b'/DeviceRGB' not in dic:
            continue

        larg, haut = entier(dic, rb'/Width'), entier(dic, rb'/Height')
        if not larg or not haut:
            continue

        # La longueur du flux est souvent une référence vers un autre objet
        # (`/Length 6 0 R`) plutôt qu'un nombre. Plutôt que de la résoudre, on
        # décompresse jusqu'au bout : zlib s'arrête de lui-même à la fin du flux.
        brut = zlib.decompressobj().decompress(pdf[m.end():])
        attendu = larg * haut * 3
        if len(brut) != attendu:
            print(f'  objet {num} ignoré : {len(brut)} octets pour {attendu} attendus')
            continue
        yield num, larg, haut, brut


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(2)
    chemin = os.path.expanduser(sys.argv[1])
    dossier = os.path.expanduser(sys.argv[2]) if len(sys.argv) > 2 else '.'
    os.makedirs(dossier, exist_ok=True)

    pdf = open(chemin, 'rb').read()
    trouvees = []
    for num, larg, haut, brut in pages(pdf):
        nom = os.path.join(dossier, f'img{num}.raw')
        open(nom, 'wb').write(brut)
        trouvees.append((num, larg, haut))
        print(f'  img{num}.raw  {larg}x{haut}')

    if not trouvees:
        raise SystemExit('aucune page image trouvée dans ce PDF')
    print('\nÀ reporter dans cartes.PAGES :')
    print('PAGES = [' + ', '.join(f"('img{n}', {w}, {h})" for n, w, h in trouvees) + ']')


if __name__ == '__main__':
    main()
