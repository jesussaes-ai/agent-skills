#!/bin/bash
# Descarga una nota de voz de Telegram y la transcribe localmente (faster-whisper, gratis).
# El audio no sale a ningún servicio de transcripción; solo se baja de Telegram.
# Uso: transcribe-voice.sh --file-id ID [--ref REF] [--reply-to MSG_ID] [--echo] [--confirm]
#      transcribe-voice.sh --file audio.ogg            (archivo local, para pruebas)
#   --echo     muestra a Jesús en Telegram lo que se entendió.
#   --confirm  además le pide confirmar con botones que la transcripción es correcta
#              (úsalo siempre que la nota responda a una aprobación).
# Salida: JSON {"text": "...", "ref": ..., "confirm": {ref nueva}}
set -e
source "$(dirname "$0")/common.sh"

FILE_ID="" FILE="" REF="" REPLY_TO="" ECHO=0 CONFIRM=0
MODEL="${TELEGRAM_STT_MODEL:-small}"
while [ $# -gt 0 ]; do
  case "$1" in
    --file-id) FILE_ID="$2"; shift 2 ;;
    --file) FILE="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --reply-to) REPLY_TO="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --echo) ECHO=1; shift ;;
    --confirm) CONFIRM=1; ECHO=1; shift ;;
    *) die "opción desconocida: $1" ;;
  esac
done
[ -n "$FILE_ID" ] || [ -n "$FILE" ] || die "falta --file-id o --file"
command -v ffmpeg >/dev/null || die "falta ffmpeg (sudo apt-get install -y ffmpeg)"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

if [ -n "$FILE_ID" ]; then
  require_env TELEGRAM_BOT_TOKEN
  RESP=$(tg_post getFile --data-urlencode "file_id=$FILE_ID")
  tg_ok "$RESP" || die "Telegram no entregó el archivo (getFile)"
  FPATH=$(printf '%s' "$RESP" | grep -o '"file_path":"[^"]*"' | cut -d'"' -f4)
  [ -n "$FPATH" ] || die "getFile sin file_path"
  curl -sSf --max-time 60 "$TG_API_BASE/file/bot$TELEGRAM_BOT_TOKEN/$FPATH" -o "$TMP/voz.oga" \
    || die "no se pudo descargar la nota de voz"
  FILE="$TMP/voz.oga"
fi

bash "$(dirname "$0")/setup-voice.sh" stt "$MODEL" >&2
echo "Transcribiendo localmente (modelo $MODEL)…" >&2
TEXT=$(python3 - "$FILE" "$MODEL" <<'EOF'
import subprocess, sys
import numpy as np
from faster_whisper import WhisperModel
raw = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", sys.argv[1],
                      "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
model = WhisperModel(sys.argv[2], device="cpu", compute_type="int8")
segments, _ = model.transcribe(audio, language="es", beam_size=5, vad_filter=True)
print(" ".join(s.text.strip() for s in segments).strip())
EOF
)
[ -n "$TEXT" ] || TEXT="(no se entendió nada en la nota de voz)"

CONFIRM_JSON=null
if [ "$ECHO" = "1" ] && [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
  if [ "$CONFIRM" = "1" ]; then
    OUT=$(bash "$(dirname "$0")/request-approval.sh" --no-voice \
      --title "¿Entendí bien tu nota de voz?${REF:+ (ref $REF)}" \
      --summary "📝 «$TEXT»
Aprobar = sí, eso dije y actúa en consecuencia. Rechazar = no lo uses. Responder = corrígelo por escrito.")
    CONFIRM_JSON="$OUT"
  else
    tg_post sendMessage --data-urlencode "chat_id=${TELEGRAM_CHAT_ID%%,*}" \
      --data-urlencode "text=📝 Entendí tu nota de voz${REF:+ (ref $REF)}: «$TEXT»" \
      ${REPLY_TO:+--data-urlencode "reply_to_message_id=$REPLY_TO"} >/dev/null || true
  fi
fi

python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1], "ref": sys.argv[2] or None, "confirm": json.loads(sys.argv[3])}, ensure_ascii=False))' \
  "$TEXT" "$REF" "$CONFIRM_JSON"
