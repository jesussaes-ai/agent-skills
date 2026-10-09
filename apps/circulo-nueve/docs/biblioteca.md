# Biblioteca RAG

Estado: **funciona con Supabase local** y está probada de extremo a extremo con documentos ficticios marcados DEMO. No contiene libros reales: las fuentes las aporta el propietario.

## Flujo

```
Carga / URL ──► cuarentena ──► worker: formato real, contenido activo, antivirus*, extracción,
                                fragmentos con localizador, marcas de inyección, versión + diff
             ──► «Requiere revisión» (Markdown, fragmentos, diferencias; excluir) ──► Aprobar
             ──► worker: embeddings multilingües ──► «Indexado» (versión vigente)
             ──► bot: búsqueda híbrida con permisos ──► respuesta con citas validadas + 80/20
```
\* ClamAV si está instalado; si no, se deja una advertencia en la versión.

Estados de fuente y trabajo: `pendiente → procesando → requiere_revision → indexado`, o bien `fallido` o `retirado`.

## Administración de fuentes (`/biblioteca`, rol admin con MFA)

- Metadatos:
  - título, autor u organización, referencia y edición;
  - idioma y tradición;
  - **grupo** (aportada o complementaria);
  - **licencia o permiso** y notas de derechos;
  - **nivel de acceso** (`publico`, `consultores` o `admin`);
  - marca DEMO.
- Antes de cargar hay que **confirmar los derechos** de uso (sin eludir DRM, muros de pago ni inicios de sesión).
- **Retirar** borra original, Markdown, versiones, fragmentos y vectores, y conserva la ficha como `retirado` para la auditoría. Las altas y cambios de fuentes se auditan.

## Centro de carga v1

| Formato | Detección | Extracción | Localizador |
|---|---|---|---|
| PDF | bytes mágicos (`file-type`) | `unpdf` (pdf.js) por página | página de archivo y página impresa si el PDF trae etiquetas |
| EPUB | zip + `META-INF/container.xml` | OPF/spine → HTML → Markdown | capítulo, sección |
| DOCX | zip + `word/document.xml` | `mammoth` → HTML → Markdown | sección (encabezados) |
| TXT / MD | UTF-8 válido sin NUL | directo | sección y rango de líneas |
| PNG / JPEG / WebP | bytes mágicos | OCR `tesseract.js` (spa) con confianza | página 1, confianza del OCR (< 70 % se marca) |
| **Figuras de PDF** | imágenes incrustadas ≥ 80 px por página (máx. 40) | PNG + leyenda («Figura n…», «Diagrama…») + OCR de rótulos + descripción generada | página y número de figura |
| XLSX / ODS | zip + `xl/workbook.xml` / `mimetype` OpenDocument | tablas Markdown por hoja; bloques de 30 filas que no parten filas y repiten el encabezado | hoja y rango de celdas (`A2:D31`) |
| CSV | UTF-8 + extensión | Papa Parse → tabla | hoja = nombre del archivo, rango de celdas |
| PPTX | zip + `ppt/presentation.xml` | texto y notas por diapositiva, en orden | diapositiva y título |
| MP3 / WAV / OGG / M4A / MP4 / WebM | bytes mágicos | ffmpeg → 16 kHz → **Whisper local** (`Xenova/whisper-base`, precisión completa) | rango de minutos (`00:00–00:59`) |

- **Formato real:** se ignoran el nombre y el MIME que envía el navegador. Si la extensión no coincide con el contenido, se rechaza.
- **Figuras:**
  - Con `VISION_PROVEEDOR_ID` (un proveedor de `/admin/proveedores` que declare visión), el worker pide una descripción a ese modelo. Envía la imagen como `image_url`, neutraliza enlaces y registra el consumo con origen `biblioteca`.
  - Sin él, la descripción se compone **solo con la leyenda y el OCR** (`plantilla-leyenda-ocr-v1`) y lo dice.
  - Siempre queda marcada como generada, con método y fecha. La imagen original es la fuente de verdad.
  - La administración puede **corregir** la descripción; la corrección se guarda aparte y se muestra en el pasaje.
  - El bot ofrece «Ver figura»: `ruta_figura_autorizada` en la base y una URL firmada corta.
- **Audio y video:**
  - Transcripción local y gratuita con marcas de tiempo.
  - Máximo 60 minutos; ffmpeg es obligatorio en el worker.
  - En CPU tarda aproximadamente la duración del audio dividida entre 2 o 4. La primera vez descarga ~290 MB.
  - `whisper-tiny` y las versiones cuantizadas alucinaban con audio en español en las pruebas: por eso se usa `base` en fp32 (configurable con `TRANSCRIPCION_MODELO`).
  - No separa hablantes (exigiría consentimiento) ni extrae fotogramas del video.
- **Carga directa a Storage:**
  - Por encima de 4 MB, el navegador pide al servidor una **URL firmada de subida** a la cuarentena (válida 2 h) y sube el archivo directo a Storage, sin pasar por Vercel (límite de 4.5 MB por petición).
  - Al terminar, el servidor descarga el objeto, comprueba el formato real y el contenido activo y crea el trabajo; si no pasa, lo borra.
  - Límite: 50 MB, el máximo por archivo del plan gratuito de Supabase.
- **Antivirus:**
  - ClamAV, si está instalado: primero `clamdscan` y, si no, `clamscan`. El código 1 significa amenaza y la fuente queda `fallido` con el nombre de la firma.
  - Con `CLAMAV_OBLIGATORIO=1`, la falta de escáner o un error rechazan el archivo; si no, se deja una advertencia.
  - Probado con el archivo EICAR.
- **Formulario:** tras un error se conservan los datos escritos; el archivo hay que elegirlo de nuevo, porque el navegador no permite rellenarlo.
- **Contenido activo:** se rechazan PDF con `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`, `/RichMedia` o `/XFA`, DOCX con macros (`vbaProject.bin`, `macroEnabled`) y EPUB con scripts. La extracción nunca ejecuta nada.
- **Límites:** 25 MB por archivo, 10 MB por imagen, 1000 páginas por PDF y 8 millones de caracteres de texto.
  - En Vercel, la petición admite como mucho ~4.5 MB. Para archivos mayores hay que subir con URL firmada directa a Storage (pendiente).
- **Buckets privados:** `cuarentena` (entrada), `biblioteca-originales` y `biblioteca-derivados` (Markdown). Solo los usa el servidor con service role.

## Ingesta web → Markdown

- Solo `http(s)`, sin credenciales en la URL.
- **Protección SSRF:**
  - Se resuelve el DNS y se rechazan redes internas (10/8, 127/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, `::1`, `fc00::/7`, `fe80::/10`).
  - Cada redirección se vuelve a validar (máximo 3).
  - `INGESTA_PERMITIR_HOSTS_LOCALES=1` desactiva la protección; **solo para pruebas locales**.
- Respeta **robots.txt** (agente `CirculoNueveBot/1.0`), con un tiempo máximo de 15 s y un tamaño máximo de 5 MB.
- No supera 401, 402 ni 403: falla con el motivo y conserva solo los metadatos y el enlace.
- **Readability** extrae el contenido principal (sin navegación, pie ni scripts) y turndown lo convierte a Markdown.
- Se guardan la URL canónica, el título, el autor (byline o meta), la fecha de publicación, la fecha de consulta y el idioma.
- Cada fragmento enlaza a `URL#sección`.
- **Actualizar** crea una versión nueva con su diff. Si el contenido no cambió (mismo SHA-256), no se crea versión. Nunca se reemplaza nada en silencio.

## Worker de ingesta

Está escrito en **TypeScript/Node** (`src/modulos/biblioteca/ingesta.ts`), no en Python como proponía la etapa 0:

- es el mismo lenguaje y las mismas pruebas que el resto de la app;
- las bibliotecas elegidas son todas MIT, Apache o BSD, sin AGPL;
- se ejecuta igual en el CI.

Formas de usarlo:
- `npm run ingesta:worker`: procesa la cola y termina. Con `-- --continuo`, sigue sondeando cada 10 s. Requiere la llave de servicio.
- «Procesar pendientes ahora» en `/biblioteca`: procesa hasta 5 trabajos dentro del servidor de la app. Es cómodo en local y en instalaciones pequeñas.
- `tomar_trabajo_ingesta()` usa `for update skip locked`, así que varios workers no toman el mismo trabajo.
- En producción, el worker corre como contenedor o tarea programada fuera de Vercel: el OCR y los embeddings no caben en las funciones *serverless*.

## Fragmentación

- Fragmentos de unos 500 tokens (≈ 2000 caracteres) con un 12 % de solapamiento.
- Se agrupan por párrafo dentro de cada segmento y **nunca cruzan página, capítulo ni sección**: el fragmento hereda el localizador exacto.
- Cada fragmento guarda la ruta de encabezados (`jerarquia`), su orden y la confianza del OCR.

## Embeddings y búsqueda híbrida

- **Modelo por defecto:** `Xenova/multilingual-e5-small` (MIT, 384 dimensiones, cuantizado `q8`).
  - Corre en local con `@huggingface/transformers`: gratis y sin enviar texto fuera.
  - Usa los prefijos `query:` y `passage:`.
  - La caché está en `.cache/modelos` (o en `MODELOS_CACHE`); `EMBEDDINGS_MODELO` permite elegir otro modelo de 384 dimensiones.
  - Cambiar a otra dimensión exige una migración y reindexar: no se mezclan vectores.
- **`hybrid_search`:**
  - Combina texto completo en español sin acentos (OR de los lexemas de la pregunta) y vectores HNSW, fusionados con RRF (k = 50).
  - Aplica **dentro de la función** los niveles de acceso, el estado `indexado`, la versión vigente y la exclusión de fragmentos.
  - La parte semántica exige una similitud ≥ `min_similitud` (0.85). e5-small comprime el rango: lo ajeno queda en 0.76–0.82 y lo relevante, por encima de 0.83. Así, una pregunta ajena no «encuentra» respaldo.

## Bot de la biblioteca (`/biblioteca/preguntar`)

1. Busca primero **solo en fuentes aportadas**. Si no hay respaldo, lo dice y **pide autorización** para incluir las complementarias.
2. **Sin LLM** (modo extractivo): muestra citas literales de los fragmentos.
3. **Con LLM:**
   - Usa la capa de proveedores (`src/modulos/proveedores/`, ver [proveedores-ia-y-voz.md](proveedores-ia-y-voz.md)) a través de `src/modulos/biblioteca/llm.ts`. Hereda los proveedores activos, límites, reintentos ante 429 y modelos de respaldo.
   - El consumo se registra en `ai_usage` con origen `biblioteca`, sin prompts.
   - La persona elige el proveedor y acepta el envío; el texto dice qué recibe y quién. Sin aceptación, el servidor se niega.
   - Si el proveedor es «solo demo», no se envían preguntas con datos identificables.
   - Si el proveedor no responde, se muestran citas literales con el motivo.
   - Viajan la pregunta y los fragmentos recuperados, dentro de `<datos_no_confiables>`, con instrucciones de tratarlos como datos.
   - Los fragmentos marcados como sospechosos **no se envían**.
   - La salida en JSON se **valida**:
     - un id que no se recuperó se descarta;
     - una cita «textual» que no aparece literalmente se rebaja a paráfrasis;
     - una afirmación sin respaldo se marca como «interpretación general (IA)»;
     - los enlaces se neutralizan;
     - hay un máximo de 12 afirmaciones de 1200 caracteres.
4. **Proporción 80/20 por afirmación citada:**
   - cada afirmación cuenta una vez y se reparte entre las fuentes que cita;
   - el mismo par (fuente, localizador) cuenta una sola vez por respuesta;
   - las afirmaciones sin respaldo se informan aparte y no entran en la proporción.

   Se muestra junto con el objetivo y si se cumple. (El PDF usa `calcularProporcion` de `src/reportes`, que cuenta fragmentos distintos.)
5. «Ver pasaje» muestra el texto exacto de la fuente.

### Defensa contra prompt injection

- **En la ingesta:** heurísticas en español e inglés marcan los fragmentos con forma de instrucción. Detectan:
  - peticiones de ignorar instrucciones o de cambiar de rol;
  - menciones del prompt del sistema y etiquetas de rol;
  - peticiones de secretos o de seguir enlaces.

  La revisión los muestra para excluirlos.
- **En el prompt:** los fragmentos van como datos delimitados y se neutralizan las etiquetas que podrían cerrar el bloque.
- **Sin herramientas:** el LLM del bot no tiene herramientas con efectos.
- **En la salida:** la respuesta se valida contra el esquema y los ids recuperados, y React escapa el HTML al mostrarla.
- **Pruebas:** un LLM que «obedece» la inyección no consigue citas válidas ni enlaces (`biblioteca.test.ts`).

## Base de datos (migración `…0800`)

- **`sources`:** origen, URL, formato, fecha de publicación, notas de derechos, DEMO, motivo de fallo y autor del alta. Tiene políticas de alta y edición con `admin_fuentes` y auditoría.
- **`source_versions`:** rutas del original y del Markdown, número de fragmentos y advertencias.
- **`ingestion_jobs`:** etapa (`extraer` o `indexar`), URL, rutas y tiempos. Siempre se crean `pendiente`.
- **`chunks`:**
  - `vector(384)` con HNSW, `orden`, `excluido`, `sospechoso` y `motivo_sospecha`;
  - la administración puede leerlos y excluirlos;
  - un trigger impide alterar el texto, los vectores o el localizador desde la revisión.

## Pruebas

- **Unitarias:**
  - `biblioteca.test.ts`: formatos y contenido activo; extracción de PDF, EPUB, DOCX y MD con localizadores; fragmentación; inyección; ingesta web con robots, muro de pago y SSRF; validación de citas; 80/20.
  - `modelos.test.ts`: OCR real y embeddings reales.
- **Unitarias** `llm.test.ts`: conexión con la capa de proveedores con dependencias simuladas (consentimiento, datos personales, 429, consumo sin texto).
- **pgTAP** `06_biblioteca.test.sql`.
- **e2e** `03-biblioteca.spec.ts`:
  - formato falso rechazado;
  - carga, revisión e indexado;
  - inyección marcada y excluida;
  - página web complementaria con metadatos;
  - bot con citas y 100 % de aportadas;
  - sin respaldo, se pide autorización y luego aparecen las complementarias («No cumple»);
  - una pregunta ajena no inventa respaldo;
  - retirar borra todo.
- **Unitarias** `multimedia.test.ts`:
  - XLSX, ODS y CSV con hoja y celdas; PPTX con diapositivas y notas;
  - figuras de PDF con leyenda;
  - descripción con y sin visión;
  - transcripción real de audio y video ficticios;
  - ClamAV real con EICAR.
- **pgTAP** `07_biblioteca_figuras.test.sql`.
- **e2e** `07-biblioteca-multimedia.spec.ts`:
  - el formulario se conserva tras un error;
  - XLSX, PPTX, audio y PDF con figura, de la carga a la revisión;
  - imagen por URL firmada y corrección de la figura;
  - el bot cita la figura con «Ver figura»;
  - carga directa de 5 MB;
  - EICAR rechazado;
  - invitación con enlace sin correo.
- **e2e** `05-biblioteca-llm.spec.ts`, con un proveedor compatible con OpenAI simulado:
  - consentimiento exigido;
  - solo se envían fragmentos delimitados;
  - la cita textual se valida;
  - el id inventado queda sin respaldo;
  - el enlace se neutraliza;
  - el consumo queda con origen `biblioteca`.

## Pendiente
- Diagramas complejos como estructura consultable (componentes y relaciones); embeddings multimodales.
- Separación de hablantes con consentimiento; fotogramas de video.

- Activar ClamAV en el worker de producción (`CIRCULO_NUEVE_CLAMAV`).
