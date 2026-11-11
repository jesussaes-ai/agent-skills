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
- **07:30** — Biblioteca RAG (etapa 5) e integración de los PR #3 (carta natal) y #4 (proveedores de IA y voz):
  - Administración de fuentes aportadas y complementarias, con metadatos, derechos, niveles de acceso, estados y retiro.
  - Centro de carga con detección del formato real y rechazo de macros y contenido activo: PDF, EPUB, DOCX, TXT/MD e imágenes con OCR.
  - Páginas web → Markdown con robots.txt, protección SSRF y versiones con diferencias.
  - Worker de ingesta en Node con cola atómica.
  - Fragmentos con página, capítulo o sección, y embeddings locales multilingual-e5-small.
  - Búsqueda híbrida con permisos y umbral de similitud.
  - Bot con citas validadas, proporción 80/20 por afirmación, autorización para fuentes complementarias y defensa contra prompt injection.
  - El bot usa la capa de proveedores del PR #4 (consentimiento, límites, 429, consumo con origen «biblioteca»).
  - Verificado: 282 pruebas unitarias, 100 pgTAP y e2e con Supabase local.
- **08:00** — Biblioteca multimedia y guía de despliegue:
  - Figuras de PDF con leyenda, OCR y descripción automática etiquetada (visión solo con proveedor configurado); corrección por la administración y «Ver figura» en el bot.
  - XLSX, ODS y CSV con hoja y celdas; PPTX por diapositiva; audio y video con Whisper local y marcas de tiempo.
  - Carga directa a Storage con URL firmada (hasta 50 MB); ClamAV opcional u obligatorio; el formulario se conserva tras un error.
  - Invitaciones y recuperación con enlace de un solo uso, sin SMTP (el 7 oct las invitaciones se sustituyen por cuentas creadas por la administración).
  - `docs/despliegue.md`: Supabase Free `us-east-1`, Vercel Hobby `iad1`, worker y ping en GitHub Actions, respaldos cifrados y restauración.

## 7 oct 2026
- **15:45** — Cuentas v2, por corrección de Jesús ([detalle](cuentas-y-acceso.md)):
  - `/setup` simple: la administración elige **usuario y contraseña**. La clave de alta sigue solo en el servidor y de un solo uso.
  - Se entra con **usuario y contraseña**, sin correo. Cada cuenta usa por dentro un correo no entregable (`@usuarios.circulo-nueve.invalid`) que no aparece en la interfaz. No hace falta SMTP.
  - Verificación en dos pasos **opcional y recomendada**, activable y desactivable desde «Mi cuenta». Si una cuenta la activa, la base la exige siempre (sin `aal2` no hay permisos).
  - La administración crea cada cuenta (asistente o cliente) con usuario y contraseña inicial (escrita o generada, mostrada una vez), con opción de **cambio obligatorio** en el primer acceso (la base no concede acceso hasta que el hash de la contraseña cambie). También restablece contraseñas, suspende, revoca y reactiva; el enlace de un solo uso queda como alternativa.
  - **Asistentes:** sin permisos por rol; solo los paquetes que marque la administración (sus propios expedientes, compartirlos, ver todos en lectura, biblioteca). Sus expedientes quedan separados.
  - **Clientes:** solo su expediente vinculado, en lectura (perfil, lecturas y PDF); no generan PDF ni consultan la biblioteca.
  - Migración `20261007000100_cuentas_por_usuario.sql`, pgTAP nuevo `08_cuentas_usuario`, e2e de cuentas reescrito, ayuda y documentación actualizadas. Recuperación de emergencia ahora por `--usuario`, con contraseña provisional.
- **00:40 (9 oct)** — Interfaz v2, tras probar Jesús la demo:
  - Botón «ojo» para mostrar u ocultar la contraseña en el alta, al entrar, al cambiarla y al crear o restablecer cuentas. Es accesible: `aria-pressed`, etiqueta «Mostrar/Ocultar contraseña» y ventana explicativa.
  - Lenguaje inclusivo: «Te damos la bienvenida», «la persona responsable», «Equipo: asistentes y administración», «Autoría».
  - Interfaz más cálida: tarjetas translúcidas (cristal esmerilado sutil) y motivos SVG propios en azul marino y dorado, distintos por sección: cuadrado de números en numerología y perfiles, rueda zodiacal en carta natal, Árbol de la Vida en cábala, constelaciones en biblioteca y asistente, emblema de nueve esferas en el resto. Son decorativos (`aria-hidden`); la rueda del fondo gira muy lento y se detiene con «reducir movimiento». Contraste AA conservado.
  - Zona horaria con buscador: todas las zonas IANA del navegador (`Intl.supportedValuesOf`, con lista de respaldo), agrupadas por región, México primero, con su desfase UTC de hoy y búsqueda sin acentos por ciudad, región o desfase. «Automática» usa la zona del lugar elegido en la carta natal.

## 9 oct 2026
- **03:15** — Etapas 9 (resto) y 10, endurecimiento:
  - **Enlaces para compartir** un PDF o todos los del expediente: vencen (1 hora a 30 días, con tope en `/admin/ajustes`), descargas máximas opcionales, revocables al instante y solo con el permiso «compartir». La base guarda el hash del token y audita cada apertura y descarga con la IP recortada. Vencido o revocado: la página dice «ya no está disponible» y la descarga responde 410 ([detalle](expedientes.md#enlaces-para-compartir)).
  - **Retención configurable** de enlaces vencidos o revocados (90 días) y de la auditoría (730, mínimo 365); la purga programada los borra y deja constancia.
  - **Límites de frecuencia** compartidos en una tabla de Supabase (claves SHA-256): entrar y verificación en dos pasos cuentan solo los intentos fallidos; también alta, descargas, exportación, PDF, enlaces públicos, asistente y bot.
  - **Accesibilidad WCAG 2.2 AA:** axe en e2e sobre las pantallas principales, «Saltar al contenido», estados vacíos y de error (404, error inesperado) con ayuda contextual.
  - **Lista de seguridad** ([seguridad.md](seguridad.md)): llaves, RLS, registros sin datos sensibles y cabeceras HTTP; buena parte la revisa una prueba automática. CSP con *nonce* queda pendiente para el despliegue.
  - Ayuda nueva: «Enlaces para compartir», «Página de un enlace compartido», «Privacidad y seguridad», «Instalación y despliegue» y «Errores y páginas vacías». README con instalación, privacidad y seguridad.
  - Migración `20261009000100_compartir_retencion_limites.sql`, pgTAP `09_compartir_retencion`, e2e `08-compartir`, `09-accesibilidad` y `10-limites`.
  - **Qué se hizo y por qué:** ahora se puede mandar un reporte a alguien sin darle una cuenta, con un enlace que caduca solo y que se puede apagar en cualquier momento; así nada queda abierto para siempre. Además se pusieron frenos contra quien intente adivinar contraseñas o enlaces, se revisó que la app se pueda usar con teclado y lector de pantalla, y se dejó por escrito cómo instalarla, publicarla y qué datos guarda.

## 13 oct 2026
- **03:10** — IA real en producción: DeepSeek V4 Flash vía OpenRouter ([detalle](proveedores-ia-y-voz.md#en-producción)).
  - Slug, precios y endpoints con retención cero verificados en la API de OpenRouter. V4.1 Flash queda como respaldo, también con ZDR.
  - Llave `LLM_KEY_OPENROUTER` como variable sensible de Vercel. Proveedor `openrouter-deepseek` activo y apto para datos reales, con topes de 10 por minuto, 200 al día y 5 USD al mes.
  - La app apaga el razonamiento en los modelos del catálogo que lo permiten. El panel muestra el origen «biblioteca» en el consumo.
  - Probado en producción: el asistente de ayuda y el bot de la biblioteca responden en español con citas, y el consentimiento aparece antes de enviar. El consumo se registra sin prompts. Costo de unos 0.0001–0.0002 USD por consulta.
  - **Qué se hizo y por qué:** el asistente y el bot ya redactan con una IA de verdad en lugar del modo demo. Se eligió DeepSeek porque es muy barato y porque OpenRouter puede obligar a que solo lo atiendan servidores que no guardan ni aprenden de lo que se les pregunta. Por eso la app lo marca como apto para datos reales. Tiene un tope de gasto para que nunca cueste más de 5 dólares al mes.
- **05:00** — Subir desde el teléfono o la tableta ([biblioteca](biblioteca.md#centro-de-carga-v1), [expedientes](expedientes.md#subir-documentos-o-fotos)).
  - Diagnóstico a 390, 768 y 1024 px: el Centro de carga quedaba debajo de la lista de fuentes y de la cola, el menú no decía «subir», el selector era el control nativo diminuto («Choose File»), sin cámara ni varios archivos, y los expedientes no tenían ninguna forma de subir archivos.
  - Selector compartido con «Elegir archivos», «Tomar foto» (`capture`) y «Galería», varios archivos, barra de avance, arrastrar y soltar en computadora y validación de tipo y tamaño en el navegador y en el servidor. Todo sube directo a Storage con URL firmada.
  - Biblioteca: Centro de carga arriba, «Subir archivos» en el menú y título opcional (nombre del archivo o «Título (n de N)»). Expedientes: «Subir documentos o fotos» bajo el nombre, con `cargar` + `modificar`; las cuentas cliente solo leen.
  - Pruebas: unitarias de reglas de carga y e2e `11-carga-movil` a 390, 768 y 1024 px.

## 14 oct 2026
- **15:30** — «Subir» visible también sin sesión y con contraseña provisional, y aviso de versión nueva.
  - Diagnóstico con la cuenta real del dueño (solo lectura):
    - Es admin con todos los permisos por rol, pero nunca había iniciado sesión desde sus dispositivos.
    - Sigue con `debe_cambiar_contrasena`, y en ese estado `mi_acceso` entrega `permisos` vacío.
    - Sin sesión, el menú solo mostraba «Inicio · Ayuda · Entrar». Con la contraseña provisional, ocultaba «Biblioteca» y «Subir archivos».
    - El despliegue de producción ya incluía #9 y #10. No hay ni hubo service worker, y el HTML se sirve con `no-store`.
  - Sin sesión: «Subir archivos» en el menú (pide entrar y luego abre el Centro de carga), «Entrar» destacado y un aviso en el inicio. Con contraseña provisional y rol admin: «Elegir contraseña», «Biblioteca» y «Subir archivos»; al guardar la contraseña llega al Centro de carga. Con sesión de administración, el inicio tiene accesos rápidos para subir.
  - `AvisoVersion` y `/api/version` (id del despliegue). Al volver a primer plano, la app recarga sola si hay una versión nueva; si hay un formulario a medio escribir, muestra «Hay una versión nueva» con un botón. No recarga en bucle y da de baja cualquier service worker que el navegador conserve.
  - Pruebas: unitarias de `version.ts` y e2e `12-subir-visible` a 390 y 768 px, que también cubre la recarga sin bucle.

## 2 nov 2026 — Claude retoma el proyecto
- **Diagnóstico:** inspección de línea base (`INSPECCION.md`): faltaban cábala, análisis de la plática, interpretación con fuentes, versión visible, tema oscuro e iconos; el asistente de `/ayuda` gastaba IA de pago sin sesión; el hash de la clave de alta se corrompía por los `$`; subir una foto pedía 12 campos.
- **Requisitos comprobables** en `REQUISITOS.md` (los 12 mensajes de Jesús + sus reglas globales) y **comparativa** con 19 apps y 37 fuentes libres en `docs/investigacion-competencia.md`.
- **Cábala** (`src/modulos/calculo/cabala`): gematría hebrea (Hejrají, Gadol, Katán) con transliteración propuesta y aprobada por la persona, reducción visible y correspondencia con las 10 sefirot; 15 pruebas.
- **Numerología avanzada:** año, mes y día personal; pináculos, desafíos y ciclos; madurez, actitud, tabla de inclusión, kármicos y compatibilidad entre dos personas; 30 pruebas.
- **Astrología avanzada:** tránsitos, calendario de tránsitos exactos, sinastría, revolución solar, progresiones y arco solar; 23 pruebas.
- **Biblioteca:** enlaces de YouTube (videos, listas y canales), podcasts (RSS y Apple Podcasts, eligiendo episodios) y audios por enlace; videos y audios grandes se convierten en el navegador a audio ligero; aprobación automática; formulario reducido a lo esencial. Worker para la DGX Spark (yt-dlp, ffmpeg, Whisper) con credencial temporal propia.
- Migraciones `20261102000100` y `20261102000200` aplicadas en producción con autorización de Jesús (3 nov 2026).

## 3 nov 2026 — v0.2.0 · Worker en la DGX Spark, tema oscuro y versión visible
- Worker instalado en la Spark (`~/circulo-nueve`, contenedor `circulo-nueve-worker`, se reinicia solo); su huella quedó registrada en `worker_credenciales` con autorización de Jesús.
- Probado sin escribir en la base: video de YouTube por subtítulos (6 s, enlaces al segundo), lista de YouTube expandida y episodio de podcast de 26 min transcrito en 184 s.
- Corregido: Whisper siempre transcribía en español y «traducía» los audios en otro idioma. Ahora usa el idioma del feed del podcast o del video (`idiomaWhisper`).
- **Versión visible arriba** (v0.2.0, desde `package.json`) en todas las pantallas; al pulsarla abre esta línea del tiempo (`/linea-del-tiempo`). Si hay una versión publicada más nueva aparece «⬆️ Actualizar a la vX» y un aviso con «Más tarde»; ya no se recarga sola.
- **Tema claro y oscuro** con botón 🌙/☀️ arriba; se recuerda en el equipo y por defecto sigue al sistema.
- **🆘 Ayúdame** en la cabecera y **Guía de todos los botones** en el Centro de ayuda, generada desde el código (`scripts/generar-guia-botones.mts`).
- La línea del tiempo pasa a `LINEA_DE_TIEMPO.md`, en la raíz de la app, y se muestra igual dentro de la app.
- **✨ Nueva consulta** (`/consulta`): se pega o dicta la plática y se detectan nombre, fecha, hora y lugar (`src/modulos/consulta/platica.ts`, 18 pruebas); se confirman los datos; se aprueba el nombre en hebreo con teclado en pantalla; se calcula todo junto (numerología, año/mes/día personal, pináculos y desafíos, cábala con sefirot y carta natal) y se descarga **una sola carta PDF** (`/api/consulta/pdf`), fechada en el día local y con el aviso de privacidad al final. El servidor recalcula y no guarda nada.
- **Iconos completos** y script `scripts/generar-iconos.mts` (favicon SVG/ICO/PNG 16-32, PWA 192/512 normales y maskable, apple 180, .ico de escritorio).
- Ayuda: secciones nuevas de la consulta; la de cábala deja de decir «pendiente».
- **Correcciones del inspector (N1–N9):** el tema se recuerda al recargar (la CSP bloqueaba el script en línea); en el teléfono, mantener pulsado un botón solo lo explica y no lo acciona; la guía de botones muestra el nombre de cada botón; sin desborde en la línea del tiempo a 375 px; botones deshabilitados legibles en tema oscuro; mensajes de error del PDF en español; la portada solo nombra lo que incluye; el lugar detectado en la plática se busca solo.
- **Seguridad (D7):** la IA de pago del asistente de ayuda solo se ofrece con sesión iniciada; sin sesión queda en modo demo.
- **Publicada el 4 nov 2026** en circulo-nueve.vercel.app (Vercel, despliegue con la CLI; `.vercelignore` evita subir secretos). Comprobado en producción: `/api/version` da 0.2.0, la carta PDF responde 200 y el asistente sin sesión, 401. Actualizada en el S23, el S26 y la Tab S10; acceso directo con icono propio en la laptop jesus-sanchez.
- 10 nov 2026: acceso directo con icono propio también en la laptop hpjsecasa (HPJSETRABAJO), instalado por SSH; desde ella la app responde v0.2.0. Ya está en todos los equipos.

## Pendiente
- Repo propio `jesussaes-ai/circulo-nueve` (extraer con `git subtree split`).
- Tarea programada para `retencion:purgar` en el proyecto Supabase de producción.
- Revisión manual con lector de pantalla.
- Texto del aviso de privacidad (lo redacta la persona responsable en `/admin/ajustes`).
- Interpretaciones redactadas con citas de la biblioteca (80/20) dentro de la carta: falta cargar los libros.
- Guardar la consulta en un expediente; integrar en pantalla la astrología avanzada (tránsitos, sinastría, revolución solar).