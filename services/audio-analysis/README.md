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

## Service HTTP (production)

`service.py` (FastAPI) emballe la chaîne. Endpoints :
- `POST /analyze` : soit un fichier (`file`, multipart), soit `youtube_url` (form) ;
  en-tête `X-API-Key` → `{ bpm, key, duration, downbeats, chords }`.
- `GET /health`.

### Tester le service en local

```bash
source .venv/bin/activate
pip install fastapi "uvicorn[standard]" python-multipart
uvicorn service:app --port 8080
# autre terminal :
curl -F "file=@/chemin/chanson.mp3" http://localhost:8080/analyze | head -c 800
```

### Déployer sur Cloud Run

Depuis `services/audio-analysis/` (build via le Dockerfile, image lourde ~2-3 Go) :

```bash
gcloud run deploy chordsheet-audio \
  --source . \
  --region europe-west1 \
  --memory 4Gi --cpu 4 \
  --timeout 600 \
  --concurrency 1 \
  --max-instances 3 \
  --set-env-vars API_KEY=<ta-cle>,ALLOWED_ORIGINS=https://<ton-domaine-vercel>
```

- **memory 4Gi / cpu 4** : Demucs + torch + madmom ont besoin de RAM et de CPU.
- **timeout 600** : une analyse prend de quelques secondes (bon CPU) à quelques minutes.
- **concurrency 1** : Demucs monopolise le CPU → une analyse par instance.
- `API_KEY` = à réutiliser côté app (variable `CHORD_DETECTOR_API_KEY`), et
  `CHORD_DETECTOR_URL` = l'URL Cloud Run renvoyée par le déploiement.

## Suite (briques app, une fois le service déployé)

2. **Structuration IA** : route Next.js qui passe la timeline + downbeats à un LLM
   pour découper en sections/mesures (comme l'analyse photo), avec respelling par
   tonalité (dièses → bémols) et fusion des mesures répétées.
3. **UI de création** : dans `/sheet/new`, saisie d'un lien YouTube **ou** upload
   d'un fichier → analyse → brouillon de grille ouvert dans l'éditeur.
