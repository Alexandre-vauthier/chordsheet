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
import json
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

# Client Firestore (lazy) pour le mode asynchrone. Sur Cloud Run, l'auth passe
# par le compte de service de l'instance (ADC) — aucune clé à fournir.
_db = None


def _firestore():
    global _db
    if _db is None:
        from google.cloud import firestore
        _db = firestore.Client()
    return _db

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


@app.post("/analyze-async")
def analyze_async_endpoint(
    job_id: str = Form(...),
    audio_url: str = Form(default=""),
    youtube_url: str = Form(default=""),
    x_api_key: str = Header(default=""),
):
    """Mode asynchrone (déclenché par Cloud Tasks).

    Écrit la progression puis le résultat (`timelineJson`) dans le doc Firestore
    `analysisJobs/{job_id}`. La structuration IA + création se font ensuite côté app.
    Idempotent : si le job est déjà analysé, ne relance pas l'analyse.
    """
    _check_key(x_api_key)
    if not audio_url and not youtube_url:
        raise HTTPException(status_code=400, detail="Fournir audio_url ou youtube_url.")

    ref = _firestore().collection("analysisJobs").document(job_id)
    snap = ref.get()
    if snap.exists and (snap.to_dict() or {}).get("status") in ("analyzed", "done"):
        return {"status": "already"}  # retry Cloud Tasks : ne pas refaire le travail

    def on_progress(pct, step):
        ref.set({"progress": int(pct), "step": step}, merge=True)

    ref.set({"status": "processing", "progress": 0, "step": "Démarrage"}, merge=True)
    source = audio_url or youtube_url
    try:
        timeline = pipeline.analyze(source, on_progress)
        ref.set(
            {"status": "analyzed", "progress": 100, "timelineJson": json.dumps(timeline)},
            merge=True,
        )
        return {"status": "ok"}
    except Exception as e:
        logging.exception("Échec analyse async")
        ref.set({"status": "error", "error": str(e)[:300]}, merge=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}
