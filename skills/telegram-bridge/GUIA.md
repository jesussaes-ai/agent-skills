# Puente Telegram ↔ agentes de Cursor — guía para Jesús

## Qué se hizo y por qué (en sencillo)

- **Un bot de Telegram solo tuyo.** Los agentes te escriben ahí cuando terminan algo o
  necesitan tu permiso, para que no tengas que estar frente a la pantalla.
- **Botones Aprobar / Rechazar / Responder.** Decides con un toque desde el celular.
- **Las acciones peligrosas piden más.** Si un agente quiere borrar algo, publicar o tocar
  producción, un toque no basta: tienes que escribir una frase exacta. Así nadie aprueba
  algo grave por accidente.
- **Avisos con voz.** Además del texto te llega una nota de voz corta para escucharla rápido.
  La voz es «Jorge» (la que elegiste), del servicio gratuito de voz de Microsoft: el texto,
  ya filtrado, viaja a Microsoft para convertirse en audio. Si falla o no hay internet, el
  agente usa una voz local (Piper) que no manda nada a nadie.
- **Puedes contestar hablando.** Si respondes con una nota de voz, el agente la pasa a texto
  en su propia máquina (Whisper, gratuito) y te muestra lo que entendió. Si era para aprobar
  algo, te pide confirmar con un botón que entendió bien.
- **Un "cartero" en internet (relay).** Telegram necesita una dirección fija a la que mandar
  tus respuestas. Pusimos un pequeño programa gratuito en Cloudflare que recibe tu respuesta,
  revisa que de verdad venga de ti y se la entrega al agente correcto.
- **Las llaves no quedan en el código.** Las contraseñas del bot y de Cursor se guardan como
  "secretos" en Cursor y en Cloudflare, nunca en el repositorio ni en el chat.
- **Sirve para todos tus proyectos.** Cada mensaje dice de qué proyecto y de qué agente viene.

## Cómo funciona

```
Agente ──notify.sh / request-approval.sh──▶ Telegram (tu celular)
                                               │ tocas un botón, escribes o mandas voz
                                               ▼
                        Relay en Cloudflare (gratis): ¿secreto correcto? ¿eres tú?
                                               │ sí
                                               ▼
                 API de Cursor: POST /v1/agents/{id}/runs  ──▶  el agente sigue trabajando
```

## Lo mínimo que tienes que hacer (una sola vez)

1. **Crear el bot.** En Telegram abre **@BotFather**, envía `/newbot`, elige nombre y usuario
   (debe terminar en `bot`). Te dará un **token**: no lo pegues en ningún chat.
2. **Escribirle a tu bot.** Ábrelo y envíale `/start` (sin esto no puede escribirte).
3. **Tu número de chat (`TELEGRAM_CHAT_ID`).** Escríbele a **@userinfobot** y copia tu `Id`
   (es un número). Alternativa: con el token ya guardado, pide a un agente
   «corre `get-chat-id.sh` de telegram-bridge».
4. **Inventar el secreto del webhook (`TELEGRAM_WEBHOOK_SECRET`).** Una cadena de 32–64
   letras y números sin espacios ni símbolos (puedes usar el generador de contraseñas
   del celular desactivando símbolos).
5. **Llave de Cursor (`CURSOR_API_KEY`).** [cursor.com/dashboard](https://cursor.com/dashboard)
   → **API Keys** → nueva llave de usuario. Cópiala una sola vez.
6. **Cuenta gratis de Cloudflare.** Regístrate en [dash.cloudflare.com](https://dash.cloudflare.com).
   - **Account ID** (`CLOUDFLARE_ACCOUNT_ID`): aparece en *Workers & Pages* → panel derecho.
   - **Token** (`CLOUDFLARE_API_TOKEN`): *My Profile → API Tokens → Create Token* → plantilla
     **Edit Cloudflare Workers** → elige tu cuenta → *Create*.
7. **Guardar los secretos en Cursor**, a nivel **usuario** (así los ven todos tus proyectos):
   **Cursor › Cloud Agents › Secrets** (en [cursor.com/dashboard](https://cursor.com/dashboard)):
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `CURSOR_API_KEY`,
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
8. **Pedir el despliegue.** En un agente nuevo: «despliega el relay de telegram-bridge con
   `scripts/deploy-relay.sh`». Te devolverá una dirección `https://….workers.dev`.
   Guárdala como secreto de usuario `TELEGRAM_RELAY_URL`.
9. **Limpieza recomendada.** Tras desplegar, borra de Cursor `CURSOR_API_KEY`,
   `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`: ya quedaron dentro de Cloudflare y los
   agentes no los necesitan para avisarte. Vuelve a ponerlos solo si hay que redesplegar.

Para que los agentes de otros proyectos encuentren la skill, copia `skills/telegram-bridge`
en `~/.cursor/skills/` o en `.cursor/skills/` de cada repositorio (o pide al agente que lo haga).

## Uso diario desde el celular

| Llega | Qué haces | Qué recibe el agente |
| --- | --- | --- |
| 🔔/✅ Aviso (+ nota de voz) | Nada, o deslizar → Responder con texto o voz | Tu mensaje |
| 🟡 Solicitud | Aprobar / Rechazar / Responder | APROBADO, RECHAZADO o tu texto |
| 🔴 Aprobación crítica | Aprobar → responde escribiendo la frase exacta | APROBADO con confirmación explícita |
| Tu nota de voz | El agente te muestra «📝 Entendí: …» | La transcripción |

Un texto libre o una nota de voz **nunca** cuenta como aprobación de una acción crítica.

## Voz: qué opción usamos y qué datos salen

| Opción | Costo | ¿Sale tu texto a terceros? | Calidad | Uso |
| --- | --- | --- | --- | --- |
| **edge-tts `es-MX-JorgeNeural`** (por defecto, elegida por Jesús el 9 oct 2026) | 0 | **Sí**: el texto (ya filtrado), la voz elegida y la IP del agente van al servicio de voz de Microsoft Edge (no es una API oficial con contrato) | Muy natural | `TELEGRAM_TTS_ENGINE=edge` (o sin definir) |
| **Piper `es_MX-claude-high`** (respaldo automático) | 0 | No, todo local | Nítida, algo robótica | Se usa sola si edge falla o no hay red; `TELEGRAM_TTS_ENGINE=piper` para usarla siempre |
| edge-tts `es-MX-DaliaNeural` | 0 | **Sí**, igual que Jorge | Muy natural, voz femenina | `TELEGRAM_TTS_VOICE=es-MX-DaliaNeural` |
| Piper `es_MX-ald-medium` (la anterior) | 0 | No | Clara, robótica; tropieza con nombres propios | `TELEGRAM_TTS_ENGINE=piper TELEGRAM_TTS_VOICE=es_MX-ald-medium` |
| Transcripción: faster-whisper `small` | 0 | No: el audio solo se baja de Telegram al agente | Buena en español | `TELEGRAM_STT_MODEL=small` (o `base`, más rápido) |

Antes de hablar, el texto pasa por un filtro que oculta enlaces, correos, llaves, ids y
números largos; y el resumen hablado se corta a ~600 caracteres.
Muestra: `media/telegram/aviso-muestra.ogg` (13 s, 52 KB, OGG/Opus, voz Piper).

## Límites reales

- **La API de Cursor no entrega mensajes a un agente que está trabajando.** Solo admite un
  run activo por agente; si le escribes mientras trabaja responde `409 agent_busy`. Por eso el
  relay guarda tu respuesta: el agente la lee si te está esperando (`wait-decision.sh`) o el
  relay la reintenta cada 5 minutos durante 24 h.
- **Solo agentes en la nube** reciben respuestas por la API. Los agentes del editor en tu PC
  pueden avisarte y leer tu decisión con `wait-decision.sh`, pero no "despertar".
- La API v1 de agentes está en **beta pública**; puede cambiar. Sus webhooks aún no existen.
- El id del agente se toma de `CURSOR_CONVERSATION_ID` (observado en los agentes en la nube,
  no documentado); si falta, el agente debe pasar `--agent bc-…`.
- **El relay gratuito no puede transcribir voz** (10 ms de CPU por petición). La
  transcripción corre en la máquina del agente: la primera vez descarga ~460 MB y tarda unos
  minutos; luego ~5–10 s por nota. Para evitar la descarga en cada agente nuevo, añade
  `bash …/scripts/setup-voice.sh tts && bash …/scripts/setup-voice.sh stt` a la instalación
  del entorno.
- Cloudflare gratis: 100 000 peticiones/día y 1 000 escrituras KV/día (≈ 300 decisiones
  diarias); de sobra para uso personal.
- Telegram guarda los mensajes en sus servidores (los bots no usan chats secretos):
  por eso los agentes no deben poner datos sensibles en los avisos.
- Pruebas hechas con Telegram y Cursor simulados; falta la prueba con tu bot real.

## Seguridad

- El relay rechaza (401) todo lo que no traiga el `secret_token` del webhook, e ignora en
  silencio cualquier chat que no sea el tuyo (`TELEGRAM_CHAT_ID`, admite varios separados por coma).
- Botones y respuestas solo valen sobre mensajes del propio bot; el agente destino sale del
  pie del mensaje, y ante metadatos repetidos manda el último y "crítica" siempre gana.
- Los registros solo guardan tipo de evento, referencia y código HTTP: nunca textos ni llaves.

## Fuentes

- Cursor Cloud Agents API (crear run de seguimiento, `409 agent_busy`, autenticación):
  [cursor.com/docs/cloud-agent/api/endpoints](https://cursor.com/docs/cloud-agent/api/endpoints),
  [cursor.com/docs/api](https://cursor.com/docs/api)
- Telegram Bot API (`setWebhook` + `secret_token`, `callback_data` 1–64 bytes,
  `answerCallbackQuery`, `ForceReply`, `sendVoice` OGG/Opus, `getFile` hasta 20 MB):
  [core.telegram.org/bots/api](https://core.telegram.org/bots/api)
- Cloudflare: [límites de Workers](https://developers.cloudflare.com/workers/platform/limits/),
  [límites de KV](https://developers.cloudflare.com/kv/platform/limits/)
- Voz: [Piper voices](https://huggingface.co/rhasspy/piper-voices),
  [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [edge-tts](https://github.com/rany2/edge-tts)
