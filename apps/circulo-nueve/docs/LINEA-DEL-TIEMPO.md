# Línea del tiempo — Círculo Nueve

Registro cronológico de hitos y decisiones (hora UTC, más reciente al final). Se actualiza en cada avance.

## 6 oct 2026
- **03:56** — Se abre el proyecto Circulo Nueve.
- **04:00** — Jesús entrega la especificación completa (prompt maestro).
- **04:06** — Etapa 0 terminada: propuesta de arquitectura (Next.js + TypeScript + Supabase, worker Python de ingesta, 6 preguntas bloqueantes).
- **04:17** — Decisiones de Jesús: uso personal y gratuito, Vercel Hobby, región México, Supabase gratis, IA gratuita (NVIDIA/Qwen/DeepSeek vía OpenRouter o FreeLLMAPI), él carga la clave de admin, tradiciones según sus libros.
- **04:20** — Bloqueo: la integración de Cursor no puede crear repos en `jesussaes-ai`.
- **04:21** — Nuevos requisitos: línea del tiempo y README, ayuda en la app sección por sección, asistente que explique la app y ventanas explicativas en todos los botones.
- **04:25** — Cambio de plan: la app vive en `jesussaes-ai/agent-skills` bajo `apps/circulo-nueve/`, autocontenida para extraerla después con `git subtree split`.
- **04:40** — Etapa 1 construida en la rama `cursor/circulo-nueve-etapa-1`:
  - Scaffold Next.js 16 + TypeScript + Tailwind 4 con módulos separados (ui, cálculo, fuentes, conversación, proveedores) y `.env.example` sin secretos.
  - Motor de numerología pitagórica configurable con pasos visibles, reglas documentadas (`docs/numerologia-reglas.md`), 8 casos de referencia y pruebas de propiedades.
  - Demo responsive con datos ficticios: bienvenida, consentimiento granular, perfil, panel de resultados (carta natal y cábala como pendientes).
  - Centro de ayuda `/ayuda` con contenido en `src/content/ayuda/secciones.json` y botón «?» en cada sección.
  - Componente común `Explicacion` (tooltip accesible) usado por `Boton` y `EnlaceBoton`; una prueba impide botones o enlaces sin descripción.
  - Asistente de la app en modo demo (búsqueda en la ayuda con citas) y capa LLM preparada con validación de citas, separada de la biblioteca RAG.
  - Verificado: `npm test` (54 pruebas) y `npm run build` pasan.
- **04:40** — PR draft #1 en `agent-skills`. El repo `jesussaes-ai/circulo-nueve` sigue sin ser accesible para la integración: la extracción queda pendiente.
- **04:41** — Jesús entrega el logotipo horizontal y confirma el emblema circular sin letras como icono oficial.
- **04:48** — Marca integrada:
  - Logotipo en la cabecera.
  - Emblema como favicon, icon, apple-touch-icon, manifest PWA e icono de navegación.
  - Paleta azul marino y dorado con contraste accesible.
  - Capturas verificadas en escritorio y móvil.
- **04:50** — Etapa 2 (base de datos, sin cuentas externas):
  - 5 migraciones Supabase: tablas, RLS que deniega por defecto, buckets privados, pgvector con HNSW, búsqueda híbrida, auditoría de solo inserción y alta única del administrador.
  - Probado con Supabase CLI en Docker local: 49 pruebas pgTAP de estructura, aislamiento entre expedientes y auditoría pasan.

## Pendiente
- Repo propio `jesussaes-ai/circulo-nueve` (extraer con `git subtree split`).
- Proyecto Supabase remoto (requiere la cuenta del propietario) y conexión de la app: Auth por invitación, `/setup`, MFA; aviso de privacidad del responsable.
- Carta natal (motor de efemérides y zona horaria histórica), cábala (tradición y tabla), biblioteca RAG, voz, PDF.
- Proveedor LLM real para el asistente.
