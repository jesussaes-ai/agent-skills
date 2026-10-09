#!/bin/bash
# Espera (dentro del mismo turno) la decisión de Jesús consultando el relay.
# Uso: wait-decision.sh REF [--timeout 900] [--interval 15]
# Requiere TELEGRAM_RELAY_URL y TELEGRAM_WEBHOOK_SECRET.
# Salida: JSON del relay. Código 0 = decidido, 2 = se agotó el tiempo.
set -e
source "$(dirname "$0")/common.sh"

REF="$1"; shift || true
TIMEOUT=900 INTERVAL=15
while [ $# -gt 0 ]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    *) die "opción desconocida: $1" ;;
  esac
done
[[ "$REF" =~ ^[A-Z0-9]{8}$ ]] || die "uso: wait-decision.sh REF (8 caracteres)"
require_env TELEGRAM_RELAY_URL TELEGRAM_WEBHOOK_SECRET

DEADLINE=$(( $(date +%s) + TIMEOUT ))
echo "Esperando la decisión de Jesús para $REF (máx. ${TIMEOUT}s)…" >&2
while :; do
  RESP=$(curl -sS --max-time 20 -H "Authorization: Bearer $TELEGRAM_WEBHOOK_SECRET" \
    "${TELEGRAM_RELAY_URL%/}/v1/decisions/$REF" || true)
  if printf '%s' "$RESP" | grep -q '"status":"decided"'; then
    printf '%s\n' "$RESP"
    exit 0
  fi
  if printf '%s' "$RESP" | grep -q '"error"'; then
    die "el relay respondió: $RESP"
  fi
  [ "$(date +%s)" -ge "$DEADLINE" ] && { printf '{"status":"timeout","ref":"%s"}\n' "$REF"; exit 2; }
  sleep "$INTERVAL"
done
