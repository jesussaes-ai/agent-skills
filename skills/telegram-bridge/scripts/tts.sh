#!/bin/bash
# Convierte un texto corto en nota de voz OGG/Opus (formato de sendVoice).
# Uso: tts.sh "texto" salida.ogg
# Motor (TELEGRAM_TTS_ENGINE):
#   piper (por defecto) -> local, ningún dato sale de la máquina.
#   edge                -> gratis, pero el texto viaja al servicio de voz de Microsoft.
#   none                -> no genera audio.
set -e
source "$(dirname "$0")/common.sh"

TEXT="$1"
OUT="$2"
[ -n "$TEXT" ] && [ -n "$OUT" ] || die "uso: tts.sh \"texto\" salida.ogg"
ENGINE="${TELEGRAM_TTS_ENGINE:-piper}"
command -v ffmpeg >/dev/null || die "falta ffmpeg (sudo apt-get install -y ffmpeg)"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

TEXT=$(sanitize_for_voice "$TEXT")
TEXT=$(truncate_text "$TEXT" 600)

case "$ENGINE" in
  piper)
    VOICE="${TELEGRAM_TTS_VOICE:-es_MX-ald-medium}"
    bash "$(dirname "$0")/setup-voice.sh" tts "$VOICE" >&2
    printf '%s' "$TEXT" | python3 -m piper -m "$BRIDGE_CACHE/piper/$VOICE.onnx" \
      --length-scale "${TELEGRAM_TTS_SPEED:-1.0}" --sentence-silence 0.25 -f "$TMP/voz.wav" 2>/dev/null
    ;;
  edge)
    VOICE="${TELEGRAM_TTS_VOICE:-es-MX-JorgeNeural}"
    echo "Aviso: edge-tts envía el texto (ya saneado) a Microsoft para sintetizarlo." >&2
    command -v edge-tts >/dev/null || python3 -m pip install --user -q edge-tts --break-system-packages >&2 2>/dev/null || python3 -m pip install --user -q edge-tts >&2
    python3 -m edge_tts --voice "$VOICE" --text "$TEXT" --write-media "$TMP/voz.wav"
    ;;
  none)
    exit 3
    ;;
  *) die "TELEGRAM_TTS_ENGINE desconocido: $ENGINE" ;;
esac

ffmpeg -nostdin -loglevel error -y -i "$TMP/voz.wav" -ac 1 -ar 48000 -c:a libopus -b:a 32k -application voip "$OUT"
echo "$OUT"
