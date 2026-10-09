#!/bin/bash
# Instala (una sola vez, gratis) lo necesario para la voz.
# Uso: setup-voice.sh tts [voz-piper]   -> edge-tts + piper-tts y voz local de respaldo (~63 MB)
#      setup-voice.sh stt [modelo]      -> faster-whisper + modelo (small ~460 MB)
set -e
source "$(dirname "$0")/common.sh"

MODE="${1:-tts}"
mkdir -p "$BRIDGE_CACHE/piper"

pip_install() {
  python3 -m pip install --user -q "$@" --break-system-packages 2>/dev/null || python3 -m pip install --user -q "$@"
}

case "$MODE" in
  tts)
    VOICE="${2:-${TELEGRAM_TTS_FALLBACK_VOICE:-es_MX-claude-high}}"
    [ -n "$2" ] || python3 -c "import edge_tts" 2>/dev/null || { echo "Instalando edge-tts…" >&2; pip_install edge-tts || true; }
    python3 -c "import piper" 2>/dev/null || { echo "Instalando piper-tts…" >&2; pip_install piper-tts; }
    if [ ! -s "$BRIDGE_CACHE/piper/$VOICE.onnx" ]; then
      LANG_CODE="${VOICE%%-*}"
      REST="${VOICE#*-}"
      NAME="${REST%%-*}"
      QUALITY="${REST#*-}"
      URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/${LANG_CODE%%_*}/$LANG_CODE/$NAME/$QUALITY/$VOICE"
      echo "Descargando voz $VOICE…" >&2
      curl -sfL "$URL.onnx" -o "$BRIDGE_CACHE/piper/$VOICE.onnx.part"
      curl -sfL "$URL.onnx.json" -o "$BRIDGE_CACHE/piper/$VOICE.onnx.json"
      mv "$BRIDGE_CACHE/piper/$VOICE.onnx.part" "$BRIDGE_CACHE/piper/$VOICE.onnx"
    fi
    echo "Voz lista: $VOICE" >&2
    ;;
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
  *) die "uso: setup-voice.sh tts|stt" ;;
esac
