import { fileTypeFromBuffer } from "file-type";
import JSZip from "jszip";

export type Formato = "pdf" | "epub" | "docx" | "txt" | "md" | "png" | "jpeg" | "webp";

export const LIMITES = {
  bytesArchivo: 25 * 1024 * 1024,
  bytesImagen: 10 * 1024 * 1024,
  paginasPdf: 1000,
  caracteresTexto: 2_000_000,
  bytesWeb: 5 * 1024 * 1024,
} as const;

export const EXTENSIONES: Record<Formato, string[]> = {
  pdf: ["pdf"],
  epub: ["epub"],
  docx: ["docx"],
  txt: ["txt"],
  md: ["md", "markdown"],
  png: ["png"],
  jpeg: ["jpg", "jpeg"],
  webp: ["webp"],
};

export const MIME: Record<Formato, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export type ResultadoDeteccion = { ok: true; formato: Formato; mime: string } | { ok: false; error: string };

function extensionDe(nombre: string): string {
  return nombre.toLowerCase().split(".").pop() ?? "";
}

function esTextoUtf8(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detecta el formato por el contenido (bytes mágicos y estructura interna), no por
 * el nombre ni por el MIME que declara el navegador, y exige que la extensión coincida.
 */
export async function detectarFormato(bytes: Uint8Array, nombre: string): Promise<ResultadoDeteccion> {
  const ext = extensionDe(nombre);
  if (!bytes.byteLength) return { ok: false, error: "El archivo está vacío." };
  if (bytes.byteLength > LIMITES.bytesArchivo) return { ok: false, error: "El archivo supera el límite de 25 MB." };

  const tipo = await fileTypeFromBuffer(bytes);
  let formato: Formato | null = null;

  if (tipo?.mime === "application/pdf") formato = "pdf";
  else if (tipo?.mime === "image/png") formato = "png";
  else if (tipo?.mime === "image/jpeg") formato = "jpeg";
  else if (tipo?.mime === "image/webp") formato = "webp";
  else if (tipo?.mime === "application/epub+zip") formato = "epub";
  else if (tipo?.ext === "docx") formato = "docx";
  else if (tipo?.mime === "application/zip") {
    const zip = await JSZip.loadAsync(bytes).catch(() => null);
    if (zip?.file("word/document.xml")) formato = "docx";
    else if (zip?.file("META-INF/container.xml")) formato = "epub";
  } else if (!tipo && esTextoUtf8(bytes)) {
    formato = ext === "md" || ext === "markdown" ? "md" : "txt";
  }

  if (!formato) {
    return { ok: false, error: `Formato no admitido${tipo ? ` (${tipo.mime})` : ""}. Se aceptan PDF, EPUB, DOCX, TXT, Markdown, PNG, JPEG y WebP.` };
  }
  if (!EXTENSIONES[formato].includes(ext)) {
    return { ok: false, error: `El contenido real es ${formato.toUpperCase()}, pero el nombre termina en «.${ext}». Corrige la extensión.` };
  }
  if (["png", "jpeg", "webp"].includes(formato) && bytes.byteLength > LIMITES.bytesImagen) {
    return { ok: false, error: "La imagen supera el límite de 10 MB." };
  }
  return { ok: true, formato, mime: MIME[formato] };
}

export interface RevisionContenidoActivo {
  rechazar: boolean;
  motivos: string[];
}

const PDF_ACTIVO = ["JavaScript", "JS", "Launch", "EmbeddedFile", "RichMedia", "XFA"].map((n) => [n, new RegExp(`/${n}\\b`)] as const);

/** Rechaza macros y contenido activo. La extracción nunca ejecuta nada del archivo. */
export async function revisarContenidoActivo(formato: Formato, bytes: Uint8Array): Promise<RevisionContenidoActivo> {
  const motivos: string[] = [];
  if (formato === "pdf") {
    const texto = new TextDecoder("latin1").decode(bytes);
    for (const [nombre, patron] of PDF_ACTIVO) if (patron.test(texto)) motivos.push(`El PDF contiene contenido activo (/${nombre}).`);
  }
  if (formato === "docx" || formato === "epub") {
    const zip = await JSZip.loadAsync(bytes);
    const nombres = Object.keys(zip.files);
    if (nombres.some((n) => /vbaProject\.bin$|\.bin$/i.test(n))) motivos.push("El documento contiene macros o binarios incrustados.");
    const tipos = await zip.file("[Content_Types].xml")?.async("string");
    if (tipos && /macroEnabled/i.test(tipos)) motivos.push("El documento está habilitado para macros.");
    if (formato === "epub") {
      for (const n of nombres.filter((x) => /\.(x?html?|js)$/i.test(x))) {
        if (/\.js$/i.test(n) || /<script\b/i.test((await zip.file(n)?.async("string")) ?? "")) {
          motivos.push("El EPUB contiene scripts.");
          break;
        }
      }
    }
  }
  return { rechazar: motivos.length > 0, motivos };
}
