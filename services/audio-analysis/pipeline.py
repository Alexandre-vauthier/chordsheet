"""
Cœur de la détection d'accords par séparation de sources.

Chaîne : audio -> Demucs (4 stems) -> other + bass -> madmom
(accords maj/min + downbeats + tonalité). Réutilisé par le CLI (analyze.py)
et le service HTTP (service.py).
"""

import sys
import os
import glob
import shutil
import subprocess
import tempfile


def get_audio(src: str, workdir: str) -> str:
    """Chemin d'un fichier audio local.
    - URL YouTube → yt-dlp (avec cookies si YT_COOKIES_FILE est défini).
    - Autre URL (fichier hébergé, ex. Firebase Storage) → téléchargement direct.
    - Chemin local → tel quel.
    """
    import urllib.request

    is_url = src.startswith("http://") or src.startswith("https://")
    if is_url and ("youtube.com" in src or "youtu.be" in src):
        out_tmpl = os.path.join(workdir, "input.%(ext)s")
        cmd = ["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "0", "-o", out_tmpl]
        cookies = os.environ.get("YT_COOKIES_FILE")
        if cookies and os.path.isfile(cookies):
            cmd += ["--cookies", cookies]
        cmd.append(src)
        subprocess.run(cmd, check=True)
        files = glob.glob(os.path.join(workdir, "input.*"))
        if not files:
            raise RuntimeError("yt-dlp n'a produit aucun fichier.")
        return files[0]

    if is_url:
        dest = os.path.join(workdir, "input_audio")
        req = urllib.request.Request(src, headers={"User-Agent": "chordsheet-audio/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
            shutil.copyfileobj(r, f)
        return dest

    if not os.path.isfile(src):
        raise FileNotFoundError(src)
    return src


def separate(audio: str, workdir: str):
    """Sépare avec Demucs. Renvoie (chemin_other, chemin_bass)."""
    sep_root = os.path.join(workdir, "sep")
    subprocess.run(
        [sys.executable, "-m", "demucs", "-o", sep_root, audio],
        check=True,
    )
    other = glob.glob(os.path.join(sep_root, "*", "*", "other.wav"))
    bass = glob.glob(os.path.join(sep_root, "*", "*", "bass.wav"))
    if not other or not bass:
        raise RuntimeError("Stems Demucs introuvables (other/bass).")
    return other[0], bass[0]


def mix_harmonic(other: str, bass: str, out_wav: str) -> str:
    """Mixe other + bass en mono normalisé — entrée de la détection d'accords."""
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


def recognize(harmonic_wav: str) -> dict:
    """madmom : accords, downbeats, tonalité, BPM. Renvoie un dict prêt à sérialiser."""
    from madmom.audio.chroma import DeepChromaProcessor
    from madmom.features.chords import DeepChromaChordRecognitionProcessor
    from madmom.features.downbeats import RNNDownBeatProcessor, DBNDownBeatTrackingProcessor
    from madmom.features.key import CNNKeyRecognitionProcessor, key_prediction_to_label

    chroma = DeepChromaProcessor()(harmonic_wav)
    raw_chords = DeepChromaChordRecognitionProcessor()(chroma)  # [(start, end, label), ...]

    act = RNNDownBeatProcessor()(harmonic_wav)
    downbeats = DBNDownBeatTrackingProcessor(beats_per_bar=[3, 4], fps=100)(act)

    try:
        key = key_prediction_to_label(CNNKeyRecognitionProcessor()(harmonic_wav))
    except Exception:
        key = ""

    times = [float(t) for t, _ in downbeats]
    intervals = sorted(b - a for a, b in zip(times, times[1:]) if b > a)
    bpm = round(60.0 / intervals[len(intervals) // 2], 1) if intervals else 0.0

    chords = [{"start": float(s), "end": float(e), "label": str(l)} for s, e, l in raw_chords]
    duration = chords[-1]["end"] if chords else (times[-1] if times else 0.0)

    return {
        "bpm": bpm,
        "key": key,
        "duration": round(float(duration), 2),
        "downbeats": [[float(t), int(b)] for t, b in downbeats],
        "chords": chords,
    }


def analyze(source: str) -> dict:
    """Bout en bout : source (fichier ou URL) -> dict {bpm, key, duration, downbeats, chords}."""
    workdir = tempfile.mkdtemp(prefix="chords_")
    try:
        audio = get_audio(source, workdir)
        other, bass = separate(audio, workdir)
        harmonic = mix_harmonic(other, bass, os.path.join(workdir, "harmonic.wav"))
        return recognize(harmonic)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
