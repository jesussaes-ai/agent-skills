#!/bin/bash
# Despliega el relay en Cloudflare Workers (plan gratuito) y registra el webhook.
# Requiere: CLOUDFLARE_API_TOKEN (plantilla "Edit Cloudflare Workers"), CLOUDFLARE_ACCOUNT_ID,
#           TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET, CURSOR_API_KEY.
# Uso: deploy-relay.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"
require_env CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID TELEGRAM_WEBHOOK_SECRET CURSOR_API_KEY
command -v npx >/dev/null || die "falta Node.js/npx"

RELAY_DIR="$(cd "$SCRIPT_DIR/../relay" && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp -r "$RELAY_DIR/src" "$RELAY_DIR/wrangler.toml" "$WORK/"
cd "$WORK"
WR="npx --yes wrangler@4"

echo "Buscando/creando namespace KV…" >&2
KV_ID=$($WR kv namespace list 2>/dev/null | python3 -c '
import json,sys
data=json.load(sys.stdin)
print(next((n["id"] for n in data if n["title"] in ("telegram-bridge-relay-BRIDGE_KV","BRIDGE_KV","telegram-bridge")), ""))' || true)
if [ -z "$KV_ID" ]; then
  KV_ID=$($WR kv namespace create telegram-bridge 2>&1 | grep -oE '[0-9a-f]{32}' | head -1)
fi
[ -n "$KV_ID" ] || die "no se pudo crear el namespace KV"
sed -i "s/REEMPLAZAR_CON_ID_DE_KV/$KV_ID/" wrangler.toml

echo "Desplegando Worker…" >&2
DEPLOY_OUT=$($WR deploy 2>&1) || { echo "$DEPLOY_OUT" >&2; die "wrangler deploy falló"; }
URL=$(printf '%s' "$DEPLOY_OUT" | grep -oE 'https://[a-z0-9.-]+\.workers\.dev' | head -1)
[ -n "$URL" ] || die "no encontré la URL workers.dev en la salida del despliegue"

echo "Cargando secretos en Cloudflare (no se imprimen)…" >&2
for S in TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID TELEGRAM_WEBHOOK_SECRET CURSOR_API_KEY; do
  printf '%s' "${!S}" | $WR secret put "$S" >/dev/null
done

bash "$SCRIPT_DIR/setup-webhook.sh" "$URL" >&2
curl -sf "$URL/healthz" >/dev/null || echo "Aviso: /healthz aún no responde (puede tardar unos segundos)." >&2
printf '{"ok":true,"relay_url":"%s","kv_id":"%s"}\n' "$URL" "$KV_ID"
echo "Guarda TELEGRAM_RELAY_URL=$URL como secreto de usuario en Cursor (no es sensible, pero así lo ven todos los agentes)." >&2
