# Requisitos de Círculo Nueve (definición de «terminado»)

Fuente: los 12 mensajes de Jesús a ChatGPT/Codex del 5–6 oct 2026 (copia en `_origen_chatgpt/MENSAJES_DE_JESUS.md`
fuera del repo), el prompt maestro que se generó con ellos, las correcciones registradas en `LINEA_DE_TIEMPO.md`
y las reglas globales de Jesús (`~/.claude/CLAUDE.md`). Claude retoma el proyecto el 2 nov 2026.

Cada requisito tiene un criterio comprobable: qué se hace y qué debe verse.

## A. Lo que pidió Jesús

| # | Requisito | Criterio de aceptación |
|---|---|---|
| A1 | Numerología con nombre completo, fecha y hora de nacimiento | Con un perfil ficticio, la app muestra camino de vida, expresión, alma, personalidad y día de nacimiento con cada operación visible. |
| A2 | Analizar la plática de la persona | Se puede escribir o dictar una conversación; la app detecta nombre, fecha, hora y lugar, los muestra para confirmar o corregir y solo entonces los usa. |
| A3 | Carta astral | Con fecha, hora y lugar, la app calcula planetas, casas, Ascendente, Medio Cielo y aspectos; sin hora, avisa y no inventa casas. |
| A4 | Cábala (pedida dos veces) | Con el nombre y la fecha, la app calcula y muestra la parte cabalística (gematría con tabla y transliteración aprobada por la persona, sefirá y sendero asociados a los números) indicando la tradición usada; ya no aparece «pendiente». |
| A5 | Biblioteca RAG en Supabase con libros, enlaces web pasados a Markdown, esquemas, dibujos y fotos | La administración puede subir un libro y una URL; ambos quedan indexados con página/sección y se pueden buscar. |
| A6 | Subir y asimilar todo tipo de archivo: sonido, imagen, video, foto, documento, Excel, Google y Microsoft | El Centro de carga acepta MP3/WAV/M4A, MP4/MOV, JPG/PNG/WebP, PDF, EPUB, DOCX, PPTX, XLSX/CSV/ODS y exportaciones de Google; cada formato muestra su estado y lo que extrajo. |
| A7 | Lecturas basadas en un 80 % en los libros y documentos propios; el resto como observación complementaria | La lectura de un expediente incluye interpretaciones con citas de la biblioteca y muestra la proporción aportadas/complementarias; si no hay fuentes, lo dice. |
| A8 | Varias personas, un expediente por cada una | Se crean dos expedientes y los datos de uno nunca aparecen en el otro. |
| A9 | Carta final en PDF digital con aviso de privacidad al final, guardada en resguardo | Desde un expediente se genera un PDF con numerología, carta natal y cábala; termina con el aviso de privacidad y queda guardado en el expediente. |
| A10 | Entrada con clave de administrador; la administración da de alta usuarios con privilegios de abrir, borrar, modificar y compartir | `/setup` pide la clave de alta; el panel de usuarios crea una cuenta y le asigna esos privilegios; la cuenta solo puede hacer lo permitido. |
| A11 | Bot que responde sobre toda la información, con voz de hombre española o mexicana | El bot responde con citas y lee la respuesta con una voz masculina es-MX o es-ES elegible, con botón de prueba. |
| A12 | IA gratuita o de muy bajo costo (OpenRouter, Nous o FreeLLMAPI) | El proveedor se configura en la administración; el costo por consulta queda registrado y tiene tope. |
| A13 | Nombre «Círculo Nueve» y el primer logotipo, sin fondo | La cabecera muestra el logotipo horizontal sin fondo. |
| A14 | Funciona en teléfono y computadora | Todas las pantallas se usan sin desbordes a 360, 768 y 1280 px. |

## B. Reglas globales de Jesús

| # | Regla | Criterio de aceptación |
|---|---|---|
| B1 | `README.md` (qué es, instalación, uso, límites) | Existe y está al día. |
| B2 | `LINEA_DE_TIEMPO.md` y la misma línea dentro de la app | El archivo existe en la raíz de la app y la app tiene una pantalla «Línea del tiempo» con el mismo contenido. |
| B3 | Ayuda dentro de la app | `/ayuda` cubre todas las pantallas. |
| B4 | Versión vX.Y.Z siempre arriba en todas las pantallas y aviso con botón «⬆️ Actualizar a la vX» | La cabecera muestra la versión en cada pantalla; al publicar una nueva, aparece el botón. |
| B5 | Ventana explicativa en cada botón (ratón, teclado y mantener pulsado en el teléfono), botón «🆘 Ayúdame» y guía de botones | Todos los botones la tienen; hay «🆘 Ayúdame» visible y una guía de botones en la ayuda. |
| B6 | Tema claro y oscuro con botón 🌙/☀️ arriba en todas las pantallas, recordado en el equipo | Al pulsarlo cambia el tema, se conserva al recargar y todo se lee con contraste AA. |
| B7 | Ojito 👁️ en cada contraseña o clave | Todos los campos de contraseña, clave y token lo tienen. |
| B8 | Iconos propios: favicon SVG + PNG 16/32 + `.ico`, PWA 192 y 512 (normal y maskable), apple-touch 180, `.ico` de escritorio y script que los regenera | Los archivos existen y el script los vuelve a crear desde el diseño. |
| B9 | Inspector independiente con `INSPECCION.md` | El informe existe, con pruebas reales y sin ❌. |
| B10 | Instalada en todos los equipos (laptops, S23, S26, Tab S10) | Tabla equipo → ✅/⚠️ con motivo. |
