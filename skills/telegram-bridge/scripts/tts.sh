#!/bin/bash
# Convierte un texto corto en nota de voz OGG/Opus (formato de sendVoice).
# Uso: tts.sh "texto" salida.ogg
# Motor (TELEGRAM_TTS_ENGINE):
#   kokoro (por defecto) -> voz femenina local (Kokoro-82M, mezcla Dora/Sara/Heart); nada sale de la máquina.
#   piper                -> voz local Piper (TELEGRAM_TTS_VOICE, por defecto la de respaldo).
#   edge                 -> gratis, pero el texto (ya saneado) viaja a Microsoft; suele dar 403 desde VMs en la nube.
#   none                 -> no genera audio.
# Si kokoro o edge fallan, cae a Piper local (TELEGRAM_TTS_FALLBACK_VOICE, "none" lo desactiva).
set -e
source "$(dirname "$0")/common.sh"

TEXT="$1"
OUT="$2"
[ -n "$TEXT" ] && [ -n "$OUT" ] || die "uso: tts.sh \"texto\" salida.ogg"
ENGINE="${TELEGRAM_TTS_ENGINE:-kokoro}"
FALLBACK_VOICE="${TELEGRAM_TTS_FALLBACK_VOICE:-$DEFAULT_PIPER_VOICE}"
command -v ffmpeg >/dev/null || die "falta ffmpeg (sudo apt-get install -y ffmpeg)"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

TEXT=$(sanitize_for_voice "$TEXT")
TEXT=$(truncate_text "$TEXT" 600)

# Voz Piper: "modelo" o "modelo:id_de_hablante" (p. ej. es_ES-sharvard-medium:1 = voz femenina).
speak_piper() {
  local model="${1%%:*}" speaker=0
  [ "$model" = "$1" ] || speaker="${1#*:}"
  bash "$(dirname "$0")/setup-voice.sh" tts "$model" >&2
  printf '%s' "$TEXT" | python3 -m piper -m "$BRIDGE_CACHE/piper/$model.onnx" -s "$speaker" \
    --length-scale "${TELEGRAM_TTS_SPEED:-1.0}" --sentence-silence 0.25 -f "$TMP/voz.audio" 2>/dev/null
  [ -s "$TMP/voz.audio" ]
}

speak_kokoro() {
  bash "$(dirname "$0")/setup-voice.sh" kokoro >&2 || return 1
  printf '%s' "$TEXT" >"$TMP/texto.txt"
  python3 - "$1" "$TMP/voz.wav" "${TELEGRAM_KOKORO_SPEED:-1.0}" "$BRIDGE_CACHE/kokoro" "$TMP/texto.txt" <<'EOF' 2>/dev/null || return 1
import sys
import soundfile as sf
from kokoro_onnx import Kokoro
spec, out, speed, cache, text = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4], open(sys.argv[5]).read()
k = Kokoro(f"{cache}/kokoro-v1.0.onnx", f"{cache}/voices-v1.0.bin")
style = 0
for part in spec.split(","):
    name, _, weight = part.partition(":")
    style = style + k.get_voice_style(name.strip()) * float(weight or 1)
samples, rate = k.create(text, voice=style, speed=speed, lang="es")
sf.write(out, samples, rate)
EOF
  mv "$TMP/voz.wav" "$TMP/voz.audio" && [ -s "$TMP/voz.audio" ]
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

fallback() {
  rm -f "$TMP/voz.audio" "$TMP/voz.wav"
  [ "$FALLBACK_VOICE" != "none" ] || die "$1 falló y el respaldo local está desactivado"
  echo "Aviso: $1 falló; uso la voz local de respaldo Piper $FALLBACK_VOICE." >&2
  speak_piper "$FALLBACK_VOICE" || die "tampoco se pudo generar la voz de respaldo"
  USED="piper $FALLBACK_VOICE (respaldo)"
}

case "$ENGINE" in
  kokoro)
    VOICE="${TELEGRAM_TTS_VOICE:-$DEFAULT_KOKORO_VOICE}"
    if speak_kokoro "$VOICE"; then USED="kokoro $VOICE"; else fallback "Kokoro"; fi
    ;;
  piper)
    VOICE="${TELEGRAM_TTS_VOICE:-$FALLBACK_VOICE}"
    speak_piper "$VOICE" || die "Piper no generó audio con la voz $VOICE"
    USED="piper $VOICE"
    ;;
  edge)
    VOICE="${TELEGRAM_TTS_VOICE:-es-ES-ElviraNeural}"
    if speak_edge "$VOICE"; then USED="edge $VOICE"; else fallback "edge-tts (¿403 o sin red?)"; fi
    ;;
  none)
    exit 3
    ;;
  *) die "TELEGRAM_TTS_ENGINE desconocido: $ENGINE" ;;
esac

ffmpeg -nostdin -loglevel error -y -i "$TMP/voz.audio" -ac 1 -ar 48000 -c:a libopus -b:a 32k -application voip "$OUT"
echo "Voz usada: $USED" >&2
echo "$OUT"
