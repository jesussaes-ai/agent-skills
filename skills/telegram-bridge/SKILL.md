---
name: telegram-bridge
description: Avisa a Jesús por Telegram (texto y nota de voz) y pide aprobaciones con botones desde el celular; recibe sus respuestas escritas o por voz de vuelta en el agente. Úsala al terminar una tarea, al bloquearte esperando autorización, o ante "avísame por Telegram", "pídeme aprobación", "mándame una nota de voz".
---

# Telegram Bridge

Canal entre los agentes de Cursor (de cualquier proyecto) y el Telegram de Jesús.
Salida: avisos y solicitudes de aprobación con botones, opcionalmente con nota de voz.
Entrada: un relay (Cloudflare Worker gratis) recibe los botones, textos y notas de voz
de Jesús y los reenvía al agente como seguimiento (`POST /v1/agents/{id}/runs`).

## How It Works

1. El agente corre `notify.sh` o `request-approval.sh`. El mensaje lleva proyecto,
   id del agente (`bc-…`, tomado de `CURSOR_CONVERSATION_ID`), resumen y un pie
   `ref: XXXXXXXX · agente: bc-…` que el relay usa para saber a quién responder.
2. Jesús toca Aprobar / Rechazar / Responder, o responde (deslizar → Responder)
   con texto o nota de voz.
3. El relay valida `X-Telegram-Bot-Api-Secret-Token` y que el `chat_id` esté en la lista
   blanca, y crea un run de seguimiento en el agente con la decisión y el pedido original.
4. Si el agente sigue ocupado (`409 agent_busy`), la decisión se guarda: el agente la
   recoge con `wait-decision.sh`, o el relay la reintenta cada 5 min durante 24 h.
5. Notas de voz de Jesús: el relay no puede transcribir (CPU de 10 ms); te llega un
   seguimiento con el `file_id` y debes correr `transcribe-voice.sh` (whisper local).

## Usage

Si `/mnt/skills/user/telegram-bridge` no existe, usa la carpeta donde está este `SKILL.md`
(por ejemplo `~/.cursor/skills/telegram-bridge`).

```bash
# Aviso de tarea terminada, con voz
bash /mnt/skills/user/telegram-bridge/scripts/notify.sh --status done \
  --title "Reporte PDF listo" --summary "Generé el PDF de carta natal y abrí el PR." --voice

# Solicitud de aprobación (botones)
bash /mnt/skills/user/telegram-bridge/scripts/request-approval.sh \
  --summary "¿Fusiono el PR de estilos? No toca datos." --voice

# Acción destructiva o de producción: SIEMPRE --critical y una frase corta del pedido
bash /mnt/skills/user/telegram-bridge/scripts/request-approval.sh --critical \
  --summary "Borrar la tabla clientes_tmp en Supabase producción" --confirm-text "BORRAR clientes_tmp"

# Esperar la decisión dentro del mismo turno (máx. 15 min)
bash /mnt/skills/user/telegram-bridge/scripts/wait-decision.sh REF --timeout 900

# Nota de voz recibida: transcribir y mostrarle a Jesús lo entendido
bash /mnt/skills/user/telegram-bridge/scripts/transcribe-voice.sh --file-id ID --ref REF --reply-to MSG --echo
```

**Opciones de `notify.sh` / `request-approval.sh`:**
- `--summary` - qué pasó o qué quieres hacer y por qué (requerido; máx. 3.000 caracteres)
- `--title` - título corto
- `--status` - `done`, `info` (por defecto), `warn`, `error` (solo avisos)
- `--project` - nombre del proyecto (por defecto `TELEGRAM_PROJECT` o el nombre del repo)
- `--agent` - id del agente (por defecto `CURSOR_CONVERSATION_ID` si empieza con `bc-`)
- `--voice` / `--voice-text "frase"` - añade nota de voz (o `TELEGRAM_VOICE=1`)
- `--critical`, `--confirm-text "FRASE"` - exige que Jesús escriba la frase (por defecto `CONFIRMO REF`)

**Variables:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (salida); `TELEGRAM_RELAY_URL`,
`TELEGRAM_WEBHOOK_SECRET` (esperar decisiones). Voz: `TELEGRAM_TTS_ENGINE`
(`edge` por defecto con la voz `es-MX-JorgeNeural`, elegida por Jesús; `piper` solo local; `none`),
`TELEGRAM_TTS_VOICE`, `TELEGRAM_TTS_FALLBACK_VOICE` (Piper `es_MX-claude-high`; si edge falla o no
hay red se usa esta voz local; `none` desactiva el respaldo), `TELEGRAM_STT_MODEL` (`small`).
Con `edge`, el texto ya filtrado sale al servicio de voz de Microsoft: por eso nunca va nada sensible.

## Reglas para el agente

- Nunca pongas secretos, tokens, contraseñas, datos personales de clientes ni contenido
  de `.env` en `--summary`. La voz pasa además por un filtro que oculta URLs, correos,
  llaves, ids y números largos, pero el filtro no sustituye tu criterio.
- Borrar datos, force push, reset --hard, migraciones, despliegues o cualquier cosa en
  producción: `--critical` con una `--confirm-text` corta que describa la acción. El relay
  también las detecta por palabras clave y exige la frase aunque olvides el flag.
- Solo actúa sobre una acción crítica si el seguimiento dice
  `APROBADO con confirmación explícita`. Un mensaje libre o una nota de voz nunca es aprobación.
- Si una nota de voz responde a una aprobación, usa `transcribe-voice.sh … --confirm`: le
  pide a Jesús confirmar con botones que la transcripción es correcta antes de actuar.
- Dos formas de esperar: (a) termina tu turno diciendo que esperas la respuesta por
  Telegram (el seguimiento te despierta), o (b) `wait-decision.sh REF` si necesitas seguir
  en el mismo turno. Si `wait-decision.sh` agota el tiempo (código 2), termina el turno.
- Agentes locales (IDE) no reciben seguimientos por API: usa solo la forma (b).

## Output

```json
{"ok":true,"ref":"K7Q2M9XA","message_id":512,"kind":"aprobacion","agent":"bc-…","voice":true}
```

`wait-decision.sh` devuelve `{"status":"decided","decision":"approved|rejected|reply|voice","text":…,"voice":{"fileId":…}}`
o `{"status":"timeout"}` (código 2).

## Present Results to User

> Te avisé por Telegram (ref `K7Q2M9XA`, con nota de voz). Espero tu respuesta ahí o aquí.

## Troubleshooting

- `falta la variable …`: guarda el secreto en Cursor › Cloud Agents › Secrets (nivel usuario).
- `Telegram rechazó el mensaje: chat not found`: Jesús debe escribirle `/start` al bot.
- Sin voz: necesita `ffmpeg` y Python 3; `setup-voice.sh tts` instala edge-tts, Piper y la voz
  local de respaldo (~63 MB) y `setup-voice.sh stt` instala faster-whisper (`small` ~460 MB). Si falla, el texto igual llega.
- `401` en `wait-decision.sh`: `TELEGRAM_WEBHOOK_SECRET` distinto al del relay.
- Puesta en marcha, despliegue y límites: ver [GUIA.md](GUIA.md).

## Instalación

Claude Code: `cp -r skills/telegram-bridge ~/.claude/skills/` · claude.ai: añade `SKILL.md` al
proyecto y permite `api.telegram.org` en `claude.ai/settings/capabilities`.
