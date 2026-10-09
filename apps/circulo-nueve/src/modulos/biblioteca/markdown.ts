import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import type { Segmento } from "./tipos";

/** HTML → Markdown limpio. Quita scripts, estilos, formularios y elementos de navegación. */
export function htmlAMarkdown(html: string): string {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  for (const el of document.querySelectorAll("script, style, noscript, iframe, object, embed, form, nav, footer, aside")) el.remove();
  const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
  turndown.remove(["script", "style"]);
  return turndown
    .turndown(document.body.innerHTML)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function slug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9ñ]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Divide Markdown por encabezados. Cada segmento conserva la ruta de encabezados
 * (jerarquía) y la sección; `base` aporta el resto del localizador (capítulo, URL…).
 */
export function segmentarMarkdown(markdown: string, base: Segmento["localizador"] = {}, conAncla = false): Segmento[] {
  const segmentos: Segmento[] = [];
  const ruta: string[] = [];
  let buffer: string[] = [];
  let lineaInicio = 1;

  const cerrar = (lineaFin: number) => {
    const texto = buffer.join("\n").trim();
    if (texto) {
      const seccion = ruta.at(-1);
      segmentos.push({
        texto,
        jerarquia: [...ruta],
        localizador: {
          ...base,
          ...(seccion ? { seccion } : {}),
          ...(conAncla && base.url && seccion ? { url: `${base.url.split("#")[0]}#${slug(seccion)}` } : {}),
          lineas: `${lineaInicio}-${lineaFin}`,
        },
      });
    }
    buffer = [];
  };

  const lineas = markdown.split("\n");
  lineas.forEach((linea, i) => {
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(linea);
    if (m) {
      cerrar(i);
      const nivel = m[1].length;
      ruta.length = Math.min(ruta.length, nivel - 1);
      ruta[nivel - 1] = m[2].trim();
      lineaInicio = i + 1;
      buffer.push(linea);
    } else {
      buffer.push(linea);
    }
  });
  cerrar(lineas.length);
  return segmentos.map((s) => ({ ...s, jerarquia: s.jerarquia.filter(Boolean) }));
}
