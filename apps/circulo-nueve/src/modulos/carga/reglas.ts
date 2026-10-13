/**
 * Reglas de carga compartidas por el navegador y el servidor: qué extensiones y
 * tamaños acepta cada destino. Sin dependencias pesadas para poder usarse en el
 * cliente. El servidor vuelve a comprobar el contenido real del archivo
 * (`detectarFormato`), así que estas reglas solo evitan subidas inútiles.
 */

export type DestinoCarga = "biblioteca" | "expediente";

const MB = 1024 * 1024;

export const EXTENSIONES_IMAGEN = ["jpg", "jpeg", "png", "webp"] as const;

export const REGLAS_CARGA = {
  biblioteca: {
    extensiones: [
      "pdf", "epub", "docx", "txt", "md", "markdown", "csv", "xlsx", "ods", "pptx",
      ...EXTENSIONES_IMAGEN,
      "mp3", "wav", "ogg", "oga", "opus", "m4a", "mp4", "m4v", "webm",
    ],
    bytesMaximo: 50 * MB,
    bytesImagen: 10 * MB,
  },
  expediente: {
    extensiones: ["pdf", ...EXTENSIONES_IMAGEN],
    bytesMaximo: 25 * MB,
    bytesImagen: 10 * MB,
  },
} as const satisfies Record<DestinoCarga, { extensiones: readonly string[]; bytesMaximo: number; bytesImagen: number }>;

/** Archivos por tanda: evita que una selección accidental de cientos de fotos sature la cola. */
export const MAXIMO_ARCHIVOS_POR_TANDA = 20;

const MIME_POR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
};

export function extensionDe(nombre: string): string {
  const partes = nombre.toLowerCase().split(".");
  return partes.length > 1 ? (partes.pop() ?? "") : "";
}

export function mimeDe(nombre: string): string {
  return MIME_POR_EXTENSION[extensionDe(nombre)] ?? "application/octet-stream";
}

export function esImagen(nombre: string): boolean {
  return (EXTENSIONES_IMAGEN as readonly string[]).includes(extensionDe(nombre));
}

/** Atributo `accept` del selector de archivos (extensiones con punto). */
export function aceptaDe(destino: DestinoCarga): string {
  return REGLAS_CARGA[destino].extensiones.map((e) => `.${e}`).join(",");
}

export const ACEPTA_IMAGENES = "image/jpeg,image/png,image/webp";

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** Devuelve el motivo de rechazo, o null si el archivo puede intentarse subir. */
export function validarArchivo(destino: DestinoCarga, archivo: { name: string; size: number }): string | null {
  const reglas = REGLAS_CARGA[destino];
  const ext = extensionDe(archivo.name);
  if (!archivo.size) return "El archivo está vacío.";
  if (ext === "heic" || ext === "heif") {
    return "Las fotos HEIC no se admiten. Usa «Tomar foto» o «Galería» de esta página (el teléfono las convierte a JPEG) o, en iPhone, Ajustes › Cámara › Formatos › Más compatible.";
  }
  if (!(reglas.extensiones as readonly string[]).includes(ext)) {
    return `El tipo «${ext ? `.${ext}` : "sin extensión"}» no se admite aquí.`;
  }
  const maximo = esImagen(archivo.name) ? reglas.bytesImagen : reglas.bytesMaximo;
  if (archivo.size > maximo) return `Pesa ${tamanoLegible(archivo.size)}; el máximo es ${tamanoLegible(maximo)}.`;
  return null;
}

/** Título de cada fuente al subir varios archivos con los mismos metadatos. */
export function tituloParaArchivo(titulo: string, nombreArchivo: string, indice: number, total: number): string {
  const base = nombreArchivo.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || nombreArchivo;
  const limpio = titulo.trim();
  if (!limpio) return base.slice(0, 300);
  if (total <= 1) return limpio.slice(0, 300);
  return `${limpio} (${indice + 1} de ${total})`.slice(0, 300);
}

/** Nombre seguro para guardar y mostrar: sin rutas ni caracteres de control. */
export function nombreSeguro(nombre: string): string {
  const limpio = nombre.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim() ?? "";
  return (limpio || "archivo").slice(0, 200);
}
