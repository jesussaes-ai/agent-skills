# Worker de ingesta de Círculo Nueve para la DGX Spark (ARM64, Ubuntu).
# Transcribe audio y video (Whisper local), lee YouTube (yt-dlp) y podcasts, hace OCR e indexa.
# Ver docs/biblioteca.md, «Worker en la DGX Spark».
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl unzip python3 \
  && rm -rf /var/lib/apt/lists/*

# yt-dlp (binario oficial) y Deno, que yt-dlp usa para resolver los retos JavaScript de YouTube.
# Se toma la última versión a propósito: YouTube cambia seguido y las versiones viejas dejan de funcionar.
RUN ARQ="$(uname -m)"; \
  if [ "$ARQ" = "aarch64" ]; then YT=yt-dlp_linux_aarch64; else YT=yt-dlp_linux; fi; \
  curl -fsSL -o /usr/local/bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$YT" \
  && chmod +x /usr/local/bin/yt-dlp \
  && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- -y \
  && yt-dlp --version && deno --version

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY worker-spark/ejecutar.sh /usr/local/bin/ejecutar-worker
RUN chmod +x /usr/local/bin/ejecutar-worker

ENV MODELOS_CACHE=/cache/modelos \
    NODE_OPTIONS=--max-old-space-size=16384
CMD ["ejecutar-worker"]
