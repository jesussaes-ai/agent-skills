import JSZip from "jszip";
import Papa from "papaparse";
import type { DocumentoExtraido, Segmento } from "./tipos";

/** Filas por fragmento de tabla (más la fila de encabezado, que se repite). */
export const FILAS_POR_BLOQUE = 30;
const MAX_FILAS = 20_000;
const MAX_COLUMNAS = 200;

export function letraColumna(indice: number): string {
  let n = indice + 1;
  let letras = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    letras = String.fromCharCode(65 + r) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

export function indiceColumna(letras: string): number {
  return [...letras.toUpperCase()].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
}

const escaparCelda = (v: string) => v.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();

function tablaMarkdown(filas: string[][]): string {
  const ancho = Math.max(1, ...filas.map((f) => f.length));
  const normal = filas.map((f) => Array.from({ length: ancho }, (_, i) => escaparCelda(f[i] ?? "")));
  const [cabecera, ...resto] = normal;
  return [`| ${cabecera.join(" | ")} |`, `| ${cabecera.map(() => "---").join(" | ")} |`, ...resto.map((f) => `| ${f.join(" | ")} |`)].join("\n");
}

/**
 * Una hoja → Markdown y segmentos por bloques de filas. Las filas no se parten
 * y cada bloque repite el encabezado; el localizador dice hoja y rango exacto.
 */
export function hojaASegmentos(hoja: string, filasCrudas: string[][]): { markdown: string; segmentos: Segmento[] } {
  const filas = filasCrudas
    .slice(0, MAX_FILAS)
    .map((f) => f.slice(0, MAX_COLUMNAS))
    .filter((f) => f.some((c) => c.trim()));
  if (!filas.length) return { markdown: "", segmentos: [] };
  const ancho = Math.max(...filas.map((f) => f.length));
  const ultimaColumna = letraColumna(ancho - 1);
  const [cabecera, ...datos] = filas;
  const segmentos: Segmento[] = [];
  for (let i = 0; i < Math.max(1, datos.length); i += FILAS_POR_BLOQUE) {
    const bloque = datos.slice(i, i + FILAS_POR_BLOQUE);
    const filaInicio = i + 2;
    const filaFin = i + 1 + Math.max(1, bloque.length);
    segmentos.push({
      texto: `Hoja «${hoja}», filas ${filaInicio}–${filaFin}:\n\n${tablaMarkdown([cabecera, ...bloque])}`,
      jerarquia: [hoja],
      localizador: { hoja, celda: `A${bloque.length ? filaInicio : 1}:${ultimaColumna}${filaFin}` },
    });
  }
  return { markdown: `## ${hoja}\n\n${tablaMarkdown(filas)}`, segmentos };
}

function textoXml(x: string): string {
  return x
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function extraerXlsx(bytes: Uint8Array): Promise<DocumentoExtraido> {
  const zip = await JSZip.loadAsync(bytes);
  const compartidas = [...((await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => textoXml(t[1])).join(""),
  );
  const libro = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const relaciones = (await zip.file("xl/_rels/workbook.xml.rels")?.async("string")) ?? "";
  const destino = new Map([...relaciones.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const hojas = [...libro.matchAll(/<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)].map((m) => ({ nombre: textoXml(m[1]), archivo: destino.get(m[2]) }));

  const partes: string[] = [];
  const segmentos: Segmento[] = [];
  for (const h of hojas) {
    if (!h.archivo) continue;
    const ruta = h.archivo.startsWith("/") ? h.archivo.slice(1) : `xl/${h.archivo.replace(/^\.\//, "")}`;
    const xml = (await zip.file(ruta)?.async("string")) ?? "";
    const filas: string[][] = [];
    for (const fila of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const celdas: string[] = [];
      for (const c of fila[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /\br="([A-Z]+)\d+"/.exec(c[1])?.[1];
        const tipo = /\bt="([^"]+)"/.exec(c[1])?.[1];
        const contenido = c[2] ?? "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(contenido)?.[1];
        let valor = "";
        if (tipo === "s" && v !== undefined) valor = compartidas[Number(v)] ?? "";
        else if (tipo === "inlineStr") valor = [...contenido.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => textoXml(t[1])).join("");
        else if (v !== undefined) valor = textoXml(v);
        celdas[ref ? indiceColumna(ref) : celdas.length] = valor;
      }
      filas.push(Array.from(celdas, (x) => x ?? ""));
    }
    const r = hojaASegmentos(h.nombre, filas);
    if (r.markdown) partes.push(r.markdown);
    segmentos.push(...r.segmentos);
  }
  return { markdown: partes.join("\n\n"), segmentos, metodo: "XLSX (OOXML) → tablas Markdown por hoja", advertencias: [] };
}

export async function extraerOds(bytes: Uint8Array): Promise<DocumentoExtraido> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = (await zip.file("content.xml")?.async("string")) ?? "";
  const partes: string[] = [];
  const segmentos: Segmento[] = [];
  for (const t of xml.matchAll(/<table:table\b[^>]*table:name="([^"]+)"[^>]*>([\s\S]*?)<\/table:table>/g)) {
    const filas: string[][] = [];
    for (const fila of t[2].matchAll(/<table:table-row\b([^>]*)>([\s\S]*?)<\/table:table-row>/g)) {
      const celdas: string[] = [];
      for (const c of fila[2].matchAll(/<table:(?:covered-)?table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g)) {
        const repetida = Math.min(Number(/table:number-columns-repeated="(\d+)"/.exec(c[1])?.[1] ?? 1), MAX_COLUMNAS);
        const valor = [...(c[2] ?? "").matchAll(/<text:p[^>]*>([\s\S]*?)<\/text:p>/g)].map((p) => textoXml(p[1])).join("\n");
        for (let i = 0; i < repetida; i++) celdas.push(valor);
      }
      while (celdas.length && !celdas.at(-1)) celdas.pop();
      const repetidas = Math.min(Number(/table:number-rows-repeated="(\d+)"/.exec(fila[1])?.[1] ?? 1), celdas.length ? 50 : 1);
      for (let i = 0; i < repetidas; i++) filas.push([...celdas]);
    }
    const r = hojaASegmentos(textoXml(t[1]), filas);
    if (r.markdown) partes.push(r.markdown);
    segmentos.push(...r.segmentos);
  }
  return { markdown: partes.join("\n\n"), segmentos, metodo: "ODS (OpenDocument) → tablas Markdown por hoja", advertencias: [] };
}

export function extraerCsv(bytes: Uint8Array, nombre = "CSV"): DocumentoExtraido {
  const texto = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  const { data, errors } = Papa.parse<string[]>(texto, { skipEmptyLines: true });
  const hoja = nombre.replace(/\.csv$/i, "") || "CSV";
  const r = hojaASegmentos(hoja, data);
  return {
    markdown: r.markdown,
    segmentos: r.segmentos,
    metodo: "CSV (Papa Parse) → tabla Markdown",
    advertencias: errors.slice(0, 5).map((e) => `CSV, fila ${(e.row ?? 0) + 1}: ${e.message}`),
  };
}
