# Investigación de competencia y fuentes libres — Círculo Nueve

Fecha: 2 de noviembre de 2026 · Método: búsquedas web y apertura de páginas (WebSearch/WebFetch).
Leyenda de verificación: **[V]** confirmado en una fuente oficial o en la ficha de la tienda · **[S]** solo en reseñas o fuentes secundarias · **[NV]** no verificado (lo que sé de antes, sin confirmar esta vez).

---

## Parte 1 — Competencia

### 1.1 Apps revisadas (15)

| # | App | Categoría | Qué se comprobó |
|---|---|---|---|
| 1 | World Numerology (Hans Decoz) | Numerología | Ficha de App Store [V]: de 18 a 20 lecturas, pronóstico anual (Esencia + Año Personal), perfiles de relación con compatibilidad mensual y anual |
| 2 | Pythagorean Numerology (iOS) | Numerología | Ficha [V]: año y trimestre personal, desafíos, logros, sinastría numerológica |
| 3 | Pocket Numerology | Numerología | Ficha [V]: pináculos, desafíos, ciclos mayores, lecciones kármicas |
| 4 | Numerology.com / Numerologist | Numerología | [NV] informes en PDF de pago, pronósticos diarios por correo |
| 5 | Solar Fire (Alabe) | Astrología profesional | Guías y ReadMe [V/S]: TimeMap (tránsitos, progresiones, eclipses, estaciones), animación de la carta, retornos, compuestas de hasta 15 personas, dial de 4 cartas, informes con texto propio editable |
| 6 | Astro Gold | Astrología profesional | Ficha [V]: ruedas simple, doble y triple, ruedas de aspectos de tránsito, cartas progresadas, direccionadas, retorno solar y lunar, compuestas, listados dinámicos, dignidades, orden de puntos medios. Los armónicos no salieron en la búsqueda |
| 7 | TimePassages | Astrología | Hay un manual en PDF, pero no lo pude abrir [NV]: calendario de tránsitos, textos de interpretación |
| 8 | Astro-Seek | Astrología web gratuita | [S]: efemérides por fecha, calendario de tránsitos a largo plazo, progresadas, sinastría, astrocartografía con tránsitos. Rectificación [NV] |
| 9 | Co–Star | Astrología de consumo | [S]: comparar cartas con amigos y contactos, mensajes diarios |
| 10 | The Pattern | Consumo | [S]: «Timing» (ciclos de vida), «Bonds» (relaciones), conversación con IA |
| 11 | Sanctuary | Consumo | [S]: lecturas en vivo con astrólogo humano, sin parte social |
| 12 | CHANI | Consumo | [S]: línea de tiempo de tránsitos personales, carta interactiva, talleres y meditaciones; poca compatibilidad |
| 13 | gematrix.org (y su extensión de Chrome) | Gematría | [S]: calcula en hebreo, inglés y simple con desglose letra por letra, busca frases del mismo valor, filtro de palabras groseras, buscar desde el texto seleccionado en el navegador |
| 14 | 72 Names of God y otras apps de The Kabbalah Centre | Cábala | Ficha [V]: nombre aleatorio, índice, sección de estudio, «tu nombre personal» según la fecha de nacimiento, tarjetas para enviar. Otras apps del mismo desarrollador: calendario cabalístico, Zohar, lector |
| 15 | Practice Better | Gestión para terapeutas holísticos | [V/S]: portal del cliente, reservas por cuenta propia con sincronización a Google y Outlook, recordatorios por correo y SMS, paquetes de sesiones, notas SOAP, metas, asistente de notas con IA, formularios de admisión, diarios |
| 16 | NotebookLM | Conocimiento con fuentes | [S]: resumen en audio (varios formatos), resumen en video, mapa mental, guía de estudio, documento informativo, preguntas frecuentes, línea de tiempo, presentaciones, preguntas sugeridas al subir fuentes, tutor de aprendizaje |
| 17 | Readwise Reader | Conocimiento | Página oficial [V]: RSS, transcripción de YouTube con subrayado, Ghostreader (IA), texto a voz, repaso diario con repetición espaciada, exportar a Notion u Obsidian |
| 18 | Recall | Conocimiento | Documentación oficial [V]: grafo de conocimiento automático, cuestionarios de 6 tipos, repetición espaciada, podcasts y YouTube como fuentes |
| 19 | Snipd | Podcasts | Ficha y documentación [V]: «snips» (fragmentos con IA: título, resumen y transcripción), transcripción animada palabra por palabra, capítulos con IA, exportar a Readwise, Notion, Obsidian y Markdown |

También se consultaron como apoyo SimplePractice, Jane y Calendly [NV], solo por la parte de citas.

### 1.2 Tabla deduplicada de funciones concretas

Viabilidad en Círculo Nueve (Next.js + Supabase + astronomy-engine, motor ya determinista): **F** fácil · **M** medio · **D** difícil · **No** no recomendable. ✔ = ya está en el inventario actual.

#### A. Numerología

| Función | Qué hace | Apps | Viab. |
|---|---|---|---|
| Números centrales (camino de vida, expresión, alma, personalidad, cumpleaños) | Cálculo pitagórico con pasos | Todas | ✔ |
| Año, mes y día personal | Ciclo de 9 años; número del año, mes y día actuales de la persona | World Num., Pythagorean Num. | F |
| Trimestres y vibración diaria | Número del trimestre y del día universal frente al personal | Pythagorean Num. | F |
| Pináculos (4) y desafíos (4) | Etapas de la vida con edades de inicio y fin | Pocket Num., Pythagorean Num. | F |
| Ciclos mayores (3 períodos) | Ciclos formativo, productivo y de cosecha según el mes, el día y el año | Pocket Num. | F |
| Lecciones y deudas kármicas (13, 14, 16, 19) y números faltantes | Números que no aparecen en el nombre | Pocket Num., World Num. [S] | F |
| Plano de expresión, puente y madurez | Números derivados | World Num. [NV] | F |
| Esencia y tránsitos de letras | Letra «en tránsito» de cada nombre por año | World Num. [V: menciona la Esencia] | M |
| Compatibilidad numerológica de dos personas | Compara los números de dos expedientes | World Num., Pythagorean Num. | F |
| Pronóstico anual o mensual redactado | Informe por período | World Num., Numerology.com [NV] | M |
| Análisis de nombre alternativo o de empresa | Probar variantes del nombre o una marca | World Num. [NV] | F |
| Calendario numerológico | Vista del mes con el día personal | Pythagorean Num. [S] | F |

#### B. Astrología

| Función | Qué hace | Apps | Viab. |
|---|---|---|---|
| Carta natal, casas, aspectos, tropical y sideral | — | Todas | ✔ |
| Tránsitos a la carta natal (rueda doble) | Planetas de hoy o de una fecha sobre la carta natal | Solar Fire, Astro Gold, Astro-Seek, CHANI | F (astronomy-engine ya calcula las posiciones) |
| Calendario y lista de tránsitos con fechas exactas | Fecha de entrada, exactitud y salida de cada aspecto de tránsito en un período | Solar Fire (TimeMap), Astro-Seek, TimePassages [NV], CHANI | M (búsqueda de raíces por día) |
| Progresiones secundarias | Un día después del nacimiento equivale a un año | Solar Fire, Astro Gold, Astro-Seek, Alan Leo (libro) | F |
| Arco solar y direcciones primarias | Direcciones simbólicas o primarias | Astro Gold, Solar Fire | M (primarias: D) |
| Revolución solar (y lunar) | Carta del momento en que el Sol vuelve a su grado natal, natal o reubicada | Solar Fire, Astro Gold, Pegasus | F/M (búsqueda del instante) |
| Sinastría (bi-rueda y aspectos cruzados) | Compara las cartas de dos expedientes | Solar Fire, Astro Gold, Astro-Seek, Co–Star | F |
| Carta compuesta (puntos medios) y Davison | Carta de la relación | Solar Fire (hasta 15 personas), Astro Gold | F (compuesta) / M (Davison) |
| Rueda triple (natal, progresada y tránsitos) | — | Astro Gold, Solar Fire | M |
| Efemérides por mes | Tabla de posiciones diarias, estaciones e ingresos | Astro-Seek | F |
| Lunaciones y eclipses sobre la carta | Dónde caen las lunas nuevas y llenas y los eclipses | Solar Fire, CHANI | M |
| Retrógrados y estaciones | Avisos de estaciones | Solar Fire, apps de consumo | F |
| Dignidades esenciales, regentes y dispositores | Tablas tradicionales | Astro Gold, Solar Fire | F |
| Puntos medios y armónicos | Orden de puntos medios, cartas armónicas | Astro Gold (puntos medios), Solar Fire | M |
| Partes árabes, nodos y Lilith | Puntos sensibles | Solar Fire, Astro-Seek | F |
| Astrocartografía (líneas en el mapa) | Líneas ASC/MC/DSC/IC de cada planeta | Astro-Seek, Solar Fire | M/D |
| Rectificación de la hora de nacimiento | Prueba horas con sucesos de la vida | Solar Fire, Astro-Seek [NV] | D |
| Animación de la carta en el tiempo | Mover el tiempo y ver los aspectos | Solar Fire | M |
| Informes redactados con texto propio | Biblioteca de textos editable por el consultor | Solar Fire | M (encaja con el RAG) |
| Vista de carta de grupo o familia | Varias personas a la vez | Solar Fire, Co–Star (amigos) | M |
| Pronóstico diario personalizado y notificaciones | Mensaje diario según los tránsitos | Co–Star, CHANI, The Pattern | M (Web Push) |
| Ciclos de vida (retorno de Saturno, etc.) | Línea de vida con los grandes ciclos | The Pattern (Timing) | F |
| Lectura en vivo con astrólogo | Mercado de lecturas | Sanctuary | No (fuera del alcance de uso personal) |

#### C. Cábala y gematría

| Función | Qué hace | Apps | Viab. |
|---|---|---|---|
| Gematría hebrea con transliteración y sefirot | — | gematrix, otras | ✔ |
| Varios métodos (mispar gadol con finales, katán, ordinal, atbash, albam, mispar hakadmi) | Calcular con varios cifrados a la vez | gematrix, calculadoras | F |
| Búsqueda de palabras o frases del mismo valor | Índice de valor a palabras en un léxico propio o de dominio público | gematrix | M (lista de palabras: Strong o el Séfer Yetsirá) |
| Desglose letra por letra con significado de la letra | Valor, nombre, letra «madre», «doble» o «simple», senda | gematrix (valor), Séfer Yetsirá (clasificación) | F |
| Árbol de la Vida interactivo con 22 sendas | Las sendas resaltadas por las letras del nombre | Apps de Kabbalah Centre [S], Westcott (32 sendas) | M |
| 72 Nombres: tu nombre según la fecha de nacimiento, nombre aleatorio, índice con búsqueda | — | 72 Names of God [V] | M (cuidar las fuentes: el contenido de Yehuda Berg tiene derechos) |
| Calendario hebreo y cabalístico (Rosh Jódesh, meses y su letra) | — | Kabbalistic Calendar [V: existe] | M (cálculo libre, p. ej. la librería hebcal) |
| Extensión de navegador para calcular el texto seleccionado | — | gematrix | M |

#### D. Gestión del consultorio y del cliente

| Función | Qué hace | Apps | Viab. |
|---|---|---|---|
| Expedientes, consentimientos, PDF, enlaces que caducan | — | Practice Better | ✔ |
| Agenda y citas con página para que el cliente reserve | Disponibilidad y reserva | Practice Better, Calendly [NV] | M |
| Sincronización con Google Calendar u Outlook (ICS) | — | Practice Better | M (exportar ICS: F) |
| Recordatorios por correo o SMS | Menos inasistencias | Practice Better | M |
| Notas de sesión con plantilla (tipo SOAP adaptado) | Registro estructurado por sesión | Practice Better | F |
| Transcripción y resumen de la sesión con IA | Grabar la sesión, transcribir con Whisper y resumir | Practice Better (AI Charting) | F/M (Whisper ya está) |
| Formularios de admisión y cuestionarios previos | El cliente llena sus datos de nacimiento | Practice Better | F |
| Portal del cliente con mensajes | El cliente ve sus lecturas | Practice Better | M (los enlaces ya existen) |
| Metas y seguimiento en el tiempo | — | Practice Better | F |
| Paquetes, pagos y facturas | — | Practice Better | D/No (uso personal; si acaso, Stripe) |
| Línea de tiempo del expediente | Sesiones, lecturas y sucesos de la vida en orden | Practice Better [S] | F |

#### E. Biblioteca y conocimiento (RAG)

| Función | Qué hace | Apps | Viab. |
|---|---|---|---|
| Ingesta de varios formatos, OCR, Whisper, búsqueda híbrida, bot con citas y voz | — | NotebookLM | ✔ |
| YouTube, RSS y audios largos | — | Reader, Recall, Snipd | (en curso) |
| Preguntas sugeridas al subir una fuente | Tres a cinco preguntas iniciales por documento | NotebookLM | F |
| Resumen automático por fuente y temas clave | — | NotebookLM, Recall | F |
| Guía de estudio (glosario, preguntas cortas y de ensayo) | — | NotebookLM | F |
| Documento informativo, preguntas frecuentes y línea de tiempo | Productos generados a partir de las fuentes elegidas | NotebookLM | F |
| Mapa mental navegable | Jerarquía de temas; al pulsar un nodo, pregunta al bot | NotebookLM | M |
| Resumen en audio tipo pódcast (dos voces) | — | NotebookLM | M (TTS; Web Speech con dos voces = F, de baja calidad) |
| Resumen en video o diapositivas | — | NotebookLM | D |
| Cuestionarios y repetición espaciada | Tarjetas de repaso a partir de la biblioteca | Recall, Readwise | M |
| Repaso diario de subrayados | — | Readwise | F |
| Subrayados y notas en el lector | — | Reader, Snipd | M |
| Transcripción animada palabra por palabra y capítulos con IA | — | Snipd | M (Whisper da las marcas de tiempo) |
| «Snip»: guardar un fragmento de audio con resumen | — | Snipd | M |
| Grafo de conocimiento entre fuentes | — | Recall | M/D |
| Exportar a Markdown, Obsidian o Notion | — | Snipd, Readwise | F |
| Texto a voz para leer un documento | — | Reader | F (Web Speech ya está) |

### 1.3 Las ~25 funciones de más valor que AÚN NO tiene Círculo Nueve

Ordenadas por valor para un consultor que atiende a varias personas, frente al esfuerzo.

| # | Función | Por qué vale | Viab. | Referencia |
|---|---|---|---|---|
| 1 | **Tránsitos sobre la carta natal** (rueda doble + lista de aspectos con orbe) | Es lo que más se usa en consulta | F | Solar Fire, Astro Gold, Astro-Seek |
| 2 | **Año, mes y día personal** con explicación paso a paso | Lectura de ciclos inmediata | F | World Num., Pythagorean Num. |
| 3 | **Sinastría entre dos expedientes** (aspectos cruzados + bi-rueda) | Consultas de pareja y familia | F | Solar Fire, Astro Gold, Co–Star |
| 4 | **Compatibilidad numerológica entre dos expedientes** | Igual que la anterior, en numerología | F | World Num. |
| 5 | **Revolución solar** (natal o reubicada) | Clásico de las consultas de cumpleaños | F/M | Solar Fire, Astro Gold |
| 6 | **Progresiones secundarias** (y arco solar) | Técnica predictiva básica | F | Astro Gold; Alan Leo, *The Progressed Horoscope* (dominio público) |
| 7 | **Pináculos, desafíos y ciclos mayores** con edades | Mapa de la vida en numerología | F | Pocket Num. |
| 8 | **Calendario de tránsitos con fechas exactas** del período | Preparar la sesión y el seguimiento | M | Solar Fire TimeMap, Astro-Seek |
| 9 | **Notas de sesión con plantilla** dentro del expediente | Hoy no hay registro estructurado de sesiones | F | Practice Better |
| 10 | **Grabar la sesión: transcripción con Whisper, resumen y tareas**, guardado en el expediente con consentimiento | Ya existe la tubería de Whisper | F/M | Practice Better (AI Charting), Snipd |
| 11 | **Agenda de citas** (vista de calendario, exportar ICS, recordatorios) | Ordena la práctica | M | Practice Better |
| 12 | **Preguntas sugeridas** por fuente y por conversación | Mejora el uso del bot | F | NotebookLM |
| 13 | **Guía de estudio, glosario y preguntas frecuentes** de una o varias fuentes | Estudio de la propia biblioteca | F | NotebookLM |
| 14 | **Mapa mental** de una fuente o colección (al pulsar un nodo, pregunta al bot) | Visión global | M | NotebookLM |
| 15 | **Carta compuesta (y Davison)** | Lectura de la relación como entidad | F/M | Solar Fire, Astro Gold |
| 16 | **Lunaciones, eclipses, retrógrados y estaciones** sobre la carta | Pronóstico mensual | M | Solar Fire, CHANI |
| 17 | **Varios métodos de gematría + búsqueda de palabras del mismo valor** | Profundiza la cábala recién añadida | F/M | gematrix |
| 18 | **Árbol de la Vida interactivo** (sendas de las letras, letras madres, dobles y simples del Séfer Yetsirá) | Muy visual y distintivo | M | Kabbalah Centre, Westcott |
| 19 | **Línea de vida del expediente** (sesiones, sucesos, retornos de Saturno, pináculos) | Integra las tres disciplinas | F/M | The Pattern (Timing), Practice Better |
| 20 | **Formulario de admisión** para que el cliente envíe sus datos de nacimiento con consentimiento | Menos errores de captura | F | Practice Better |
| 21 | **Informe redactado con plantilla propia** (textos del consultor + citas de la biblioteca) | Une el RAG con el PDF | M | Solar Fire (texto editable) |
| 22 | **Resumen en audio de dos voces** de una lectura o una fuente | Para que el cliente lo escuche | M | NotebookLM |
| 23 | **Efemérides mensuales y «cielo de hoy»** en el inicio | Uso diario | F | Astro-Seek, Co–Star |
| 24 | **Tarjetas de repaso y cuestionarios** de la biblioteca (repetición espaciada) | Estudio del consultor | M | Recall, Readwise |
| 25 | **Capítulos y transcripción palabra por palabra** en audios y videos largos, con saltos desde la cita del bot | Completa la parte de YouTube, pódcast y audio en curso | M | Snipd |
| 26 | Dignidades, regentes y dispositores | Rigor técnico | F | Astro Gold |
| 27 | Calendario hebreo y cabalístico | Complemento de la cábala | M | Kabbalah Centre |

Descartadas o de baja prioridad: mercado de lecturas en vivo (Sanctuary), red social de amigos (Co–Star), pagos y paquetes (Practice Better), resumen en video y diapositivas (NotebookLM), rectificación y direcciones primarias (difíciles; para más adelante).

**No verificado:** las funciones de TimePassages (no pude abrir su manual), la rectificación en Astro-Seek, los pináculos y desafíos en World Numerology (solo los confirmé en otras apps), las funciones de Numerology.com y Numerologist, el detalle de los cifrados de gematrix.org (su sitio no apareció en los resultados) y los formatos y duraciones exactos de NotebookLM (las fuentes no coinciden entre sí).

---

## Parte 2 — Fuentes complementarias libres de derechos

### Criterio de derechos

- **EE. UU.:** es de dominio público todo lo publicado antes del 1 de enero de 1931 (regla de 95 años, vigente en 2026).
- **México (LFDA, vida + 100 años):** las reformas de 1982, 1994 y 2003 no reviven obras que ya estaban en dominio público. Con los plazos anteriores (vida + 25 en 1956, vida + 30 en 1963), las obras de autores muertos antes de ~1932 ya eran de dominio público antes de 1982. Cheiro (muerto en 1936) también lo sería, porque vida + 30 vencía en 1966. **Es un razonamiento razonable, no asesoría legal.**
- **Wikipedia y Wikisource:** licencia CC BY-SA 4.0. Exige atribución (autor «colaboradores de Wikipedia», enlace y licencia) y que lo derivado y distribuido se comparta con la misma licencia. Para el RAG interno y las citas con enlace no hay problema; si se copian fragmentos en un PDF, hay que poner la nota de licencia.
- En archive.org usar solo escaneos de la **edición original** (no reimpresiones modernas, que pueden añadir prólogos con derechos).

Todas las URL siguientes se abrieron el 2 de noviembre de 2026 (✅ abierta y confirmada; ⚠️ abierta, con una advertencia).

### 2.1 Libros y textos de dominio público

| # | Título | Autor | Año | URL directa | Idioma | Derechos (razón) | Tema | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | The Kabbalah: its doctrines, development, and literature | Christian D. Ginsburg (1831–1914) | 1865 (ed. de 1920) | https://www.gutenberg.org/ebooks/69243 · TXT https://www.gutenberg.org/ebooks/69243.txt.utf-8 · EPUB https://www.gutenberg.org/ebooks/69243.epub3.images | en | DP en EE. UU. (1920); autor muerto en 1914 | Cábala: historia, sefirot | ✅ |
| 2 | Sepher Yetzirah (trad. inglesa, 2.ª ed.) | W. Wynn Westcott (1848–1925) | 1893 | https://en.wikisource.org/wiki/Sepher_Yetzirah (texto: …/Sepher_Yetzirah/Sepher_Yetzirah) | en | DP (antes de 1931; autor muerto hace 100 años); transcripción CC BY-SA | Séfer Yetsirá, letras, sefirot | ⚠️ En Wikisource faltan las «32 sendas» y las notas |
| 3 | Sepher Yetzirah: The Book of Formation and the Thirty Two Paths of Wisdom (escaneo completo) | W. W. Westcott | 1893 | https://archive.org/details/sepheryetzirahb00rittgoog (TXT: …/download/…/_djvu.txt) | en | archive.org: NOT_IN_COPYRIGHT (EE. UU.) | 32 sendas de sabiduría | ✅ |
| 4 | Sefer Yetzirah, texto hebreo (Varsovia 1884) | Anónimo | 1884 | https://www.sefaria.org/Sefer_Yetzirah (API: https://www.sefaria.org/api/texts/versions/Sefer_Yetzirah) | he | Sefaria: «Public Domain» | Texto fuente hebreo | ✅ (por la API) |
| 5 | Sefer Yetzirah, Sefaria Community Translation | Comunidad de Sefaria | s. XXI | igual que el anterior (versión inglesa) | en | **CC0** | Traducción moderna libre | ✅ (por la API) |
| 6 | Sefer Yezirah: A Book on Creation | Isidor Kalisch | 1877 | Versión en Sefaria (misma API); el escaneo de archive.org está en préstamo controlado | en | Sefaria: «Public Domain» (1877) | Traducción con hebreo | ⚠️ Usar la de Sefaria, no la de archive.org (préstamo con DRM) |
| 7 | Kabbala Denudata: The Kabbalah Unveiled | S. L. MacGregor Mathers (1854–1918) | 1887 (ed. de 1912) | https://archive.org/details/kabbaladenudata00rosegoog | en | archive.org: NOT_IN_COPYRIGHT; autor muerto en 1918 | Zohar (Siphra Dtzenioutha, Idras), sefirot | ✅ |
| 8 | Numbers: their occult power and mystic virtue | W. Wynn Westcott | 1890 | https://archive.org/details/numberstheiroccu00west | en | Publicado en 1890; autor muerto en 1925 | Simbolismo numérico pitagórico y cabalístico | ✅ (los metadatos no traen campo de derechos; DP por la fecha) |
| 9 | The Philosophy of Numbers; their tone and colors | L. Dow Balliett (n. 1847) | 1908 | https://archive.org/details/philosophyofnumb00ball | en | Library of Congress: «unaware of any copyright restrictions»; 1908 | Origen de la numerología pitagórica moderna | ✅ |
| 10 | Cheiro's Book of Numbers | Cheiro (1866–1936) | 1926 (Herbert Jenkins) | https://archive.org/details/in.ernet.dli.2015.70770 | en | DP en EE. UU. (1926, antes de 1931); México: probable (ver criterio) | Numerología (sistema caldeo) | ⚠️ Fecha de la edición escaneada no confirmada; evitar el escaneo de 1964 |
| 11 | Cosmic Symbolism | Sepharial (1864–1929) | 1912 | https://www.gutenberg.org/ebooks/70749 · TXT https://www.gutenberg.org/ebooks/70749.txt.utf-8 | en | DP en EE. UU.; autor muerto en 1929 | Cábala, sonido, forma y número | ✅ |
| 12 | Astrology: How to Make and Read Your Own Horoscope | Sepharial | c. 1920 [NV] | https://www.gutenberg.org/ebooks/46963 · TXT https://www.gutenberg.org/ebooks/46963.txt.utf-8 | en | Gutenberg: «Public domain in the USA» | Levantar y leer la carta | ✅ (año no indicado en la ficha) |
| 13 | Ptolemy's Tetrabiblos (trad. de J. M. Ashmand) | Claudio Ptolomeo | 1822 (ed. de 1900) | https://www.gutenberg.org/ebooks/70850 · TXT https://www.gutenberg.org/ebooks/70850.txt.utf-8 | en | DP en EE. UU.; traductor del s. XIX | Fundamentos de la astrología | ✅ |
| 14 | Astrology for All | Alan Leo (1860–1917) | 1899 | https://archive.org/details/astrologyforall00leogoog | en | NOT_IN_COPYRIGHT; autor muerto en 1917 | Signos, planetas, casas | ✅ |
| 15 | The Progressed Horoscope | Alan Leo | 1906 | https://archive.org/details/bub_gb_OY7ZLx4jQmcC | en | Marca de dominio público 1.0 | **Progresiones y direcciones** | ✅ |
| 16 | Christian Astrology (3 libros) | William Lilly (1602–1681) | 1647 (ed. de 1659) | https://archive.org/details/b30328524_0001 | en | Marca de dominio público 1.0 | Horaria, natal, tradicional | ✅ |
| 17 | The Influence of the Stars | Rosa Baughan | 1889 [NV] | https://www.gutenberg.org/ebooks/42889 · TXT https://www.gutenberg.org/ebooks/42889.txt.utf-8 | en | Gutenberg: DP en EE. UU. | Astrología popular, quiromancia | ✅ |
| 18 | The Light of Egypt, vol. 2 | Thomas H. Burgoyne y Belle M. Wagner | 1900 [NV] | https://www.gutenberg.org/ebooks/1650 · TXT https://www.gutenberg.org/ebooks/1650.txt.utf-8 | en | Gutenberg: DP en EE. UU. | Astrología hermética, tarot | ✅ |
| 19 | The Rosicrucian Mysteries | Max Heindel (1865–1919) | 1911 | https://www.gutenberg.org/ebooks/29855 | en | DP en EE. UU.; autor muerto en 1919 | Esoterismo (complemento) | ✅ (poca relevancia) |
| 20 | William Lilly's History of His Life and Times | William Lilly | 1715 | https://www.gutenberg.org/ebooks/15835 | en | DP | Historia de la astrología | ✅ |
| 21 | The Hindu Book of Astrology (audiolibro de LibriVox) | Bhakti Seva | 1902 | https://archive.org/details/hindu_book_of_astrology_jp_librivox | en (audio) | Las grabaciones de LibriVox son de dominio público | Astrología sideral; **sirve para probar la ingesta de audio largo** | ✅ |
| 22 | Astrología judiciaria y almanaques (*Teatro crítico universal*) | Benito Jerónimo Feijoo (1676–1764) | 1726 | https://es.wikisource.org/wiki/Teatro_cr%C3%ADtico_universal/Astrolog%C3%ADa_judiciaria_y_almanaques | **es** | DP; transcripción CC BY-SA 4.0 | Visión crítica e histórica en español | ✅ |

### 2.2 Wikipedia en español (CC BY-SA 4.0, con atribución)

| # | Artículo | URL | Tema | Estado |
|---|---|---|---|---|
| 23 | Gematría | https://es.wikipedia.org/wiki/Gematr%C3%ADa | Métodos y tablas de valores | ✅ |
| 24 | Sefirot (Cábala) | https://es.wikipedia.org/wiki/Sefir%C3%A1 (redirige) | Las 10 sefirot | ✅ |
| 25 | Árbol de la vida (cábala) | https://es.wikipedia.org/wiki/%C3%81rbol_de_la_vida_(c%C3%A1bala) | 10 sefirot y 22 sendas | ✅ |
| 26 | Cábala | https://es.wikipedia.org/wiki/C%C3%A1bala | Panorama general | ✅ |
| 27 | Séfer Ietzirá | https://es.wikipedia.org/wiki/S%C3%A9fer_Ietzir%C3%A1 | El libro | ✅ (por la búsqueda) |
| 28 | Alfabeto hebreo | https://es.wikipedia.org/wiki/Alfabeto_hebreo | Letras y numeración hebrea (tabla de valores) | ✅ |
| 29 | Numerología | https://es.wikipedia.org/wiki/Numerolog%C3%ADa | General (la presenta como pseudociencia) | ✅ |
| 30 | Pitagóricos | https://es.wikipedia.org/wiki/Pitagorismo (redirige) | Origen histórico | ✅ |
| 31 | Carta astral | https://es.wikipedia.org/wiki/Carta_astral | Carta natal | ✅ |
| 32 | Casa (astrología) | https://es.wikipedia.org/wiki/Casa_(astrolog%C3%ADa) | Casas | ✅ (por la búsqueda) |
| 33 | Aspectos planetarios (astrología) | https://es.wikipedia.org/wiki/Aspectos_planetarios_(astrolog%C3%ADa) | Aspectos | ✅ (por la búsqueda) |
| 34 | Ascendente | https://es.wikipedia.org/wiki/Ascendente | Ascendente | ✅ (por la búsqueda) |
| 35 | Dignidad (astrología) | https://es.wikipedia.org/wiki/Dignidad_(astrolog%C3%ADa) | Dignidades | ✅ (por la búsqueda) |
| 36 | Zodiaco | https://es.wikipedia.org/wiki/Zodiaco | Signos y eclíptica | ✅ |
| 37 | Astrología | https://es.wikipedia.org/wiki/Astrolog%C3%ADa | General | ✅ (por la búsqueda) |

Nota: casi no hay libros de dominio público en español sobre estos temas en Gutenberg (la búsqueda «astrologia» solo devolvió un texto en finés). El contenido en español vendrá sobre todo de Wikipedia, de Wikisource (Feijoo) y de la traducción comunitaria al español del Séfer Yetsirá en Sefaria, que tiene **licencia «unknown»** y por eso no se incluye.

### 2.3 Excluidas y por qué

- **sacred-texts.com** (Westcott, Mathers): devuelve 403 y no se pudo verificar. Además, la obra existe en archive.org y Wikisource.
- **jewishencyclopedia.com:** el texto de 1906 es de dominio público, pero el sitio dice «All rights reserved» sobre su edición. Usar escaneos de archive.org si se quiere.
- **Curso Zodiacal (Samael Aun Weor)** en Wikisource: el autor murió en 1977 y la obra tiene derechos vigentes.
- **Sepharial, *The Kabala of Numbers*:** en archive.org solo hay reimpresiones de 1974. Buscar la edición de 1911–1913 antes de incorporarla.
- **Zohar, edición Pritzker** (Sefaria) y **72 Names of God** (Yehuda Berg): tienen derechos.
- **Traducciones de Sefaria al español, francés y portugués:** licencia «unknown».

---

## Fuentes consultadas (selección)

- Solar Fire: https://www.alabe.com/sf4%26pnr.htm · https://alabe.com/ProgramDocs/SolarFire_v5_ReadMe.pdf · https://www.halloran.com/dlr6feat.htm
- Astro Gold: https://apps.apple.com/gb/app/astro-gold/id430270438
- World Numerology: https://apps.apple.com/us/app/world-numerology/id6446248128 · Pythagorean Numerology: https://apps.apple.com/us/app/id574419265 · Pocket Numerology: https://apps.apple.com/app/id1084344273
- 72 Names of God: https://apps.apple.com/us/app/72-names-of-god/id387105664
- gematrix: https://alternativeto.net/software/gematrix-org/about
- Practice Better: https://practicebetter.io/llm-info · https://www.softwareadvice.com/medical/better-profile/
- NotebookLM: https://www.eweek.com/news/google-notebooklm-cheat-sheet-2026/ · https://tooldirectory.ai/tools/notebooklm
- Readwise Reader: https://readwise.io/read · https://readwise.io/upgrade
- Recall: https://docs.recall.it/deep-dives/quiz-and-spaced-repetition · https://www.recall.it/about
- Snipd: https://apps.apple.com/us/app/id1557206126 · https://docs.readwise.io/readwise/docs/importing-highlights/snipd
- Co–Star, The Pattern, Sanctuary, CHANI: https://app.routines.club/blogs/cosmic/top-10-astrology-apps · https://www.stork.ai/en/the-pattern
