"""Encodeur PNG minimal : aucune bibliothèque image n'est installée ici."""
import zlib, struct

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
