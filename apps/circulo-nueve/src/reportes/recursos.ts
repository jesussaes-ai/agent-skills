import { join } from "node:path";
import { Font } from "@react-pdf/renderer";
import { TIPOGRAFIA } from "./tema";

// Rutas desde la raíz del proyecto. `next.config.ts` incluye `src/reportes/fuentes`
// y `src/reportes/marca` en las trazas del servidor (outputFileTracingIncludes),
// así que también existen en funciones de Vercel. No usar `new URL(…, import.meta.url)`:
// Turbopack lo convierte en una URL pública de /_next/static, no en un archivo.
const ruta = (relativa: string) => join(process.cwd(), "src", "reportes", relativa);

export const LOGOTIPO = ruta("marca/logotipo-horizontal.png");
export const EMBLEMA = ruta("marca/emblema.png");

let registradas = false;

export function registrarFuentes(): void {
  if (registradas) return;
  Font.register({
    family: TIPOGRAFIA.titulos,
    fonts: [
      { src: ruta("fuentes/cormorant-garamond-latin-400-normal.woff"), fontWeight: 400 },
      { src: ruta("fuentes/cormorant-garamond-latin-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
      { src: ruta("fuentes/cormorant-garamond-latin-600-normal.woff"), fontWeight: 600 },
      { src: ruta("fuentes/cormorant-garamond-latin-600-italic.woff"), fontWeight: 600, fontStyle: "italic" },
      { src: ruta("fuentes/cormorant-garamond-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: TIPOGRAFIA.texto,
    fonts: [
      { src: ruta("fuentes/source-sans-3-400-normal.ttf"), fontWeight: 400 },
      { src: ruta("fuentes/source-sans-3-400-italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: ruta("fuentes/source-sans-3-600-normal.ttf"), fontWeight: 600 },
      { src: ruta("fuentes/source-sans-3-700-normal.ttf"), fontWeight: 700 },
    ],
  });
  // El silabeo por defecto de react-pdf es para inglés; en español corta mal.
  Font.registerHyphenationCallback((palabra) => [palabra]);
  registradas = true;
}
