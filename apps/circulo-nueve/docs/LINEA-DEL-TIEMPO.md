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
- **05:20** — Etapa 3 (cuentas, con Supabase local):
  - Alta inicial `/setup`: clave con hash argon2id validada solo en el servidor, un solo uso (410 después) y rotación del hash.
  - Entrar, recuperar la contraseña por enlace de un solo uso, MFA TOTP obligatoria para administrar (también exigida en la base de datos con `aal2`).
  - Invitaciones por correo y panel de usuarios, roles y permisos con suspender, revocar y reactivar.
  - Ayuda y tooltips en todo lo nuevo.
  - CI en la raíz filtrado a la carpeta, con copia dentro de la app para el repo propio.
  - Verificado: 70 pruebas unitarias, 53 pgTAP, 11 e2e con Playwright y Auth local, y `npm run build`.
- **05:30** — Se integra el PR #2 (módulo de reportes PDF en `src/reportes`).
- **05:55** — Etapa 4 (expedientes, con Supabase local):
  - Expedientes con perfil separado y consentimientos granulares, exigidos por la base de datos.
  - Lecturas de numerología guardadas con historial; modo efímero «Calcular sin guardar».
  - Exportar en JSON y borrado total.
  - Permisos por expediente y por archivo.
  - PDF generado en servidor, guardado en privado y descargado con URL firmada de 60 s, con auditoría.
  - Retención configurable con purga; ajustes y aviso de privacidad editables por la administración.
  - Recuperación de emergencia de la administración documentada y probada.
  - Corregido: los recursos del PDF no cargaban dentro de Next (Turbopack).
  - Verificado: 80 pruebas unitarias, 74 pgTAP, 19 e2e y el build.

- **06:15** — Carta natal (rama `cursor/carta-natal-ccf5`, PR draft #3 contra la etapa 1):
  - Motor determinista con `astronomy-engine` (MIT); Swiss Ephemeris (AGPL) solo como herramienta para generar casos de referencia.
  - Zona horaria histórica IANA con detección de horas repetidas e inexistentes; lugares de GeoNames (CC BY 4.0) buscados en el navegador.
  - Hora exacta, aproximada o desconocida (sin casas ni Ascendente); precisión mostrada según los márgenes de hora y lugar.
  - Tropical o sideral (4 ayanamsas), 7 sistemas de casas con respaldo polar, aspectos y orbes configurables.
  - Verificado: 13 cartas y 8 casos de zona horaria contra Swiss Ephemeris 2.10.03 y Python `zoneinfo` (diferencia máxima: 18″), 171 pruebas unitarias y `npm run build`.
- **06:55** — Carta natal en el expediente y en PDF (mismo PR #3, con la etapa 1 fusionada antes):
  - «Guardar carta natal»: con consentimiento del historial y permiso de modificar; recalculada en el servidor con el perfil de la base y el lugar GeoNames resuelto en el servidor; guarda motor, reglas, efemérides, tzdb, ajustes y huella SHA-256.
  - Historial con resumen y carta completa desplegable; «Generar PDF» usa el nuevo adaptador `reporteDeCartaNatal` (rueda vectorial, tablas de posiciones, casas y aspectos, límites).
  - Muestra ficticia `muestra-carta-natal.pdf` con portada.
  - Verificado: 189 pruebas unitarias, build y 23 e2e con Supabase local (4 nuevos de carta natal).
- **06:40** — Proveedores de IA y voz del asistente ([detalle](proveedores-ia-y-voz.md)):
  - Proveedores intercambiables configurables en `/admin/proveedores`: OpenRouter, FreeLLMAPI autoalojado y endpoint compatible con OpenAI o local.
  - Llaves solo como secretos `LLM_KEY_*` del servidor.
  - Límites por minuto, día y gasto; reintentos ante 429 con `Retry-After` y respaldo.
  - Consumo registrado sin prompts; consentimiento visible antes de enviar.
  - Catálogo verificado en OpenRouter el 6 oct 2026:
    - Hay modelos NVIDIA gratuitos, pero NVIDIA puede entrenar con los textos: solo demo.
    - No hay variantes gratuitas de Qwen ni DeepSeek.
    - DeepSeek V4 Flash de pago con retención cero es la opción posible para datos reales, si se aprueba.
  - Voz con Web Speech API: voces es-MX y es-ES, prueba, reproducir, pausar y detener, aviso de voz remota y dictado con permiso explícito.
  - Verificado: 137 pruebas unitarias, 88 pgTAP, 23 e2e y el build.

## Pendiente
- Repo propio `jesussaes-ai/circulo-nueve` (extraer con `git subtree split`).
- Proyecto Supabase remoto (requiere la cuenta del propietario) y tarea programada para `retencion:purgar`.
- Texto del aviso de privacidad (lo redacta el responsable en `/admin/ajustes`).
- Cábala (tradición y tabla) e interpretaciones con fuentes.
- Cargar una llave real (p. ej. `LLM_KEY_OPENROUTER`) y decidir si se aprueba un modelo de pago con retención cero para datos reales.
