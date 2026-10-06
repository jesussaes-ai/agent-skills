# Proveedores de IA y voz del asistente

Estado: **funciona con Supabase local y con un servidor compatible con OpenAI simulado** (e2e). No hay llaves reales cargadas; sin proveedor activo, el asistente sigue en modo demo sin IA.

## Qué hay

| Pieza | Dónde |
|---|---|
| Tipos e interfaces intercambiables (`LlmProvider`, `TtsProvider`, `ConfigProveedor`, `RegistroUso`) | `src/modulos/proveedores/tipos.ts` |
| Plantillas y catálogo de modelos verificado el 6 oct 2026 | `src/modulos/proveedores/catalogo.ts` |
| Validación del formulario y reglas de datos reales | `src/modulos/proveedores/esquemas.ts` |
| Cliente `/chat/completions` y mapeo de errores | `src/modulos/proveedores/cliente-openai.ts` |
| Reintentos, espera exponencial, `Retry-After` y respaldo | `src/modulos/proveedores/resiliencia.ts` |
| Límites por minuto, día y gasto mensual; estimación de costo | `src/modulos/proveedores/limites.ts` |
| Detección de datos personales y texto de consentimiento | `src/modulos/proveedores/privacidad.ts` |
| Orquestación del asistente y prueba de conexión | `src/modulos/proveedores/servicio.ts` |
| Supabase (`ai_providers`, `ai_usage`) y respaldo por variables de entorno | `src/modulos/proveedores/repositorio.ts`, `config.ts` |
| Voz: clasificación de voces, Web Speech API y dictado | `src/modulos/proveedores/voz/` |
| Interfaz de administración `/admin/proveedores` | `src/app/admin/proveedores/`, `src/ui/proveedores/` |
| Controles de voz y dictado | `src/ui/voz/` |
| API del asistente | `src/app/api/asistente/` |

## Proveedores

Tres tipos, todos con la API de OpenAI (`POST {endpoint}/chat/completions`):

- **OpenRouter** (`https://openrouter.ai/api/v1`). Se puede exigir retención cero: la app envía `provider: { zdr: true, data_collection: "deny" }`.
- **FreeLLMAPI autoalojado** ([tashfeenahmed/freellmapi](https://github.com/tashfeenahmed/freellmapi)). Por defecto escucha en `http://localhost:3001/v1`, usa una llave unificada y el modelo `auto`. Reenvía a niveles gratuitos de terceros, así que siempre es «solo demo». En Vercel necesita una URL pública con HTTPS.
- **Compatible con OpenAI** (local o propio). Por ejemplo, Ollama en `:11434/v1` o LM Studio en `:1234/v1`. La llave es opcional. Si corre en el equipo, los datos no salen de él.

Cada proveedor guarda:

- Modelo elegido a mano y hasta 5 modelos de respaldo.
- Endpoint: https, o http solo hacia la máquina o la red local, sin credenciales ni parámetros en la URL.
- Nombre del secreto.
- A quién llegan los datos.
- Capacidades (JSON, herramientas, visión, audio).
- Política de datos (entrena, retiene, ZDR, fuente y fecha de verificación).
- Límites: por minuto, por día, gasto mensual en USD, tokens de salida, tiempo máximo y reintentos.
- Costo en USD por millón de tokens.
- Prioridad como respaldo y si está activo.

### Catálogo verificado (6 oct 2026)

Fuentes:

- [API de modelos](https://openrouter.ai/api/v1/models) y endpoints por modelo.
- [Provider Logging](https://openrouter.ai/docs/guides/privacy/provider-logging) (políticas por proveedor).
- [ZDR](https://openrouter.ai/docs/guides/features/zdr).
- [Limits](https://openrouter.ai/docs/api_reference/limits).

Lo que se encontró:

- **NVIDIA gratuitos** (`:free`): `nemotron-3-super-120b-a12b` (admite JSON; es el sugerido), `nemotron-3-ultra-550b-a55b`, `nemotron-3.5-lightning` y `nemotron-3-nano-omni-30b-a3b-reasoning` (degradado ese día). Los sirve NVIDIA, que según OpenRouter **puede entrenar y retiene** los prompts. Quedan como **solo demo**.
- **Qwen y DeepSeek: no había variante gratuita.** Hay dos de pago y bajo costo en el catálogo:
  - `qwen/qwen3.7-flash`: 0.03/0.13 USD por millón. Solo lo sirve Alibaba, que retiene los prompts, así que es solo demo.
  - `deepseek/deepseek-v4-flash`: hay varios endpoints de retención cero (DeepInfra, Venice, Azure…). Con ZDR puede marcarse apto para datos reales si la administración lo aprueba. Se estima conservadoramente en 0.21/1.41 USD por millón.
- `openrouter/free` (router aleatorio) está en el catálogo pero no se recomienda: no permite saber qué empresa recibe el texto.
- Límites gratuitos de OpenRouter: 20 solicitudes por minuto y 50 al día (1000 al día si la cuenta compró al menos 10 USD).

Los modelos gratuitos cambian a menudo. La administración puede escribir cualquier id de modelo; el catálogo solo sirve para rellenar el formulario.

## Garantías

- **Llaves solo en el servidor.** La tabla guarda el nombre del secreto, que debe cumplir `^LLM_KEY_[A-Z0-9_]{1,40}$` (lo validan el formulario y la base). Así un endpoint configurado desde la interfaz nunca puede recibir `SUPABASE_SERVICE_ROLE_KEY` ni otra variable. La llave viaja solo en la cabecera `Authorization`. La API pública del asistente no expone ni el endpoint ni el nombre del secreto.
- **Datos reales.** Un proveedor puede marcarse apto solo si:
  - no es gratuito ni FreeLLMAPI (la base de datos lo impide con una restricción);
  - su política dice que no entrena;
  - no retiene, o en OpenRouter se exige ZDR;
  - la administración confirma que revisó la política vigente.
- **Consentimiento.** Antes de preguntar, el asistente muestra quién recibe la pregunta, con qué modelos y con qué política. Sin aceptar, el botón está desactivado y el servidor rechaza la solicitud. Usar otros proveedores como respaldo requiere un consentimiento aparte.
- **Solo demo y datos personales.** Si la pregunta parece contener un correo, un teléfono, una fecha, una CURP, un RFC o una tarjeta, el servidor no la envía a un proveedor «solo demo».
- **Mínimo envío.** Solo viajan la pregunta y hasta 6 fragmentos del Centro de ayuda. Nunca expedientes ni perfiles.
- **Límites.**
  - Por minuto, por día y de gasto mensual por proveedor. Un tope de gasto de 0 bloquea cualquier modelo con costo.
  - 10 preguntas por minuto por cliente en `/api/asistente`.
  - Se rechazan solicitudes que vienen de otro origen.
- **429 y errores.**
  - Ante 429, 5xx, tiempo agotado o error de red se reintenta con espera creciente (0.5 s, 1 s, …) y se respeta `Retry-After` / `X-RateLimit-Reset`.
  - Si la espera pedida supera 8 s, se pasa al modelo de respaldo.
  - Con 401/402 se descarta ese proveedor.
  - Si nadie responde, el navegador muestra la búsqueda demo y explica por qué.
- **Consumo sin prompts.** `ai_usage` registra fecha, proveedor, modelo, resultado, intento, latencia, tokens, costo estimado y origen (asistente o prueba). No tiene columnas para la pregunta ni la respuesta, y una prueba pgTAP lo comprueba.
- **Administración.** Crear, editar y borrar proveedores requiere el permiso `admin_proveedores` con MFA (`aal2`); RLS lo aplica en la base y cada cambio queda auditado. «Probar conexión» envía un texto fijo, sin datos de nadie.

## Voz

- `TtsProvider` es intercambiable: hoy se usa `crearTtsWebSpeech()` (Web Speech API, gratuita). Un proveedor de bajo costo solo necesita implementar la misma interfaz.
- **Voces.** Se listan las es-MX y es-ES instaladas, primero las de México, luego las que por su nombre parecen masculinas (solo es una pista, porque el navegador no indica el género) y después las locales. Si ninguna coincide se avisa y se ofrecen otras variantes del español.
- **Controles.** Selector de voz, «Probar voz» con una frase fija, y «Leer respuesta», «Pausar»/«Reanudar» y «Detener». La respuesta escrita siempre queda visible. La voz elegida se guarda solo en `localStorage`.
- **Voces remotas** (`localService = false`). Se avisa y, para leer una respuesta, hay que aceptar que el texto vaya al servicio del fabricante.
- **Dictado opcional.** Hay un aviso previo y luego el permiso de micrófono del navegador. En Chrome el audio se procesa en servidores del fabricante, y el aviso lo dice.

## Configurar en producción (Vercel)

1. En Vercel, en Settings > Environment Variables, carga la llave con un nombre `LLM_KEY_…`, por ejemplo `LLM_KEY_OPENROUTER`.
2. En `/admin/proveedores`, elige la plantilla y el modelo y escribe ese nombre de secreto. Revisa los límites y guarda.
3. Pulsa «Probar conexión».
4. Sin Supabase, se puede definir un único proveedor de respaldo con `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, etc. (ver `.env.example`).

## Pruebas

- **Unitarias:** `src/modulos/proveedores/proveedores.test.ts` y `voz/voz.test.ts`.
- **pgTAP:** `supabase/tests/database/05_proveedores_llm.test.sql`.
- **e2e:** `e2e/proveedores.spec.ts`. Usa un servidor compatible con OpenAI simulado que responde 429 una vez, voces y dictado simulados, y una llave efímera `LLM_KEY_E2E` creada por `scripts/e2e.sh`.
