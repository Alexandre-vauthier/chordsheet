# Service de détection d'accords (Demucs + madmom) pour Cloud Run.
# Image CPU. Demucs + torch + madmom = image lourde (~2-3 Go) et build long.
FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git build-essential libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) numpy + cython AVANT (madmom se compile contre)
RUN pip install --no-cache-dir "numpy<2" "cython<3"

# 2) torch CPU-only (évite d'embarquer les wheels CUDA, ~Go en moins)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# 3) le reste
COPY requirements-service.txt .
RUN pip install --no-cache-dir -r requirements-service.txt

# 4) précharger le modèle Demucs dans l'image (sinon ~150 Mo téléchargés au 1er appel)
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')"

COPY pipeline.py service.py ./

ENV PORT=8080
# Cloud Run : 1 requête = 1 analyse (Demucs monopolise le CPU) -> concurrency basse conseillée.
CMD ["sh", "-c", "uvicorn service:app --host 0.0.0.0 --port ${PORT} --workers 1"]
