import { join } from "node:path";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PNG } from "pngjs";
import { extractImages, extractText, getDocumentProxy } from "unpdf";
import { FORMATOS_AUDIO_VIDEO, LIMITES, type Formato } from "./formatos";
import { extraerCsv, extraerOds, extraerXlsx } from "./hojas";
import { extraerAudioVideo } from "./multimedia";
import { extraerPptx } from "./presentaciones";
import { htmlAMarkdown, segmentarMarkdown } from "./markdown";
import type { DocumentoExtraido, FiguraExtraida, Segmento } from "./tipos";

export const UMBRAL_OCR_BAJO = 0.7;
/** Imágenes menores se consideran adornos (viñetas, iconos) y no se extraen. */
const LADO_MINIMO_FIGURA = 80;
const INICIO_LEYENDA = /^\s*(?:Figura|Fig\.|Diagrama|Ilustraci[oó]n|Imagen|Esquema|Gr[aá]fico|L[aá]mina)\s*\d+[\s.:)\-–—]/i;

/** Leyendas de la página; una leyenda sigue en las líneas siguientes mientras la frase no termine. */
export function leyendasDePagina(texto: string): string[] {
  const lineas = texto.split("\n").map((l) => l.trim());
  const leyendas: string[] = [];
  for (let i = 0; i < lineas.length; i++) {
    if (!INICIO_LEYENDA.test(lineas[i])) continue;
    let leyenda = lineas[i];
    for (let extra = 0; extra < 3 && !/[.!?)»”]$/.test(leyenda) && lineas[i + 1] && !INICIO_LEYENDA.test(lineas[i + 1]); extra++) {
      leyenda += ` ${lineas[++i]}`;
    }
    leyendas.push(leyenda);
  }
  return leyendas;
}

function aPng(img: { data: Uint8ClampedArray; width: number; height: number; channels: number }): Uint8Array {
  const png = new PNG({ width: img.width, height: img.height });
  for (let i = 0, j = 0; i < img.width * img.height; i++, j += img.channels) {
    const [r, g, b, a] =
      img.channels === 1 ? [img.data[j], img.data[j], img.data[j], 255] : img.channels === 3 ? [img.data[j], img.data[j + 1], img.data[j + 2], 255] : [img.data[j], img.data[j + 1], img.data[j + 2], img.data[j + 3]];
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = a;
  }
  return new Uint8Array(PNG.sync.write(png));
}

/** Figuras incrustadas por página, con la leyenda de esa página si la hay. Las páginas escaneadas no aportan figuras. */
async function extraerFiguras(pdf: Awaited<ReturnType<typeof getDocumentProxy>>, textos: string[], escaneadas: Set<number>): Promise<FiguraExtraida[]> {
  const figuras: FiguraExtraida[] = [];
  for (let pagina = 1; pagina <= pdf.numPages && figuras.length < LIMITES.figurasPorDocumento; pagina++) {
    if (escaneadas.has(pagina)) continue;
    const imagenes = (await extractImages(pdf, pagina).catch(() => [])).filter((i) => i.width >= LADO_MINIMO_FIGURA && i.height >= LADO_MINIMO_FIGURA);
    const leyendas = leyendasDePagina(textos[pagina - 1] ?? "");
    imagenes.slice(0, LIMITES.figurasPorDocumento - figuras.length).forEach((img, i) => {
      figuras.push({ numero: figuras.length + 1, pagina, png: aPng(img), ancho: img.width, alto: img.height, leyenda: leyendas[i] });
    });
  }
  return figuras;
}

export function rutaCache(): string {
  // En Vercel solo /tmp admite escritura.
  return process.env.MODELOS_CACHE?.trim() || (process.env.VERCEL ? "/tmp/modelos" : join(process.cwd(), ".cache", "modelos"));
}

/** La extracción necesita OCR y quien la ejecuta no lo permite (la app en Vercel): el trabajo pasa al worker. */
export class ErrorRequiereOcr extends Error {}

export interface OpcionesExtraccion {
  /** Falso en la app: un PDF escaneado o con figuras se cede al worker. */
  permitirOcr?: boolean;
}

/** Una página con menos texto que esto se trata como escaneada. */
const MIN_CARACTERES_PAGINA = 25;
/** La imagen de una página escaneada es grande; lo menor se considera adorno. */
const ESCANEO_LADO_MAYOR = 600;
const ESCANEO_LADO_MENOR = 200;

async function extraerPdf(bytes: Uint8Array, opciones: OpcionesExtraccion = {}): Promise<DocumentoExtraido> {
  const permitirOcr = opciones.permitirOcr ?? true;
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  if (pdf.numPages > LIMITES.paginasPdf) throw new Error(`El PDF tiene ${pdf.numPages} páginas; el límite es ${LIMITES.paginasPdf}.`);
  const { text } = await extractText(pdf, { mergePages: false });
  const etiquetas = (await pdf.getPageLabels().catch(() => null)) ?? null;
  const advertencias: string[] = [];
  const limpios = text.map((pagina) => pagina.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());

  const sinTexto = limpios.flatMap((t, i) => (t.replace(/\s/g, "").length < MIN_CARACTERES_PAGINA ? [i + 1] : []));
  const escaneadas = new Map<number, { texto: string; confianza: number }>();
  if (sinTexto.length) {
    const candidatas: { pagina: number; png: Uint8Array }[] = [];
    for (const pagina of sinTexto) {
      const imagenes = await extractImages(pdf, pagina).catch(() => []);
      const mayor = imagenes.filter((i) => Math.max(i.width, i.height) >= ESCANEO_LADO_MAYOR && Math.min(i.width, i.height) >= ESCANEO_LADO_MENOR).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (mayor) candidatas.push({ pagina, png: aPng(mayor) });
    }
    if (candidatas.length && !permitirOcr) throw new ErrorRequiereOcr(`${candidatas.length} páginas escaneadas necesitan OCR.`);
    if (candidatas.length) {
      const ocr = await crearOcr();
      try {
        for (const c of candidatas) escaneadas.set(c.pagina, await ocr.reconocer(c.png));
      } finally {
        await ocr.terminar();
      }
    }
  }

  const segmentos: Segmento[] = [];
  const partes: string[] = [];
  const bajas: number[] = [];
  limpios.forEach((limpioPdf, i) => {
    const escaneo = escaneadas.get(i + 1);
    const limpio = escaneo ? escaneo.texto : limpioPdf;
    partes.push(`<!-- página ${i + 1}${escaneo ? ` · OCR ${Math.round(escaneo.confianza * 100)} %` : ""} -->\n\n${limpio}`);
    if (!limpio) return;
    if (escaneo && escaneo.confianza < UMBRAL_OCR_BAJO) bajas.push(i + 1);
    segmentos.push({
      texto: limpio,
      jerarquia: [],
      localizador: { paginaArchivo: i + 1, ...(etiquetas?.[i] ? { paginaImpresa: etiquetas[i] } : {}) },
      ...(escaneo ? { ocrConfianza: escaneo.confianza } : {}),
    });
  });
  if (escaneadas.size) advertencias.push(`${escaneadas.size} páginas escaneadas se leyeron con OCR (tesseract, español): revisa el texto con el original.`);
  if (bajas.length) advertencias.push(`Confianza del OCR baja (< ${Math.round(UMBRAL_OCR_BAJO * 100)} %) en las páginas ${bajas.slice(0, 30).join(", ")}${bajas.length > 30 ? "…" : ""}.`);
  if (!segmentos.length) advertencias.push("El PDF no tiene texto extraíble ni páginas escaneadas legibles.");
  const figuras = await extraerFiguras(pdf, limpios, new Set(escaneadas.keys()));
  if (figuras.length && !permitirOcr) throw new ErrorRequiereOcr(`${figuras.length} figuras necesitan OCR.`);
  if (figuras.length >= LIMITES.figurasPorDocumento) advertencias.push(`Se extrajeron solo las primeras ${LIMITES.figurasPorDocumento} figuras.`);
  return {
    markdown: partes.join("\n\n"),
    segmentos,
    figuras,
    metodo: escaneadas.size ? "unpdf (pdf.js) por página + OCR tesseract.js (spa) en páginas escaneadas, con figuras" : "unpdf (pdf.js) por página, con figuras",
    advertencias,
  };
}

async function extraerEpub(bytes: Uint8Array): Promise<DocumentoExtraido> {
  const zip = await JSZip.loadAsync(bytes);
  const contenedor = (await zip.file("META-INF/container.xml")?.async("string")) ?? "";
  const rutaOpf = /full-path="([^"]+)"/.exec(contenedor)?.[1];
  if (!rutaOpf) throw new Error("EPUB sin META-INF/container.xml válido.");
  const opf = (await zip.file(rutaOpf)?.async("string")) ?? "";
  const baseOpf = rutaOpf.includes("/") ? rutaOpf.slice(0, rutaOpf.lastIndexOf("/") + 1) : "";
  const manifiesto = new Map([...opf.matchAll(/<item\b[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const lomo = [...opf.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/g)].map((m) => m[1]);
  const titulo = /<dc:title[^>]*>([^<]+)</.exec(opf)?.[1]?.trim();
  const autor = /<dc:creator[^>]*>([^<]+)</.exec(opf)?.[1]?.trim();
  const idioma = /<dc:language[^>]*>([^<]+)</.exec(opf)?.[1]?.trim();

  const segmentos: Segmento[] = [];
  const partes: string[] = [];
  let n = 0;
  for (const id of lomo) {
    const href = manifiesto.get(id);
    if (!href) continue;
    const html = (await zip.file(baseOpf + decodeURIComponent(href))?.async("string")) ?? "";
    const cuerpo = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
    const md = htmlAMarkdown(cuerpo);
    if (!md) continue;
    n++;
    const capitulo = /^#{1,6}\s+(.+)$/m.exec(md)?.[1]?.trim() ?? `Capítulo ${n}`;
    partes.push(md);
    segmentos.push(...segmentarMarkdown(md, { capitulo }));
  }
  return { markdown: partes.join("\n\n"), segmentos, metodo: "EPUB (OPF/spine) → Markdown", advertencias: [], metadatos: { titulo, autor, idioma } };
}

async function extraerDocx(bytes: Uint8Array): Promise<DocumentoExtraido> {
  const { value: html, messages } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
  const md = htmlAMarkdown(html);
  return {
    markdown: md,
    segmentos: segmentarMarkdown(md),
    metodo: "mammoth (DOCX → HTML) → Markdown",
    advertencias: messages.filter((m) => m.type === "warning").map((m) => m.message).slice(0, 10),
  };
}

function extraerTexto(bytes: Uint8Array, formato: "txt" | "md"): DocumentoExtraido {
  const texto = new TextDecoder("utf-8").decode(bytes).replace(/\r\n?/g, "\n");
  if (texto.length > LIMITES.caracteresTexto) throw new Error("El texto supera el límite de 8 millones de caracteres.");
  return { markdown: texto, segmentos: segmentarMarkdown(texto), metodo: formato === "md" ? "Markdown" : "Texto plano", advertencias: [] };
}

/** Un worker de tesseract reutilizable (cargarlo cuesta más que reconocer una página). */
async function crearOcr(): Promise<{ reconocer(png: Uint8Array): Promise<{ texto: string; confianza: number }>; terminar(): Promise<void> }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, { cachePath: rutaCache() });
  return {
    async reconocer(png) {
      const { data } = await worker.recognize(Buffer.from(png));
      return { texto: data.text.trim(), confianza: Math.max(0, Math.min(1, data.confidence / 100)) };
    },
    async terminar() {
      await worker.terminate();
    },
  };
}

/** OCR en español de una imagen; lo usan las imágenes sueltas y las figuras de PDF. */
export async function ocrImagen(bytes: Uint8Array): Promise<{ texto: string; confianza: number }> {
  const ocr = await crearOcr();
  try {
    return await ocr.reconocer(bytes);
  } finally {
    await ocr.terminar();
  }
}

async function extraerImagen(bytes: Uint8Array): Promise<DocumentoExtraido> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, { cachePath: rutaCache() });
  try {
    const { data } = await worker.recognize(Buffer.from(bytes));
    const texto = data.text.trim();
    const confianza = Math.max(0, Math.min(1, data.confidence / 100));
    const advertencias = [];
    if (!texto) advertencias.push("El OCR no encontró texto en la imagen.");
    else if (confianza < UMBRAL_OCR_BAJO) advertencias.push(`Confianza del OCR baja (${Math.round(confianza * 100)} %): revisa el texto con la imagen original.`);
    return {
      markdown: texto,
      segmentos: texto ? [{ texto, jerarquia: [], localizador: { paginaArchivo: 1 }, ocrConfianza: confianza }] : [],
      metodo: "OCR tesseract.js (spa)",
      advertencias,
    };
  } finally {
    await worker.terminate();
  }
}

export async function extraerDocumento(formato: Formato, bytes: Uint8Array, nombre?: string, opciones: OpcionesExtraccion = {}): Promise<DocumentoExtraido> {
  if (opciones.permitirOcr === false && (FORMATOS_AUDIO_VIDEO.includes(formato) || ["png", "jpeg", "webp"].includes(formato))) {
    throw new ErrorRequiereOcr("Las imágenes, el audio y el video los procesa el worker.");
  }
  if (FORMATOS_AUDIO_VIDEO.includes(formato)) return extraerAudioVideo(bytes, formato === "mp4" || formato === "webm");
  switch (formato) {
    case "pdf":
      return extraerPdf(bytes, opciones);
    case "epub":
      return extraerEpub(bytes);
    case "docx":
      return extraerDocx(bytes);
    case "txt":
    case "md":
      return extraerTexto(bytes, formato);
    case "png":
    case "jpeg":
    case "webp":
      return extraerImagen(bytes);
    case "xlsx":
      return extraerXlsx(bytes);
    case "ods":
      return extraerOds(bytes);
    case "csv":
      return extraerCsv(bytes, nombre);
    case "pptx":
      return extraerPptx(bytes);
    default:
      throw new Error(`Formato sin extractor: ${formato}`);
  }
}
