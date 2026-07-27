#!/usr/bin/env python3
"""
Spike — reconnaissance d'accords par séparation de sources.

Chaîne : audio -> Demucs (4 stems) -> on garde "other" (guitare/piano) + "bass"
(fondamentale), on jette voix + batterie -> madmom (accords maj/min + downbeats).

BUT : juger la QUALITÉ sur quelques morceaux avant d'industrialiser. Ce n'est PAS
le service final : pas d'API, pas de structuration en grille, juste un affichage.

Usage :
    python analyze.py chanson.mp3
    python analyze.py "https://www.youtube.com/watch?v=XXXX"

Options :
    --keep   garder les stems séparés (utile pour écouter ce que voit l'algo)

Voir README.md pour l'installation (Demucs + madmom sont capricieux).
"""

import sys
import os
import glob
import shutil
import subprocess
import tempfile
import argparse


def get_audio(src: str, workdir: str) -> str:
    """Renvoie un chemin de fichier audio local (télécharge si c'est une URL)."""
    if src.startswith("http://") or src.startswith("https://"):
        print(f"→ Téléchargement audio (yt-dlp) : {src}")
        out_tmpl = os.path.join(workdir, "input.%(ext)s")
        subprocess.run(
            ["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "0",
             "-o", out_tmpl, src],
            check=True,
        )
        files = glob.glob(os.path.join(workdir, "input.*"))
        if not files:
            raise RuntimeError("yt-dlp n'a produit aucun fichier.")
        return files[0]
    if not os.path.isfile(src):
        raise FileNotFoundError(src)
    return src


def separate(audio: str, workdir: str):
    """Sépare avec Demucs. Renvoie (chemin_other, chemin_bass)."""
    print("→ Séparation de sources (Demucs)… (peut prendre plusieurs minutes sur CPU)")
    sep_root = os.path.join(workdir, "sep")
    subprocess.run(
        [sys.executable, "-m", "demucs", "-o", sep_root, audio],
        check=True,
    )
    # Demucs écrit dans sep/<modele>/<nom_du_morceau>/{vocals,drums,bass,other}.wav
    other = glob.glob(os.path.join(sep_root, "*", "*", "other.wav"))
    bass = glob.glob(os.path.join(sep_root, "*", "*", "bass.wav"))
    if not other or not bass:
        raise RuntimeError("Stems Demucs introuvables (other/bass).")
    return other[0], bass[0]


def mix_harmonic(other: str, bass: str, out_wav: str):
    """Mixe other + bass en mono, normalisé — c'est l'entrée de la détection."""
    import numpy as np
    import soundfile as sf

    yo, sr = sf.read(other, always_2d=True)
    yb, _ = sf.read(bass, always_2d=True)
    n = min(len(yo), len(yb))
    mono = yo[:n].mean(axis=1) + 0.7 * yb[:n].mean(axis=1)  # basse un peu en retrait
    peak = float(np.max(np.abs(mono))) or 1.0
    mono = (mono / peak) * 0.9
    sf.write(out_wav, mono, sr)
    return out_wav


def recognize(harmonic_wav: str):
    """madmom : accords (maj/min) + downbeats. Renvoie (chords, downbeats, bpm)."""
    print("→ Reconnaissance d'accords + temps (madmom)…")
    from madmom.audio.chroma import DeepChromaProcessor
    from madmom.features.chords import DeepChromaChordRecognitionProcessor
    from madmom.features.downbeats import RNNDownBeatProcessor, DBNDownBeatTrackingProcessor

    # Accords : deep chroma -> décodage CRF (majeurs / mineurs)
    chroma = DeepChromaProcessor()(harmonic_wav)
    chords = DeepChromaChordRecognitionProcessor()(chroma)  # [(start, end, label), ...]

    # Temps forts (downbeats) pour caler les mesures
    act = RNNDownBeatProcessor()(harmonic_wav)
    downbeats = DBNDownBeatTrackingProcessor(beats_per_bar=[3, 4], fps=100)(act)

    # BPM médian depuis les intervalles entre temps
    times = [t for t, _ in downbeats]
    intervals = [b - a for a, b in zip(times, times[1:]) if b > a]
    bpm = 0.0
    if intervals:
        intervals.sort()
        med_bar = intervals[len(intervals) // 2]
        # une "mesure" DBN = 1 temps ici (beats_per_bar sur les positions) -> approx
        bpm = round(60.0 / med_bar, 1) if med_bar else 0.0
    return chords, downbeats, bpm


def chord_at(chords, t: float) -> str:
    for start, end, label in chords:
        if start <= t < end:
            return "N" if label in ("N", "") else label
    return "-"


def main():
    ap = argparse.ArgumentParser(description="Spike détection d'accords (Demucs + madmom)")
    ap.add_argument("source", help="fichier audio ou lien YouTube")
    ap.add_argument("--keep", action="store_true", help="garder les stems séparés")
    args = ap.parse_args()

    workdir = tempfile.mkdtemp(prefix="chordspike_")
    try:
        audio = get_audio(args.source, workdir)
        other, bass = separate(audio, workdir)
        harmonic = mix_harmonic(other, bass, os.path.join(workdir, "harmonic.wav"))
        chords, downbeats, bpm = recognize(harmonic)

        print("\n" + "=" * 48)
        print(f"BPM estimé : ~{bpm}")
        print(f"Accords bruts détectés : {len(chords)}")

        print("\n— Aperçu accord par temps fort (mesure/temps) —")
        for t, beat_pos in downbeats:
            marker = "|" if int(beat_pos) == 1 else " "  # | = début de mesure
            print(f"  {marker} {t:6.2f}s  {chord_at(chords, t)}")

        print("\n— Suite d'accords fusionnée —")
        last = None
        for start, end, label in chords:
            lab = "N" if label in ("N", "") else label
            if lab != last and lab != "N":
                print(f"  {start:6.2f}s  {lab}")
                last = lab

        if args.keep:
            dest = os.path.join(os.getcwd(), "stems_" + os.path.splitext(os.path.basename(audio))[0])
            shutil.copytree(os.path.dirname(other), dest, dirs_exist_ok=True)
            print(f"\nStems copiés dans : {dest}")
        print("=" * 48)
    finally:
        if not args.keep:
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    main()
