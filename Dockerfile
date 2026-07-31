# syntax=docker/dockerfile:1.7
#
# Image locale de l'app Next.js (ChordSheet).
# Les services Python (services/audio-analysis, services/chord-detector) ont
# leurs propres Dockerfile pour Cloud Run : ils sont exclus de ce build, l'app
# les appelle à distance via CHORD_DETECTOR_URL.
#
#   Dev  : docker compose up dev     (hot reload, sources montées)
#   Prod : docker compose up --build web

ARG NODE_VERSION=22

# ---------------------------------------------------------------- base
FROM node:${NODE_VERSION}-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---------------------------------------------------------------- deps
# Le cache npm est monté (pas copié) : il reste dans le cache de build Docker
# et ne pèse rien dans les couches de l'image.
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ---------------------------------------------------------------- dev
# node_modules vient de l'image ; en compose il alimente un volume Docker,
# ce qui évite de mélanger les binaires darwin de l'hôte avec ceux de Linux.
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

# ---------------------------------------------------------------- builder
FROM base AS builder
ENV NODE_ENV=production
# Active output:'standalone' uniquement ici (cf. next.config.ts) : le déploiement
# Vercel garde son comportement par défaut, inchangé.
ENV BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# .env.local est monté en secret le temps du build : les NEXT_PUBLIC_* sont
# inlinés dans le bundle client à ce moment précis. Le fichier n'atterrit dans
# aucune couche de l'image.
RUN --mount=type=secret,id=env_local,target=/app/.env.local \
    npm run build \
 && rm -rf .next/cache

# ---------------------------------------------------------------- runner
# Sortie standalone : seules les dépendances réellement tracées sont embarquées.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
