#!/bin/bash
# Envía a Telegram un aviso (o, con --approval, una solicitud con botones).
# Uso: notify.sh --summary "texto" [--title "t"] [--status done|info|warn|error]
#                [--project P] [--agent bc-…] [--voice] [--voice-text "frase corta"]
#                [--approval] [--critical] [--confirm-text "FRASE"]
# Salida (stdout): JSON con ref, message_id y si se envió voz.
set -e
source "$(dirname "$0")/common.sh"

TITLE="" SUMMARY="" STATUS="info" PROJECT="" AGENT="" VOICE=0 VOICE_TEXT=""
APPROVAL=0 CRITICAL=0 CONFIRM_TEXT=""
[ "${TELEGRAM_VOICE:-}" = "1" ] && VOICE=1

while [ $# -gt 0 ]; do
  case "$1" in
    --title) TITLE="$2"; shift 2 ;;
    --summary) SUMMARY="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --agent) AGENT="$2"; shift 2 ;;
    --voice) VOICE=1; shift ;;
    --no-voice) VOICE=0; shift ;;
    --voice-text) VOICE_TEXT="$2"; VOICE=1; shift 2 ;;
    --approval) APPROVAL=1; shift ;;
    --critical) CRITICAL=1; APPROVAL=1; shift ;;
    --confirm-text) CONFIRM_TEXT="$2"; shift 2 ;;
    -h|--help) sed -n '2,7p' "$0" >&2; exit 0 ;;
    *) die "opción desconocida: $1" ;;
  esac
done

[ -n "$SUMMARY" ] || [ -n "$TITLE" ] || die "falta --summary"
require_env TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID

AGENT=$(detect_agent_id "$AGENT")
PROJECT=$(detect_project "$PROJECT")
REF=$(new_ref)
CHAT_ID="${TELEGRAM_CHAT_ID%%,*}"

DESTRUCTIVE='(borra|elimin|delete|drop |truncate|destru|rm -rf|reset --hard|force[- ]push|push --force|--force|producci[oó]n|production|\bprod\b|migraci[oó]n|migration|deploy|despleg|despliegue|revoca)'
if [ "$APPROVAL" = "1" ] && printf '%s %s' "$TITLE" "$SUMMARY" | grep -qiE "$DESTRUCTIVE"; then
  CRITICAL=1
fi

if [ "$APPROVAL" = "1" ]; then
  if [ "$CRITICAL" = "1" ]; then KIND="aprobacion-critica"; else KIND="aprobacion"; fi
  HEADER=$(kind_icon "$KIND")
else
  KIND="aviso"
  HEADER=$(kind_icon "$STATUS")
fi

PHRASE=""
if [ "$KIND" = "aprobacion-critica" ]; then
  PHRASE="${CONFIRM_TEXT:-CONFIRMO $REF}"
fi

SUMMARY=$(truncate_text "$SUMMARY" 3000)
BODY="<b>$(html_escape "$HEADER")</b>"
[ -n "$TITLE" ] && BODY="$BODY
<b>$(html_escape "$(one_line "$TITLE")")</b>"
[ -n "$SUMMARY" ] && BODY="$BODY
$(html_escape "$SUMMARY")"
if [ "$KIND" = "aprobacion-critica" ]; then
  BODY="$BODY

Para aprobar tendrás que escribir la frase exacta."
fi
BODY="$BODY

$(html_escape "$(footer_lines "$KIND" "$PROJECT" "$AGENT" "$REF" "$PHRASE")")"

ARGS=(--data-urlencode "chat_id=$CHAT_ID" --data-urlencode "text=$BODY" --data-urlencode "parse_mode=HTML"
      --data-urlencode "link_preview_options={\"is_disabled\":true}")
if [ "$APPROVAL" = "1" ]; then
  ARGS+=(--data-urlencode "reply_markup={\"inline_keyboard\":[[{\"text\":\"✅ Aprobar\",\"callback_data\":\"ap:$REF\"},{\"text\":\"🚫 Rechazar\",\"callback_data\":\"rj:$REF\"}],[{\"text\":\"💬 Responder\",\"callback_data\":\"rp:$REF\"}]]}")
fi

echo "Enviando $KIND a Telegram (ref $REF)…" >&2
RESP=$(tg_post sendMessage "${ARGS[@]}") || die "no se pudo contactar a Telegram"
tg_ok "$RESP" || die "Telegram rechazó el mensaje: $(printf '%s' "$RESP" | grep -o '"description":"[^"]*"' | head -1)"
MSG_ID=$(json_field_number "$RESP" message_id)

VOICE_SENT=false
if [ "$VOICE" = "1" ]; then
  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT
  if [ -z "$VOICE_TEXT" ]; then
    LEAD="$HEADER"
    LEAD="${LEAD#* }"
    VOICE_TEXT="Proyecto $PROJECT. $LEAD. ${TITLE:+$TITLE. }$(truncate_text "$SUMMARY" 280)"
    [ "$APPROVAL" = "1" ] && VOICE_TEXT="$VOICE_TEXT. Responde con los botones del mensaje."
  fi
  if bash "$(dirname "$0")/tts.sh" "$VOICE_TEXT" "$TMP/aviso.ogg" >/dev/null; then
    CAPTION="🔊 $(one_line "$HEADER")
$(footer_lines "$KIND" "$PROJECT" "$AGENT" "$REF" "$PHRASE")"
    VRESP=$(tg_post sendVoice -F "chat_id=$CHAT_ID" -F "voice=@$TMP/aviso.ogg;type=audio/ogg" \
      -F "caption=$CAPTION" -F "reply_to_message_id=$MSG_ID") || true
    if tg_ok "$VRESP"; then VOICE_SENT=true; else echo "Aviso: la nota de voz no se pudo enviar; el texto sí llegó." >&2; fi
  else
    echo "Aviso: no se generó la voz; el texto sí llegó." >&2
  fi
fi

printf '{"ok":true,"ref":"%s","message_id":%s,"kind":"%s","agent":"%s","voice":%s}\n' \
  "$REF" "${MSG_ID:-null}" "$KIND" "$AGENT" "$VOICE_SENT"
