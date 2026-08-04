"""
Lecture et écriture de PNG, sans bibliothèque image.

L'écriture sert à **regarder** une page ou une carte plutôt qu'à deviner ses seuils.
La lecture sert quand la source n'est pas un PDF : un dictionnaire trouvé en image
se décode ici, et le reste de la chaîne n'y voit pas de différence.
"""
import zlib, struct


def lire(chemin):
    """Rend (largeur, hauteur, pixels RVB) d'un PNG 8 bits non entrelacé."""
    d = open(chemin, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'{chemin} : ce n\'est pas un PNG')

    i, flux, entete = 8, bytearray(), None
    while i < len(d):
        n, = struct.unpack('>I', d[i:i + 4])
        t = d[i + 4:i + 8]
        if t == b'IHDR': entete = struct.unpack('>IIBBBBB', d[i + 8:i + 21])
        elif t == b'IDAT': flux += d[i + 8:i + 8 + n]
        elif t == b'IEND': break
        i += 12 + n

    w, h, prof, couleur, _, filtre, entrelace = entete
    if (prof, filtre, entrelace) != (8, 0, 0):
        raise ValueError(f'{chemin} : profondeur {prof}, filtre {filtre}, entrelacement {entrelace} non gérés')
    # 2 = RVB, 6 = RVB + alpha (qu'on jette : ces documents sont opaques)
    if couleur not in (2, 6):
        raise ValueError(f'{chemin} : type de couleur {couleur} non géré (RVB attendu)')
    canaux = 3 if couleur == 2 else 4

    brut = zlib.decompress(bytes(flux))
    pas = w * canaux
    out = bytearray(w * h * 3)
    precedente = bytearray(pas)

    # Défiltrage : chaque ligne PNG est écrite comme un écart à ses voisines, et
    # porte en tête le code de la prédiction employée.
    for y in range(h):
        base = y * (pas + 1)
        mode = brut[base]
        ligne = bytearray(brut[base + 1:base + 1 + pas])
        for x in range(pas):
            a = ligne[x - canaux] if x >= canaux else 0
            b = precedente[x]
            c = precedente[x - canaux] if x >= canaux else 0
            if mode == 0: pass
            elif mode == 1: ligne[x] = (ligne[x] + a) & 0xFF
            elif mode == 2: ligne[x] = (ligne[x] + b) & 0xFF
            elif mode == 3: ligne[x] = (ligne[x] + (a + b) // 2) & 0xFF
            elif mode == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                ligne[x] = (ligne[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 0xFF
            else:
                raise ValueError(f'{chemin} : filtre de ligne {mode} inconnu')
        for x in range(w):
            out[(y * w + x) * 3:(y * w + x) * 3 + 3] = ligne[x * canaux:x * canaux + 3]
        precedente = ligne

    return w, h, bytes(out)

def ecrire(chemin, raw, w, h, x0=0, y0=0, larg=None, haut=None):
    larg = larg or w; haut = haut or h
    lignes = b''
    for y in range(y0, y0 + haut):
        d = bytearray(b'\x00')
        i = (y * w + x0) * 3
        d += raw[i:i + larg * 3]
        lignes += bytes(d)
    def bloc(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    png = b'\x89PNG\r\n\x1a\n'
    png += bloc(b'IHDR', struct.pack('>IIBBBBB', larg, haut, 8, 2, 0, 0, 0))
    png += bloc(b'IDAT', zlib.compress(lignes, 6))
    png += bloc(b'IEND', b'')
    open(chemin, 'wb').write(png)

def zoom(chemin, raw, w, h, x0, y0, larg, haut, k=5):
    """Agrandissement au plus proche voisin : les diagrammes font 70 px de large."""
    out = bytearray()
    for y in range(y0, y0 + haut):
        ligne = bytearray()
        for x in range(x0, x0 + larg):
            i = (y * w + x) * 3
            ligne += raw[i:i+3] * k
        out += bytes(ligne) * k
    ecrire(chemin, bytes(out), larg * k, haut * k)
