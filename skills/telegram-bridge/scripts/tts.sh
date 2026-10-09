#!/bin/bash
# Convierte un texto corto en nota de voz OGG/Opus (formato de sendVoice).
# Uso: tts.sh "texto" salida.ogg
# Motor (TELEGRAM_TTS_ENGINE):
#   edge (por defecto) -> voz es-MX-JorgeNeural, gratis, pero el texto (ya saneado)
#                         viaja al servicio de voz de Microsoft. Si falla o no hay red,
#                         cae a Piper local (TELEGRAM_TTS_FALLBACK_VOICE, "none" lo desactiva).
#   piper              -> local, ningún dato sale de la máquina.
#   none               -> no genera audio.
set -e
source "$(dirname "$0")/common.sh"

TEXT="$1"
OUT="$2"
[ -n "$TEXT" ] && [ -n "$OUT" ] || die "uso: tts.sh \"texto\" salida.ogg"
ENGINE="${TELEGRAM_TTS_ENGINE:-edge}"
FALLBACK_VOICE="${TELEGRAM_TTS_FALLBACK_VOICE:-es_MX-claude-high}"
command -v ffmpeg >/dev/null || die "falta ffmpeg (sudo apt-get install -y ffmpeg)"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

TEXT=$(sanitize_for_voice "$TEXT")
TEXT=$(truncate_text "$TEXT" 600)

speak_piper() {
  bash "$(dirname "$0")/setup-voice.sh" tts "$1" >&2
  printf '%s' "$TEXT" | python3 -m piper -m "$BRIDGE_CACHE/piper/$1.onnx" \
    --length-scale "${TELEGRAM_TTS_SPEED:-1.0}" --sentence-silence 0.25 -f "$TMP/voz.audio" 2>/dev/null
  [ -s "$TMP/voz.audio" ]
}

speak_edge() {
  python3 -c "import edge_tts" 2>/dev/null \
    || python3 -m pip install --user -q edge-tts --break-system-packages >&2 2>/dev/null \
    || python3 -m pip install --user -q edge-tts >&2 2>/dev/null \
    || return 1
  echo "Aviso: edge-tts envía el texto (ya saneado) a Microsoft para sintetizarlo." >&2
  timeout "${TELEGRAM_TTS_EDGE_TIMEOUT:-25}" python3 -m edge_tts --voice "$1" --text "$TEXT" \
    --write-media "$TMP/voz.audio" >/dev/null 2>&1 && [ -s "$TMP/voz.audio" ]
}

case "$ENGINE" in
  piper)
    VOICE="${TELEGRAM_TTS_VOICE:-$FALLBACK_VOICE}"
    speak_piper "$VOICE" || die "Piper no generó audio con la voz $VOICE"
    USED="piper $VOICE"
    ;;
  edge)
    VOICE="${TELEGRAM_TTS_VOICE:-es-MX-JorgeNeural}"
    if speak_edge "$VOICE"; then
      USED="edge $VOICE"
    else
      rm -f "$TMP/voz.audio"
      [ "$FALLBACK_VOICE" != "none" ] || die "edge-tts falló y el respaldo local está desactivado"
      echo "Aviso: edge-tts falló (¿sin red?); uso la voz local Piper $FALLBACK_VOICE." >&2
      speak_piper "$FALLBACK_VOICE" || die "tampoco se pudo generar la voz local"
      USED="piper $FALLBACK_VOICE (respaldo)"
    fi
    ;;
  none)
    exit 3
    ;;
  *) die "TELEGRAM_TTS_ENGINE desconocido: $ENGINE" ;;
esac

ffmpeg -nostdin -loglevel error -y -i "$TMP/voz.audio" -ac 1 -ar 48000 -c:a libopus -b:a 32k -application voip "$OUT"
echo "Voz usada: $USED" >&2
echo "$OUT"
