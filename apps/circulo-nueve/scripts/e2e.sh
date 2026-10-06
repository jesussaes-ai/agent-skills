#!/bin/bash
# Pruebas de extremo a extremo contra Supabase local (Docker) y la app compilada.
# Uso: npm run test:e2e   (opcional: E2E_REUTILIZAR_DB=1 para no reiniciar la base)
set -e
cd "$(dirname "$0")/.."

if ! npx supabase status >/dev/null 2>&1; then
  echo "Iniciando Supabase local…" >&2
  npm run -s db:start >&2
fi
if [ "${E2E_REUTILIZAR_DB:-0}" != "1" ]; then
  echo "Reiniciando la base local…" >&2
  npx supabase db reset >&2
fi

eval "$(npx supabase status -o env 2>/dev/null | sed -n 's/^\(API_URL\|ANON_KEY\|SERVICE_ROLE_KEY\)=/export SB_\1=/p')"
export NEXT_PUBLIC_SUPABASE_URL="$SB_API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SB_ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SB_SERVICE_ROLE_KEY"
export NEXT_PUBLIC_SITE_URL="http://127.0.0.1:3000"
export E2E_MAILPIT_URL="${E2E_MAILPIT_URL:-http://127.0.0.1:54324}"
export INGESTA_PERMITIR_HOSTS_LOCALES=1

# Clave de alta efímera, solo para esta ejecución.
E2E_CLAVE_ALTA="$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))')"
export E2E_CLAVE_ALTA
ADMIN_SETUP_KEY_HASH="$(printf '%s' "$E2E_CLAVE_ALTA" | npx tsx scripts/generar-hash-clave.mts 2>/dev/null)"
export ADMIN_SETUP_KEY_HASH
# Llave efímera del proveedor LLM simulado (e2e/proveedores.spec.ts).
LLM_KEY_E2E="$(node -e 'process.stdout.write(require("crypto").randomBytes(18).toString("base64url"))')"
export LLM_KEY_E2E

echo "Compilando la app…" >&2
npm run -s build >&2
npx playwright test "$@"
