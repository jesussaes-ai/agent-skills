#!/bin/bash
# Registra el webhook del bot en el relay con secret_token.
# Uso: setup-webhook.sh https://telegram-bridge-relay.TU-SUBDOMINIO.workers.dev
set -e
source "$(dirname "$0")/common.sh"

RELAY="${1:-$TELEGRAM_RELAY_URL}"
[ -n "$RELAY" ] || die "uso: setup-webhook.sh URL_DEL_RELAY"
require_env TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET
[[ "$TELEGRAM_WEBHOOK_SECRET" =~ ^[A-Za-z0-9_-]{16,256}$ ]] \
  || die "TELEGRAM_WEBHOOK_SECRET debe tener 16-256 caracteres A-Z a-z 0-9 _ -"

echo "Registrando webhook en ${RELAY%/}/telegram/webhook…" >&2
RESP=$(tg_post setWebhook \
  --data-urlencode "url=${RELAY%/}/telegram/webhook" \
  --data-urlencode "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  --data-urlencode 'allowed_updates=["message","callback_query"]' \
  --data-urlencode "drop_pending_updates=true")
tg_ok "$RESP" || die "setWebhook falló: $RESP"

INFO=$(tg_post getWebhookInfo)
printf '%s\n' "$INFO" | sed -E 's#"url":"[^"]*"#"url":"(registrada)"#'
