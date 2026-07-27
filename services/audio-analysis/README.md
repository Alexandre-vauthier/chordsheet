# Spike — détection d'accords par séparation de sources

Objectif : **juger la qualité** de la chaîne `Demucs → madmom` sur quelques
morceaux, avant de décider d'industrialiser (API, structuration en grille, UI).

Ce n'est pas le service final. C'est un banc d'essai en ligne de commande.

## La chaîne

```
audio (fichier ou lien YouTube)
  → Demucs        : sépare en 4 stems (voix / batterie / basse / other)
  → on garde      : "other" (guitare/piano) + "bass" (fondamentale)
  → madmom        : accords majeurs/mineurs + temps forts (downbeats)
  → affichage     : aperçu mesure par mesure + suite d'accords
```

## Installation (macOS Apple Silicon)

madmom et Demucs sont capricieux. Recette connue qui marche :

```bash
# 1. Python 3.10 (madmom casse sur 3.11+)
brew install python@3.10

# 2. venv dédié
cd services/audio-analysis
/opt/homebrew/bin/python3.10 -m venv .venv
source .venv/bin/activate

# 3. d'abord numpy + cython (madmom en dépend pour se compiler)
pip install --upgrade pip
pip install "numpy<2" "cython<3"

# 4. le reste
pip install scipy soundfile yt-dlp demucs
pip install "madmom @ git+https://github.com/CPJKU/madmom.git@main"

# ffmpeg est requis par Demucs / yt-dlp
brew install ffmpeg
```

Si l'installation de madmom échoue, note l'erreur : c'est le point le plus
fragile, on ajustera (version, patch, ou alternative type Chordino/autochord).

## Utilisation

```bash
source .venv/bin/activate

# depuis un fichier que tu possèdes (le plus fiable)
python analyze.py ~/Music/ma_chanson.mp3

# depuis un lien YouTube (yt-dlp — peut être bloqué par YouTube)
python analyze.py "https://www.youtube.com/watch?v=XXXX"

# garder les stems séparés pour écouter ce que "voit" l'algo
python analyze.py ma_chanson.mp3 --keep
```

## Ce qu'on regarde

- Les **accords collent-ils** à la chanson (sur le refrain, un passage connu) ?
- Le **BPM** est-il correct (pour caler les mesures ensuite) ?
- Écoute le stem `harmonic`/`other` (option `--keep`) : si la séparation est propre,
  la détection a une chance ; si ça bave, c'est perdu d'avance.

## Limites connues (attendues)

- madmom ne sort que **majeurs / mineurs** (pas de 7, sus, dim…). C'est déjà bien
  mieux que des templates sur le mix complet, mais ça reste un brouillon à corriger.
- Demucs sur **CPU** est lent (plusieurs minutes par morceau). Un GPU accélère fort.
- `yt-dlp` = maillon fragile (CGU YouTube, blocages). L'upload de fichier l'évite.

## Suite (si la qualité est jugée suffisante)

1. Emballer la chaîne dans un service (Cloud Run GPU, ou worker/queue).
2. **Structuration IA** : passer la timeline d'accords + downbeats à un LLM pour
   découper en sections/mesures (comme l'analyse photo).
3. Route API proxy + UI de création (lien YouTube **et** upload) dans l'app.
