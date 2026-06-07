import os
import tempfile
import logging
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
from chord_utils import detect

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ChordSheet — Détecteur d'accords")

# CORS : autoriser uniquement le domaine Vercel (configurable via variable d'env)
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

# Clé API simple pour éviter les abus (définie en variable d'env sur Cloud Run)
API_KEY = os.environ.get("API_KEY", "")


class AnalyzeRequest(BaseModel):
    youtube_url: str


def _download_audio(url: str, tmpdir: str) -> tuple[str, str, str]:
    """Télécharge l'audio et renvoie (chemin_fichier, titre, artiste)."""
    cookies_path = "/secrets/youtube-cookies"
    logger.info("Cookies présents : %s", os.path.exists(cookies_path))

    ydl_opts = {
        "format": "bestaudio/best",
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "128",
        }],
        "outtmpl": os.path.join(tmpdir, "audio.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "extractor_args": {"youtube": {"player_client": ["tv_embedded", "android", "web"]}},
        **({"cookiefile": cookies_path} if os.path.exists(cookies_path) else {}),
    }

    # Utiliser yt-dlp sans context manager pour gérer le cookie save en lecture seule
    ydl = yt_dlp.YoutubeDL(ydl_opts)
    try:
        info = ydl.extract_info(url, download=True)
    finally:
        try:
            ydl.close()
        except OSError:
            pass  # le secret Cloud Run est en lecture seule, on ignore l'erreur de sauvegarde

    title: str = info.get("title", "") or ""
    artist: str = info.get("artist", "") or ""
    if not artist and " - " in title:
        parts = title.split(" - ", 1)
        artist, title = parts[0].strip(), parts[1].strip()

    audio_path = os.path.join(tmpdir, "audio.mp3")
    if not os.path.exists(audio_path):
        # Fallback si l'extension diffère
        for f in os.listdir(tmpdir):
            if f.startswith("audio."):
                audio_path = os.path.join(tmpdir, f)
                break

    return audio_path, title, artist


@app.post("/analyze")
async def analyze(
    req: AnalyzeRequest,
    x_api_key: str = Header(default=""),
):
    # Vérification clé API (si configurée)
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Clé API invalide.")

    if "youtube.com" not in req.youtube_url and "youtu.be" not in req.youtube_url:
        raise HTTPException(status_code=400, detail="URL YouTube invalide.")

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            logger.info("Téléchargement audio : %s", req.youtube_url)
            audio_path, title, artist = _download_audio(req.youtube_url, tmpdir)

            logger.info("Analyse des accords…")
            result = detect(audio_path)

        return {
            **result,
            "title": title,
            "artist": artist,
            "youtubeUrl": req.youtube_url,
        }
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=422, detail=f"Impossible de télécharger la vidéo : {e}")
    except Exception as e:
        logger.exception("Erreur d'analyse")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}
