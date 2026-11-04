#!/bin/sh
# Instala o actualiza el worker en la DGX Spark. Se ejecuta EN la Spark, dentro de la copia
# de apps/circulo-nueve (p. ej. ~/circulo-nueve). La primera vez crea worker-spark/.env con
# un secreto aleatorio e imprime su huella SHA-256 para registrarla en Supabase:
#   insert into public.worker_credenciales (nombre, huella_sha256) values ('dgx-spark', '<huella>');
# El secreto nunca se imprime ni sale de la Spark.
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  umask 077
  secreto=$(head -c 48 /dev/urandom | base64 | tr -d '\n/+=')
  {
    echo "CN_SUPABASE_URL=https://dsjtbtcyyliqqzkxxbjs.supabase.co"
    echo "CN_WORKER_NOMBRE=dgx-spark"
    echo "CN_WORKER_SECRETO=$secreto"
  } > .env
  echo "Huella para Supabase: $(printf '%s' "$secreto" | sha256sum | cut -d' ' -f1)"
fi
mkdir -p cache
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml ps
