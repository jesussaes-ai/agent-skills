#!/bin/bash
# Instala (una sola vez, gratis) lo necesario para la voz.
# Uso: setup-voice.sh tts              -> voz principal Kokoro (~340 MB) + respaldo Piper (~76 MB)
#      setup-voice.sh tts VOZ-PIPER    -> solo piper-tts + esa voz (p. ej. es_ES-sharvard-medium)
#      setup-voice.sh kokoro           -> solo kokoro-onnx + modelo y voces
#      setup-voice.sh stt [modelo]     -> faster-whisper + modelo (small ~460 MB)
set -e
source "$(dirname "$0")/common.sh"

MODE="${1:-tts}"
KOKORO_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"

pip_install() {
  python3 -m pip install --user -q "$@" --break-system-packages 2>/dev/null || python3 -m pip install --user -q "$@"
}

download() {
  [ -s "$2" ] && return 0
  curl -sfL --retry 2 "$1" -o "$2.part" && mv "$2.part" "$2"
}

setup_piper() {
  local voice="${1%%:*}"
  mkdir -p "$BRIDGE_CACHE/piper"
  python3 -c "import piper" 2>/dev/null || { echo "Instalando piper-tts…" >&2; pip_install piper-tts; }
  if [ ! -s "$BRIDGE_CACHE/piper/$voice.onnx" ]; then
    local lang="${voice%%-*}" rest="${voice#*-}"
    local name="${rest%%-*}" quality="${rest#*-}"
    local url="https://huggingface.co/rhasspy/piper-voices/resolve/main/${lang%%_*}/$lang/$name/$quality/$voice"
    echo "Descargando voz $voice…" >&2
    download "$url.onnx.json" "$BRIDGE_CACHE/piper/$voice.onnx.json"
    download "$url.onnx" "$BRIDGE_CACHE/piper/$voice.onnx"
  fi
  echo "Voz lista: $voice" >&2
}

setup_kokoro() {
  mkdir -p "$BRIDGE_CACHE/kokoro"
  python3 -c "import kokoro_onnx, soundfile" 2>/dev/null || { echo "Instalando kokoro-onnx…" >&2; pip_install kokoro-onnx soundfile; }
  if [ ! -s "$BRIDGE_CACHE/kokoro/kokoro-v1.0.onnx" ]; then
    echo "Descargando Kokoro (~340 MB, solo la primera vez)…" >&2
  fi
  download "$KOKORO_URL/voices-v1.0.bin" "$BRIDGE_CACHE/kokoro/voices-v1.0.bin"
  download "$KOKORO_URL/kokoro-v1.0.onnx" "$BRIDGE_CACHE/kokoro/kokoro-v1.0.onnx"
  echo "Voz lista: Kokoro" >&2
}

case "$MODE" in
  tts)
    if [ -n "$2" ]; then
      setup_piper "$2"
    else
      setup_kokoro || echo "Aviso: no se pudo instalar Kokoro; se usará la voz de respaldo." >&2
      setup_piper "${TELEGRAM_TTS_FALLBACK_VOICE:-$DEFAULT_PIPER_VOICE}"
    fi
    ;;
  kokoro) setup_kokoro ;;
  stt)
    MODEL="${2:-${TELEGRAM_STT_MODEL:-small}}"
    python3 -c "import faster_whisper" 2>/dev/null || { echo "Instalando faster-whisper…" >&2; pip_install faster-whisper; }
    python3 - "$MODEL" <<'EOF' >&2
import sys
from faster_whisper import WhisperModel
WhisperModel(sys.argv[1], device="cpu", compute_type="int8")
print(f"Modelo de transcripción listo: {sys.argv[1]}")
EOF
    ;;
  *) die "uso: setup-voice.sh tts|kokoro|stt" ;;
esac
