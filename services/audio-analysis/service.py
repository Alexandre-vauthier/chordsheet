"""
Service HTTP de détection d'accords (FastAPI) — à déployer sur Cloud Run.

POST /analyze
  - soit multipart avec un fichier audio (champ `file`)
  - soit un champ `youtube_url`
  - en-tête X-API-Key (si API_KEY est défini côté serveur)
  → { bpm, key, duration, downbeats, chords }

GET /health → { status: "ok" }
"""

import os
import shutil
import tempfile
import logging

from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import pipeline

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="ChordSheet — Analyse audio")

API_KEY = os.environ.get("API_KEY", "")
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


def _check_key(x_api_key: str):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Clé API invalide.")


@app.post("/analyze")
async def analyze_endpoint(
    youtube_url: str = Form(default=""),
    audio_url: str = Form(default=""),
    file: UploadFile = File(default=None),
    x_api_key: str = Header(default=""),
):
    _check_key(x_api_key)
    if not youtube_url and not audio_url and file is None:
        raise HTTPException(status_code=400, detail="Fournir un fichier, audio_url ou youtube_url.")

    workdir = tempfile.mkdtemp(prefix="upload_")
    try:
        if file is not None:
            path = os.path.join(workdir, file.filename or "audio.bin")
            with open(path, "wb") as f:
                shutil.copyfileobj(file.file, f)
            source = path
            what = "fichier"
        elif audio_url:
            source = audio_url
            what = "audio_url"
        else:
            source = youtube_url
            what = youtube_url

        logging.info("Analyse : %s", what)
        return pipeline.analyze(source)
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Échec de l'analyse")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


@app.get("/health")
async def health():
    return {"status": "ok"}
