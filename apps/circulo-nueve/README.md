# Circulo Nueve

Aplicación web en español, para teléfono y computadora, que ayuda a explorar **numerología**, **carta natal** y **cábala** como sistemas simbólicos de reflexión personal. No son hechos científicos, diagnósticos ni predicciones.

Uso personal, no comercial y gratuito.

> **Estado: etapa 1 (demostración).** Funciona sin cuentas, sin base de datos y sin claves. Todo usa datos ficticios y nada se guarda ni se envía fuera del navegador. Hitos y pendientes: [docs/LINEA-DEL-TIEMPO.md](docs/LINEA-DEL-TIEMPO.md).

## Qué incluye la etapa 1

| Parte | Estado |
|---|---|
| Flujo de demo: bienvenida → consentimiento granular → perfil → resultados | Demo con datos ficticios |
| Numerología pitagórica configurable con pasos visibles | Disponible ([reglas](docs/numerologia-reglas.md)) |
| Carta natal y cábala | Pendientes (se muestran como tales) |
| Centro de ayuda `/ayuda` y botón «?» en cada sección | Disponible |
| Ventana explicativa (tooltip) en todos los botones y enlaces | Disponible |
| Asistente de la app (responde sobre la app citando la ayuda) | Modo demo sin IA; capa LLM preparada |
| Cuentas, Supabase, biblioteca RAG, voz, PDF | Etapas posteriores |

## Requisitos

- [Node.js](https://nodejs.org/) 20.9 o superior (probado con Node 22) y npm.
- Git.

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
  app/                    Rutas Next.js: / (demo) y /ayuda
  ui/
    componentes/          Explicacion (tooltip), Boton, EnlaceBoton, Seccion, AyudaContextual
    demo/                 Pasos del flujo de demostración
    asistente/            Interfaz del asistente de la app
  content/ayuda/          Contenido del Centro de ayuda (secciones.json) y su cargador
  modulos/
    calculo/numerologia/  Motor puro, sin E/S, con casos de referencia y pruebas
    conversacion/         Asistente de la app (modo demo y capa LLM)
    proveedores/          Interfaces LLM / TTS / embeddings y lectura de configuración
    fuentes/              Tipos y estados de la futura biblioteca RAG de libros
docs/                     Línea del tiempo y reglas de cálculo
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
- **Modo LLM (preparado, sin activar):** `crearAsistenteLlm(proveedor, secciones)` recupera fragmentos, se los pasa al modelo como datos delimitados, exige JSON con ids de fragmento y descarta afirmaciones con citas inexistentes. Falta implementar un `LlmProvider` real (OpenRouter, FreeLLMAPI u Ollama) en el servidor.

## Numerología

Tabla pitagórica, reglas para acentos, ñ, Y, espacios, guiones, apóstrofos, caracteres no latinos y números maestros, métodos alternativos y casos de referencia: [docs/numerologia-reglas.md](docs/numerologia-reglas.md).

## Privacidad

En la etapa 1 no hay almacenamiento, cuentas, analítica ni envío a terceros. El aviso de privacidad lo completará el responsable; mientras tanto se muestra como pendiente.

## Extraer a su propio repositorio

La carpeta es autocontenida: su propio `package.json`, `package-lock.json`, configuración y documentación, sin rutas fuera de ella. Desde la raíz de `agent-skills`:

```bash
git subtree split --prefix=apps/circulo-nueve -b circulo-nueve-solo
git push https://github.com/jesussaes-ai/circulo-nueve.git circulo-nueve-solo:main
```

El repositorio destino debe existir y estar vacío.

## Despliegue

Pendiente. Se prevé Vercel Hobby (uso personal no comercial) con «Root Directory» = `apps/circulo-nueve` mientras viva en este repositorio.
