#!/bin/bash
# Funciones compartidas. Se carga con: source "$(dirname "$0")/common.sh"

TG_API_BASE="${TELEGRAM_API_BASE:-https://api.telegram.org}"
BRIDGE_CACHE="${TELEGRAM_BRIDGE_CACHE:-$HOME/.cache/telegram-bridge}"

die() { echo "Error: $*" >&2; exit 1; }

require_env() {
  local v
  for v in "$@"; do
    [ -n "${!v}" ] || die "falta la variable $v (guárdala en Cursor › Cloud Agents › Secrets)"
  done
}

detect_agent_id() {
  if [ -n "$1" ]; then echo "$1"; return; fi
  if [ -n "$CURSOR_AGENT_ID" ]; then echo "$CURSOR_AGENT_ID"; return; fi
  case "$CURSOR_CONVERSATION_ID" in bc-*) echo "$CURSOR_CONVERSATION_ID"; return ;; esac
  echo "local"
}

detect_project() {
  if [ -n "$1" ]; then echo "$1"; return; fi
  if [ -n "$TELEGRAM_PROJECT" ]; then echo "$TELEGRAM_PROJECT"; return; fi
  local top
  top=$(git rev-parse --show-toplevel 2>/dev/null) && { basename "$top"; return; }
  basename "$PWD"
}

new_ref() {
  LC_ALL=C tr -dc 'A-Z0-9' </dev/urandom | head -c 8
}

html_escape() {
  shopt -u patsub_replacement 2>/dev/null || true
  local s="$1"
  s="${s//&/&amp;}"
  s="${s//</&lt;}"
  s="${s//>/&gt;}"
  printf '%s' "$s"
}

# Una línea de metadatos no debe romper el formato "clave: valor" que lee el relay.
one_line() {
  printf '%s' "$1" | tr '\r\n' '  ' | cut -c1-120
}

truncate_text() {
  local max="$2"
  if [ "${#1}" -gt "$max" ]; then printf '%s…' "${1:0:$max}"; else printf '%s' "$1"; fi
}

# Quita de un texto lo que nunca debe leerse en voz alta ni salir a un servicio de voz:
# URLs, correos, tokens/llaves, cadenas largas sin espacios, números largos y "clave=valor".
sanitize_for_voice() {
  printf '%s' "$1" | tr '\r\n\t' '   ' | sed -E \
    -e 's#https?://[^[:space:]]+#(enlace)#g' \
    -e 's#[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}#(correo)#g' \
    -e 's#\b(sk|pk|rk|ghp|gho|ghs|github_pat|xox[abpr]|crsr|key|token|AKIA)[-_][[:alnum:]_-]{6,}#(dato oculto)#gI' \
    -e 's#\b[[:upper:]_]{3,}=[^[:space:]]+#(dato oculto)#g' \
    -e 's#[[:alnum:]_/+=-]{24,}#(dato oculto)#g' \
    -e 's#\bbc-[[:alnum:]-]+#el agente#g' \
    -e 's#[0-9][0-9 -]{7,}[0-9]#(número oculto)#g' \
    -e 's#[`*_<>|{}\\]##g' \
    -e 's#  +# #g'
}

kind_icon() {
  case "$1" in
    done) echo "✅ Tarea terminada" ;;
    error) echo "❌ Error" ;;
    warn) echo "⚠️ Atención" ;;
    aprobacion) echo "🟡 Solicitud de aprobación" ;;
    aprobacion-critica) echo "🔴 APROBACIÓN CRÍTICA" ;;
    *) echo "🔔 Aviso" ;;
  esac
}

agent_link() {
  case "$1" in bc-*) echo "https://cursor.com/agents/$1" ;; esac
}

# Pie que el relay usa para saber a qué agente responder. Formato fijo; el relay toma la última aparición.
footer_lines() {
  local kind="$1" project="$2" agent="$3" ref="$4" phrase="$5"
  [ -n "$phrase" ] && echo "frase: $(one_line "$phrase")"
  echo "proyecto: $(one_line "$project")"
  echo "tipo: $kind"
  local link
  link=$(agent_link "$agent")
  [ -n "$link" ] && echo "🔗 $link"
  echo "ref: $ref · agente: $agent"
}

tg_post() {
  local method="$1"; shift
  curl -sS --max-time 60 -X POST "$TG_API_BASE/bot$TELEGRAM_BOT_TOKEN/$method" "$@"
}

json_field_number() {
  printf '%s' "$1" | grep -o "\"$2\":[0-9-]*" | head -1 | cut -d: -f2
}

tg_ok() {
  printf '%s' "$1" | grep -q '"ok":true'
}
