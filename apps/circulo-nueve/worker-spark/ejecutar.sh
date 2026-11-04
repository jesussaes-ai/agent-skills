#!/bin/sh
# Pide un pase temporal (6 h) a la Edge Function credencial-spark y procesa la cola.
# Cada 2 h deja de tomar trabajos nuevos, pide otro pase y sigue (un trabajo largo puede
# seguir hasta 4 h con el pase anterior). Variables (archivo .env, permisos 600):
#   CN_SUPABASE_URL, CN_WORKER_NOMBRE, CN_WORKER_SECRETO
set -u
campo() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.stdout.write(String(j[process.argv[1]]??""))})' "$1"; }

while true; do
  respuesta=$(curl -fsS -X POST "$CN_SUPABASE_URL/functions/v1/credencial-spark" \
    -H "x-worker-nombre: $CN_WORKER_NOMBRE" -H "x-worker-secreto: $CN_WORKER_SECRETO") || {
    echo "$(date -Is) sin credencial; reintento en 60 s" >&2
    sleep 60
    continue
  }
  SUPABASE_WORKER_TOKEN=$(printf '%s' "$respuesta" | campo token)
  NEXT_PUBLIC_SUPABASE_URL=$(printf '%s' "$respuesta" | campo url)
  NEXT_PUBLIC_SUPABASE_ANON_KEY=$(printf '%s' "$respuesta" | campo llave_publica)
  export SUPABASE_WORKER_TOKEN NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY
  echo "$(date -Is) credencial lista; procesando la cola" >&2
  INGESTA_MAX_MINUTOS=120 npx --no-install tsx scripts/worker-ingesta.mts --continuo || sleep 30
done
