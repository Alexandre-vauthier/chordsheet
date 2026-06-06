import numpy as np
import librosa

NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

# Accords français (notation DO-RÉ-MI non implémentée ici, on renvoie la notation américaine)
# Le frontend ChordSheet fait la traduction via useChordNotation

def _make_templates() -> dict[str, np.ndarray]:
    templates: dict[str, np.ndarray] = {}
    for i, note in enumerate(NOTES):
        # Majeur : fondamentale + tierce majeure (+4) + quinte (+7)
        maj = np.zeros(12)
        maj[i % 12] = 1.0
        maj[(i + 4) % 12] = 1.0
        maj[(i + 7) % 12] = 1.0
        templates[note] = maj / np.linalg.norm(maj)

        # Mineur : fondamentale + tierce mineure (+3) + quinte (+7)
        min_ = np.zeros(12)
        min_[i % 12] = 1.0
        min_[(i + 3) % 12] = 1.0
        min_[(i + 7) % 12] = 1.0
        templates[f'{note}m'] = min_ / np.linalg.norm(min_)

        # Dominant 7 : fondamentale + tierce majeure (+4) + quinte (+7) + septième mineure (+10)
        dom7 = np.zeros(12)
        dom7[i % 12] = 1.0
        dom7[(i + 4) % 12] = 1.0
        dom7[(i + 7) % 12] = 1.0
        dom7[(i + 10) % 12] = 0.7  # poids réduit pour la 7e
        templates[f'{note}7'] = dom7 / np.linalg.norm(dom7)

    return templates

TEMPLATES = _make_templates()


def _match_chord(chroma: np.ndarray) -> str:
    """Renvoie le nom de l'accord le plus proche par corrélation cosinus."""
    chroma_norm = chroma / (np.linalg.norm(chroma) + 1e-6)
    best_chord = 'N'
    best_score = -1.0
    for name, template in TEMPLATES.items():
        score = float(np.dot(chroma_norm, template))
        if score > best_score:
            best_score = score
            best_chord = name
    # Seuil minimal pour éviter de sortir un accord sur un silence
    return best_chord if best_score > 0.55 else ''


def detect(audio_path: str) -> dict:
    """
    Analyse un fichier audio et renvoie :
    - bpm (float)
    - key (str, ex: "Am")
    - duration (float, secondes)
    - chords (list of {name, startSec, endSec})
    """
    y, sr = librosa.load(audio_path, mono=True, duration=600)  # max 10 min
    duration = float(librosa.get_duration(y=y, sr=sr))

    # BPM
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units='frames')
    bpm = float(round(float(tempo), 1))

    # Tonalité
    chroma_global = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_idx, scale = librosa.key.key(chroma_global.mean(axis=1))
    key_str = f"{NOTES[key_idx]}{'m' if scale == 'minor' else ''}"

    # Chromagramme synchronisé aux temps
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)

    # Pour chaque intervalle entre deux temps, calculer l'accord
    raw_chords: list[dict] = []
    beat_frames_list = beat_frames.tolist()
    beat_frames_list.append(chroma.shape[1] - 1)  # dernier frame

    for i in range(len(beat_frames_list) - 1):
        f_start = beat_frames_list[i]
        f_end = beat_frames_list[i + 1]
        segment_chroma = chroma[:, f_start:f_end].mean(axis=1)
        chord_name = _match_chord(segment_chroma)
        t_start = float(librosa.frames_to_time(beat_frames_list[i], sr=sr, hop_length=hop))
        t_end = float(librosa.frames_to_time(beat_frames_list[i + 1], sr=sr, hop_length=hop))
        raw_chords.append({'name': chord_name, 'startSec': t_start, 'endSec': t_end})

    # Fusionner les accords consécutifs identiques
    merged: list[dict] = []
    for c in raw_chords:
        if merged and merged[-1]['name'] == c['name']:
            merged[-1]['endSec'] = c['endSec']
        else:
            merged.append(dict(c))

    return {
        'bpm': bpm,
        'key': key_str,
        'duration': round(duration, 2),
        'chords': merged,
    }
