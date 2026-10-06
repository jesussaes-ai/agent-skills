import { join } from "node:path";
import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { LIMITES, type Formato } from "./formatos";
import { htmlAMarkdown, segmentarMarkdown } from "./markdown";
import type { DocumentoExtraido, Segmento } from "./tipos";

export const UMBRAL_OCR_BAJO = 0.7;

function rutaCache(): string {
  return process.env.MODELOS_CACHE?.trim() || join(process.cwd(), ".cache", "modelos");
}

async function extraerPdf(bytes: Uint8Array): Promise<DocumentoExtraido> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  if (pdf.numPages > LIMITES.paginasPdf) throw new Error(`El PDF tiene ${pdf.numPages} páginas; el límite es ${LIMITES.paginasPdf}.`);
  const { text } = await extractText(pdf, { mergePages: false });
  const etiquetas = (await pdf.getPageLabels().catch(() => null)) ?? null;
  const advertencias: string[] = [];
  const segmentos: Segmento[] = [];
  const partes: string[] = [];
  text.forEach((pagina, i) => {
    const limpio = pagina.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    partes.push(`<!-- página ${i + 1} -->\n\n${limpio}`);
    if (!limpio) return;
    segmentos.push({
      texto: limpio,
      jerarquia: [],
      localizador: { paginaArchivo: i + 1, ...(etiquetas?.[i] ? { paginaImpresa: etiquetas[i] } : {}) },
    });
  });
  if (!segmentos.length) advertencias.push("El PDF no tiene texto extraíble; puede ser un escaneo (súbelo como imagen para OCR).");
  return { markdown: partes.join("\n\n"), segmentos, metodo: "unpdf (pdf.js) por página", advertencias };
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
  if (texto.length > LIMITES.caracteresTexto) throw new Error("El texto supera el límite de 2 millones de caracteres.");
  return { markdown: texto, segmentos: segmentarMarkdown(texto), metodo: formato === "md" ? "Markdown" : "Texto plano", advertencias: [] };
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

export async function extraerDocumento(formato: Formato, bytes: Uint8Array): Promise<DocumentoExtraido> {
  switch (formato) {
    case "pdf":
      return extraerPdf(bytes);
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
  }
}
