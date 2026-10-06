#!/bin/bash
# Respaldo manual de Círculo Nueve (el plan gratuito de Supabase no hace backups).
# Copia esquema, datos y archivos privados a una carpeta local y la cifra con gpg.
#
#   SUPABASE_DB_URL="postgresql://postgres.<ref>:<clave>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
#   NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="..." \
#   npm run respaldo
#
# Requiere Docker (lo usa `supabase db dump`) y, para cifrar, gpg (pide la frase de
# paso; o defínela en RESPALDO_CLAVE). Contiene datos
# personales: guárdalo cifrado y fuera del repositorio.
set -e
cd "$(dirname "$0")/.."

: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL (cadena de conexión de la base, «Session pooler»)}"
: "${NEXT_PUBLIC_SUPABASE_URL:?Falta NEXT_PUBLIC_SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Falta SUPABASE_SERVICE_ROLE_KEY}"

FECHA="$(date -u +%Y%m%d-%H%M)"
DESTINO="${RESPALDO_DESTINO:-$HOME/respaldos-circulo-nueve}/respaldo-$FECHA"
mkdir -p "$DESTINO"
trap 'rm -rf "$DESTINO"' EXIT

echo "Exportando esquema y datos…" >&2
npx supabase db dump --db-url "$SUPABASE_DB_URL" -f "$DESTINO/esquema.sql" >&2
npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f "$DESTINO/datos.sql" >&2
npx supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$DESTINO/roles.sql" >&2

echo "Descargando archivos privados (expedientes y biblioteca)…" >&2
npx tsx scripts/respaldo-storage.mts "$DESTINO/storage" >&2

ARCHIVO="$(dirname "$DESTINO")/respaldo-$FECHA.tar.gz"
tar -czf "$ARCHIVO" -C "$(dirname "$DESTINO")" "respaldo-$FECHA"
if command -v gpg >/dev/null 2>&1; then
  if [ -n "${RESPALDO_CLAVE:-}" ]; then
    # Sin terminal (tareas programadas): la frase de paso llega por variable de entorno.
    printf '%s' "$RESPALDO_CLAVE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
      --symmetric --cipher-algo AES256 --output "$ARCHIVO.gpg" "$ARCHIVO"
  else
    gpg --symmetric --cipher-algo AES256 --output "$ARCHIVO.gpg" "$ARCHIVO"
  fi
  rm -f "$ARCHIVO"
  ARCHIVO="$ARCHIVO.gpg"
else
  echo "AVISO: gpg no está instalado; el respaldo queda sin cifrar. Cífralo antes de moverlo." >&2
fi
echo "Respaldo listo: $ARCHIVO" >&2
printf '{"ok":true,"archivo":"%s"}\n' "$ARCHIVO"
