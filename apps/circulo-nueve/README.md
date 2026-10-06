# Círculo Nueve

Aplicación web en español, para teléfono y computadora, que ayuda a explorar **numerología**, **carta natal** y **cábala** como sistemas simbólicos de reflexión personal. No son hechos científicos, diagnósticos ni predicciones.

Uso personal, no comercial y gratuito.

> **Estado: demo, cuentas, expedientes y PDF, probados con Supabase local.** Sin variables de Supabase, la app funciona en modo demo (sin cuentas; datos ficticios que no salen del navegador). Con Supabase local se activan las cuentas por invitación, el alta de administración, la verificación en dos pasos, el panel de usuarios y los expedientes con lecturas guardadas y reportes PDF privados. Todavía no hay proyecto Supabase remoto. Hitos y pendientes: [docs/LINEA-DEL-TIEMPO.md](docs/LINEA-DEL-TIEMPO.md).

## Qué incluye

| Parte | Estado |
|---|---|
| Flujo de demo: bienvenida → consentimiento granular → perfil → resultados | Demo con datos ficticios |
| Numerología pitagórica configurable con pasos visibles | Disponible ([reglas](docs/numerologia-reglas.md)) |
| Carta natal determinista: efemérides MIT (`astronomy-engine`), zona horaria histórica IANA, lugares GeoNames, casas configurables, ayanamsas, aspectos, precisión según los datos | Demo ([motor y casos de referencia](docs/astrologia-motor.md)) |
| Cábala | Pendiente (se muestra como tal) |
| Centro de ayuda `/ayuda` y botón «?» en cada sección | Disponible |
| Ventana explicativa (tooltip) en todos los botones y enlaces | Disponible |
| Asistente de la app (responde sobre la app citando la ayuda) | Modo demo sin IA, o con un proveedor de IA activo y consentimiento previo |
| Proveedores de IA intercambiables: OpenRouter, FreeLLMAPI, compatible con OpenAI/local; límites, reintentos ante 429, respaldo, consumo sin prompts | Funciona con Supabase local ([detalle](docs/proveedores-ia-y-voz.md)) |
| Voz del asistente (Web Speech API es-MX/es-ES) y dictado con permiso de micrófono | Disponible ([detalle](docs/proveedores-ia-y-voz.md#voz)) |
| Logotipo en la cabecera, emblema como favicon, icono PWA e icono de navegación | Disponible |
| Esquema Supabase: tablas, RLS que deniega por defecto, buckets privados, pgvector, auditoría | Migraciones y pruebas locales ([detalle](docs/base-de-datos.md)) |
| Cuentas: alta inicial `/setup` (clave con hash argon2id, un solo uso, 410 después), entrar, recuperar, MFA TOTP, invitaciones, panel de usuarios, roles y permisos | Funciona con Supabase local ([detalle](docs/cuentas-y-acceso.md)) |
| CI (tipos, pruebas, compilación, pgTAP, e2e) | Workflow `.github/workflows/circulo-nueve-ci.yml` en la raíz del repo; copia en `.github/workflows/ci.yml` para cuando la app tenga repo propio |
| Expedientes: perfil separado, consentimientos exigidos por la base de datos, lecturas guardadas e historial, modo efímero, exportar o borrar, permisos por expediente y por archivo | Funciona con Supabase local ([detalle](docs/expedientes.md)) |
| Reportes PDF (`src/reportes`): generación en servidor, almacenamiento privado, descarga con URL firmada corta, auditoría y retención configurable con purga | Funciona con Supabase local |
| Recuperación de emergencia de la administración | Script de servidor auditado ([procedimiento](docs/recuperacion-emergencia.md)) |
| Biblioteca RAG: administración de fuentes, centro de carga (PDF, EPUB, DOCX, TXT/MD, imágenes con OCR), web → Markdown, revisión y versiones, worker, embeddings locales, búsqueda híbrida con permisos, bot con citas validadas y proporción 80/20 | Funciona con Supabase local ([detalle](docs/biblioteca.md)) |
| Biblioteca multimedia: figuras de PDF (leyenda, OCR, descripción etiquetada; visión opcional), hojas (XLSX/ODS/CSV con hoja y celdas), PPTX, audio y video con transcripción local (Whisper) y marcas de tiempo, carga directa a Storage, ClamAV opcional | Funciona con Supabase local ([detalle](docs/biblioteca.md)) |
| Despliegue gratuito: Supabase Free (`us-east-1`), Vercel Hobby, worker y ping en GitHub Actions, respaldos cifrados | Guía lista ([despliegue](docs/despliegue.md)) |
| Supabase remoto, cábala | Pendiente de las cuentas del propietario / etapas posteriores |

## Requisitos

- [Node.js](https://nodejs.org/) 20.9 o superior (probado con Node 22) y npm.
- Git.
- Docker (para la base de datos local y los respaldos; en Windows, Docker Desktop).
- ffmpeg (para transcribir audio y video en el worker; opcional en local). ClamAV opcional.

## Ejecutar

Desde esta carpeta (`apps/circulo-nueve/`):

```bash
npm install
npm run dev        # http://localhost:3000
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Pruebas automatizadas (Vitest) |
| `npm run typecheck` | Comprobación de tipos |
| `npm run build` | Compilación de producción |
| `npm start` | Sirve la compilación (`npm run build` antes) |
| `npm run db:start` / `db:stop` | Levanta o detiene Supabase local (Docker) |
| `npm run db:reset` | Aplica todas las migraciones desde cero |
| `npm run test:db` | Reinicia la base local y ejecuta las pruebas pgTAP |
| `npm run test:e2e` | Pruebas de extremo a extremo con Auth local (Playwright) |
| `npm run setup:hash` | Genera el hash argon2id de la clave de alta |
| `npm run retencion:purgar` | Borra los documentos con retención vencida (llave de servicio; `-- --simular` para solo listar) |
| `npm run admin:emergencia` | Recuperación de emergencia de la administración (ver docs) |
| `npm run ingesta:worker` | Worker de la biblioteca: procesa la cola de ingesta (`-- --continuo` para seguir esperando) |
| `npm run respaldo` | Respaldo cifrado de base y archivos ([despliegue](docs/despliegue.md#7-respaldos-manuales-el-plan-gratuito-no-tiene)) |
| `npm run reporte:muestra` | Genera un PDF de muestra con datos ficticios |

No hace falta ninguna variable de entorno en la etapa 1. Para etapas futuras, copia `.env.example` a `.env.local` en tu máquina; nunca subas `.env.local` ni pegues claves en chats o documentos.

## Clonar en Windows

En PowerShell. Hoy la app vive dentro del repositorio `jesussaes-ai/agent-skills`; con un *sparse checkout* solo se descarga esta carpeta:

```powershell
mkdir C:\Users\<usuario>\Proyectos -Force
cd C:\Users\<usuario>\Proyectos
git clone --filter=blob:none --sparse https://github.com/jesussaes-ai/agent-skills.git circulo-nueve
cd circulo-nueve
git sparse-checkout set apps/circulo-nueve
git checkout cursor/circulo-nueve-etapa-1   # solo mientras el cambio no esté en main
cd apps\circulo-nueve
npm install
npm run dev
```

Cuando exista el repositorio propio `jesussaes-ai/circulo-nueve` (ver «Extraer a su propio repositorio»), bastará con:

```powershell
cd C:\Users\<usuario>\Proyectos
git clone https://github.com/jesussaes-ai/circulo-nueve.git
cd circulo-nueve
npm install
npm run dev
```

## Estructura

```
src/
  app/                    Rutas Next.js: / (demo), /ayuda, favicon, iconos y manifest
  ui/
    componentes/          Explicacion (tooltip), Boton, EnlaceBoton, Seccion, AyudaContextual
    demo/                 Pasos del flujo de demostración
    carta-natal/          Sección de carta natal: buscador de lugar, ajustes, rueda y tablas
    asistente/            Interfaz del asistente de la app
    auth/                 Formularios de cuentas, MFA y panel de usuarios
    expedientes/          Secciones del expediente, documentos, permisos y ajustes
    biblioteca/           Catálogo, centro de carga, revisión y bot de la biblioteca
  reportes/               Generador de PDF (marca, tipografías, adaptadores)
  content/ayuda/          Contenido del Centro de ayuda (secciones.json) y su cargador
  modulos/
    auth/                 Sesión, acciones de servidor, clave de alta, límites de intentos, validación
    expedientes/          Consultas y acciones de expedientes, lecturas, documentos y ajustes
    biblioteca/           Biblioteca RAG: formatos, extracción, web, fragmentos, embeddings, worker, bot y 80/20
    calculo/numerologia/  Motor puro, sin E/S, con casos de referencia y pruebas
    calculo/astrologia/   Carta natal: efemérides, tzdb, casas, aspectos y casos contra Swiss Ephemeris
    conversacion/         Asistente de la app (modo demo y capa LLM)
    proveedores/          Proveedores LLM intercambiables, límites, respaldo, consumo y voz (TTS/dictado)
    fuentes/              Tipos y estados de la futura biblioteca RAG de libros
  assets/marca/           Logotipo horizontal y emblema optimizados
supabase/
  migrations/             Esquema SQL (tablas, RLS, buckets, pgvector, auditoría, MFA para admin)
  templates/              Correos de invitación y recuperación
  tests/database/         Pruebas pgTAP
public/iconos/            Iconos PWA del emblema
public/datos/             Catálogo de lugares GeoNames (CC BY 4.0) para la carta natal
e2e/                      Pruebas Playwright
scripts/                  e2e.sh, generar-hash-clave, purgar-retencion, admin-emergencia, generar-lugares.mjs y referencias-astrologia/ (herramienta de desarrollo con Swiss Ephemeris, no se distribuye)
.github/workflows/ci.yml  CI para cuando la app tenga repo propio
docs/                     Línea del tiempo, reglas de cálculo y base de datos
```

Las capas no se mezclan: la UI no calcula ni guarda secretos; los motores de cálculo son funciones puras; los proveedores se usan a través de interfaces intercambiables.

## Centro de ayuda y ventanas explicativas

- Todo el contenido de ayuda está en `src/content/ayuda/secciones.json`. Cada sección tiene `id`, `titulo`, `resumen`, `deQueTrata`, `datosQueUsa`, `comoSeUsa`, `estado` y `palabrasClave`. La misma fuente alimenta la página `/ayuda`, los botones «?» y el asistente.
- Para añadir una sección de la app: crea su entrada en el JSON y usa `<Seccion titulo="…" ayuda="id">`.
- Todos los botones usan `Boton` y todos los enlaces `EnlaceBoton`. Ambos exigen la prop `descripcion`, que se muestra en una ventana explicativa al pasar el ratón, al enfocar con el teclado o al tocar en el móvil (se cierra con Escape) y se asocia con `aria-describedby`.
- `src/ui/ui.test.ts` falla si aparece un `<button>`, `<a>`, `<Link>` o `<summary>` fuera de esos componentes, si una descripción está vacía o si una sección apunta a una ayuda inexistente.

## Asistente de la app

- Base de conocimiento: **solo** el Centro de ayuda (`ayuda-app`), separada de la futura biblioteca de libros (`modulos/fuentes`).
- **Modo demo (actual):** busca en los fragmentos de ayuda en el navegador y muestra extractos literales, cada uno con su cita (sección y campo, con enlace). Si no encuentra respaldo, lo dice.
- **Modo LLM:** `crearAsistenteLlm(proveedor, secciones)` recupera fragmentos, se los pasa al modelo como datos delimitados, exige JSON con ids de fragmento y descarta afirmaciones con citas inexistentes. El servidor (`/api/asistente`) usa los proveedores activos de `/admin/proveedores` solo tras el consentimiento de la persona; ver [docs/proveedores-ia-y-voz.md](docs/proveedores-ia-y-voz.md).

## Numerología

Tabla pitagórica, reglas para acentos, ñ, Y, espacios, guiones, apóstrofos, caracteres no latinos y números maestros, métodos alternativos y casos de referencia: [docs/numerologia-reglas.md](docs/numerologia-reglas.md).

## Carta natal

Posiciones de los planetas y del nodo lunar, casas (Placidus por defecto, con respaldo en latitudes polares), Ascendente, Medio Cielo y aspectos, con zodiaco tropical o sideral. Las efemérides son de `astronomy-engine` (MIT); se eligió en lugar de Swiss Ephemeris (AGPL) para no obligar a publicar la app bajo AGPL. Se comprobaron contra Swiss Ephemeris 2.10.03 en 13 cartas de referencia (diferencia máxima: 18″) y la conversión de hora contra Python `zoneinfo` en 21 casos. Sin hora no hay casas ni Ascendente, y cada valor se muestra con la precisión que permiten la hora y el lugar. En un expediente, la carta se guarda en el historial recalculada en el servidor (con consentimiento, versiones, ajustes y huella) y genera su PDF con rueda y tablas. Detalle, licencias, tolerancias y limitaciones: [docs/astrologia-motor.md](docs/astrologia-motor.md).

Atribución: datos de lugares de [GeoNames](https://www.geonames.org/), licencia CC BY 4.0.

## Marca

- Logotipo horizontal en la cabecera (`src/assets/marca/`, servido optimizado con `next/image` y texto alternativo descriptivo).
- El **emblema circular sin letras** es el icono oficial: `src/app/favicon.ico` (16/32/48), `src/app/icon.png`, `src/app/apple-icon.png` (fondo blanco), iconos PWA en `public/iconos/` (192, 512 y *maskable*) y el icono de la navegación interna (componente `Emblema`).
- Paleta: azul marino `#0f1b33` y dorado `#d4a94f` (`src/app/globals.css`). El dorado es decorativo; los textos usan combinaciones con contraste AA o superior.
- Falta la versión SVG del logotipo; cuando exista, sustituirá al PNG.

## Cuentas y Supabase local

1. `npm run db:start` (requiere Docker).
2. Copia `API_URL`, `ANON_KEY` y `SERVICE_ROLE_KEY` de `npx supabase status -o env` a `.env.local` como `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, y añade `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000`.
3. `npm run setup:hash -- --generar` y copia el hash a `ADMIN_SETUP_KEY_HASH`.
4. `npm run dev` y abre <http://127.0.0.1:3000/setup>. Los correos de prueba se ven en Mailpit (<http://127.0.0.1:54324>).

Flujo completo, garantías de seguridad y rotación de la clave: [docs/cuentas-y-acceso.md](docs/cuentas-y-acceso.md).

## CI

GitHub solo lee los workflows de la raíz del repositorio. Mientras la app viva en `agent-skills`, el CI es `.github/workflows/circulo-nueve-ci.yml` (en la raíz de ese repo y filtrado a `apps/circulo-nueve/**`). Para que no se pierda al extraer la app, hay una copia equivalente en `apps/circulo-nueve/.github/workflows/ci.yml`, que se activa sola en el repo propio. Hay que mantener ambas iguales salvo las rutas. Tienen tres trabajos: calidad (tipos, pruebas y compilación), base de datos (pgTAP) y e2e (Playwright con Supabase local).

## Base de datos

Esquema, modelo de permisos y pruebas: [docs/base-de-datos.md](docs/base-de-datos.md). No hay proyecto remoto creado; todo se prueba con Supabase local.

## Privacidad

En la etapa 1 no hay almacenamiento, cuentas, analítica ni envío a terceros. El aviso de privacidad lo completará el responsable; mientras tanto se muestra como pendiente.

## Extraer a su propio repositorio

La carpeta es autocontenida: su propio `package.json`, `package-lock.json`, configuración y documentación, sin rutas fuera de ella. Desde la raíz de `agent-skills`:

```bash
git subtree split --prefix=apps/circulo-nueve -b circulo-nueve-solo
git push https://github.com/jesussaes-ai/circulo-nueve.git circulo-nueve-solo:main
```

El repositorio destino debe existir y estar vacío. El workflow de la raíz (`.github/workflows/circulo-nueve-ci.yml`) no viaja con el split; en el repo nuevo se usa `.github/workflows/ci.yml`.

## Despliegue

Guía paso a paso, lista para ejecutar: [docs/despliegue.md](docs/despliegue.md) (Supabase Free en `us-east-1`, Vercel Hobby con «Root Directory» = `apps/circulo-nueve`, GitHub Actions para el worker, ping anti-pausa y purga, respaldos manuales cifrados).
