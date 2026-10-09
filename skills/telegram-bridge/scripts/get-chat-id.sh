#!/bin/bash
# Muestra el chat_id de quien le escribió al bot (Jesús debe mandarle /start antes).
# Solo funciona mientras el bot NO tenga webhook (getUpdates y webhook se excluyen).
# Uso: get-chat-id.sh
set -e
source "$(dirname "$0")/common.sh"
require_env TELEGRAM_BOT_TOKEN

RESP=$(tg_post getUpdates --data-urlencode 'allowed_updates=["message"]')
if ! tg_ok "$RESP"; then
  die "getUpdates falló (¿ya hay webhook? usa getWebhookInfo): $(printf '%s' "$RESP" | grep -o '"description":"[^"]*"')"
fi
IDS=$(printf '%s' "$RESP" | grep -o '"chat":{"id":-\?[0-9]*' | grep -o -- '-\?[0-9]*$' | sort -u)
[ -n "$IDS" ] || die "sin mensajes: escríbele /start a tu bot y vuelve a correr esto"
echo "chat_id encontrados (guarda el tuyo como TELEGRAM_CHAT_ID):" >&2
printf '{"chat_ids":[%s]}\n' "$(printf '%s' "$IDS" | paste -sd, -)"
