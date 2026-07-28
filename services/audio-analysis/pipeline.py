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
    """Mixe other + un peu de bass en mono normalisé — entrée de la détection d'accords.

    La basse aide à identifier la fondamentale (C vs Am), mais trop présente elle
    ANTICIPE les changements d'accords (une montée de basse en fin de mesure vers la
    fondamentale suivante décale l'accord détecté avant le temps fort). On la met
    donc nettement en retrait (poids faible) : assez pour la fondamentale, pas assez
    pour entraîner le timing.
    """
    import numpy as np
    import soundfile as sf

    yo, sr = sf.read(other, always_2d=True)
    yb, _ = sf.read(bass, always_2d=True)
    n = min(len(yo), len(yb))
    mono = yo[:n].mean(axis=1) + 0.3 * yb[:n].mean(axis=1)  # basse nettement en retrait
    peak = float(np.max(np.abs(mono))) or 1.0
    mono = (mono / peak) * 0.9
    sf.write(out_wav, mono, sr)
    return out_wav


_PC = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6,
       "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def _chords_with_sevenths(raw_chords, chroma):
    """Ajoute à chaque accord un suffixe de 7e ("", "7", "maj7") selon le chroma.

    Sur un accord majeur : 7e mineure présente → "7" (dominante), 7e majeure → "maj7".
    Sur un accord mineur : 7e mineure présente → "7" (donne m7). Conservateur (seuils
    élevés) pour éviter les fausses 7e.
    """
    import numpy as np

    chroma = np.asarray(chroma, dtype=float)
    if chroma.ndim != 2 or chroma.shape[1] != 12 or len(chroma) == 0:
        return [{"start": float(s), "end": float(e), "label": str(l), "q7": ""} for s, e, l in raw_chords]
    total = max((float(e) for _s, e, _l in raw_chords), default=1.0)
    fps = (len(chroma) / total) if total > 0 else 10.0
    out = []
    for s, e, l in raw_chords:
        lab = str(l)
        q7 = ""
        if ":" in lab and lab != "N":
            root_s, qual = lab.split(":")
            r = _PC.get(root_s)
            if r is not None:
                i0 = int(float(s) * fps)
                i1 = max(i0 + 1, int(float(e) * fps))
                seg = chroma[i0:i1]
                if len(seg) > 0:
                    prof = seg.mean(axis=0).astype(float)
                    mx = float(prof.max()) or 1.0
                    prof = prof / mx
                    min7 = prof[(r + 10) % 12]
                    maj7 = prof[(r + 11) % 12]
                    third = prof[(r + (3 if qual == "min" else 4)) % 12]
                    fifth = prof[(r + 7) % 12]
                    ref = max(third, fifth, 0.3)
                    if qual == "maj":
                        if maj7 >= 0.55 and maj7 >= min7 and maj7 >= 0.85 * ref:
                            q7 = "maj7"
                        elif min7 >= 0.55 and min7 > maj7 and min7 >= 0.85 * ref:
                            q7 = "7"
                    else:  # min
                        if min7 >= 0.55 and min7 >= 0.85 * ref:
                            q7 = "7"
        out.append({"start": float(s), "end": float(e), "label": lab, "q7": q7})
    return out


def recognize(harmonic_wav: str, beat_wav: str = None) -> dict:
    """madmom : accords (mix harmonique) + downbeats (audio complet, avec batterie).

    La détection des temps est bien plus fiable sur le mix COMPLET (la batterie donne
    des onsets nets) que sur l'harmonique seul ; les accords, eux, sont plus propres
    sur l'harmonique. On sépare donc les deux sources.
    """
    from madmom.audio.chroma import DeepChromaProcessor
    from madmom.features.chords import DeepChromaChordRecognitionProcessor
    from madmom.features.downbeats import RNNDownBeatProcessor, DBNDownBeatTrackingProcessor
    from madmom.features.key import CNNKeyRecognitionProcessor, key_prediction_to_label

    # DeepChroma : optimisé maj/min, sert à reconnaître les accords de BASE.
    chroma = DeepChromaProcessor()(harmonic_wav)
    raw_chords = DeepChromaChordRecognitionProcessor()(chroma)  # [(start, end, label), ...]

    # Chroma BRUT (CLPChroma) : conserve toutes les notes (dont les 7e) -> sert à
    # détecter les extensions. Le DeepChroma, lui, efface volontairement les 7e.
    try:
        from madmom.audio.chroma import CLPChroma
        seventh_chroma = CLPChroma(harmonic_wav)
    except Exception:
        logging.exception("CLPChroma indisponible, repli sur DeepChroma pour les 7e")
        seventh_chroma = chroma

    # Temps / mesures depuis l'audio complet (batterie) si fourni, sinon l'harmonique.
    beat_src = beat_wav if beat_wav else harmonic_wav
    act = RNNDownBeatProcessor()(beat_src)
    downbeats = DBNDownBeatTrackingProcessor(beats_per_bar=[3, 4], fps=100)(act)

    try:
        key = key_prediction_to_label(CNNKeyRecognitionProcessor()(harmonic_wav))
    except Exception:
        key = ""

    times = [float(t) for t, _ in downbeats]
    intervals = sorted(b - a for a, b in zip(times, times[1:]) if b > a)
    bpm = round(60.0 / intervals[len(intervals) // 2], 1) if intervals else 0.0

    # Détection de 7e PAR-DESSUS l'accord de base (maj/min reste fiable pour la
    # structure) sur le chroma BRUT. q7 = suffixe à ajouter ("", "7", "maj7").
    chords = _chords_with_sevenths(raw_chords, seventh_chroma)
    duration = chords[-1]["end"] if chords else (times[-1] if times else 0.0)

    return {
        "bpm": bpm,
        "key": key,
        "duration": round(float(duration), 2),
        "downbeats": [[float(t), int(b)] for t, b in downbeats],
        "chords": chords,
    }


def analyze(source: str, on_progress=None) -> dict:
    """Bout en bout : source (fichier ou URL) -> dict {bpm, key, duration, downbeats, chords}.

    on_progress(percent:int, step:str) est appelé aux grandes étapes (pour un suivi
    en temps réel côté client via le doc Firestore du job).
    """
    def prog(pct, step):
        if on_progress:
            try:
                on_progress(pct, step)
            except Exception:
                pass

    workdir = tempfile.mkdtemp(prefix="chords_")
    try:
        prog(5, "Récupération de l'audio")
        audio = get_audio(source, workdir)
        prog(20, "Séparation des pistes (voix, batterie, harmonie)")
        other, bass = separate(audio, workdir)
        prog(70, "Mixage harmonique")
        harmonic = mix_harmonic(other, bass, os.path.join(workdir, "harmonic.wav"))
        prog(80, "Détection des accords et du tempo")
        # Accords sur l'harmonique, temps/mesures sur l'audio complet (batterie).
        result = recognize(harmonic, beat_wav=audio)
        prog(100, "Terminé")
        return result
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
