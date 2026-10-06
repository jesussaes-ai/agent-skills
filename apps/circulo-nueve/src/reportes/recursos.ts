import { fileURLToPath } from "node:url";
import { Font } from "@react-pdf/renderer";
import { TIPOGRAFIA } from "./tema";

// Cada recurso debe escribirse como `new URL("literal", import.meta.url)` para que
// el empaquetador de Next lo copie al bundle del servidor (Vercel no incluye src/).
const ruta = (u: URL) => fileURLToPath(u);

export const LOGOTIPO = ruta(new URL("./marca/logotipo-horizontal.png", import.meta.url));
export const EMBLEMA = ruta(new URL("./marca/emblema.png", import.meta.url));

let registradas = false;

export function registrarFuentes(): void {
  if (registradas) return;
  Font.register({
    family: TIPOGRAFIA.titulos,
    fonts: [
      { src: ruta(new URL("./fuentes/cormorant-garamond-latin-400-normal.woff", import.meta.url)), fontWeight: 400 },
      { src: ruta(new URL("./fuentes/cormorant-garamond-latin-400-italic.woff", import.meta.url)), fontWeight: 400, fontStyle: "italic" },
      { src: ruta(new URL("./fuentes/cormorant-garamond-latin-600-normal.woff", import.meta.url)), fontWeight: 600 },
      { src: ruta(new URL("./fuentes/cormorant-garamond-latin-600-italic.woff", import.meta.url)), fontWeight: 600, fontStyle: "italic" },
      { src: ruta(new URL("./fuentes/cormorant-garamond-latin-700-normal.woff", import.meta.url)), fontWeight: 700 },
    ],
  });
  Font.register({
    family: TIPOGRAFIA.texto,
    fonts: [
      { src: ruta(new URL("./fuentes/source-sans-3-400-normal.ttf", import.meta.url)), fontWeight: 400 },
      { src: ruta(new URL("./fuentes/source-sans-3-400-italic.ttf", import.meta.url)), fontWeight: 400, fontStyle: "italic" },
      { src: ruta(new URL("./fuentes/source-sans-3-600-normal.ttf", import.meta.url)), fontWeight: 600 },
      { src: ruta(new URL("./fuentes/source-sans-3-700-normal.ttf", import.meta.url)), fontWeight: 700 },
    ],
  });
  // El silabeo por defecto de react-pdf es para inglés; en español corta mal.
  Font.registerHyphenationCallback((palabra) => [palabra]);
  registradas = true;
}
