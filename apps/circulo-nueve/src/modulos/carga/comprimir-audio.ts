/**
 * Convierte en el navegador un video o audio grande (o en un formato que el servidor no lee,
 * como MOV, MKV, AAC o FLAC) a un audio ligero WebM/Opus mono. Para transcribir solo hace
 * falta la voz: un video de 2 GB y una hora queda en unos 15 MB. Lee el archivo por partes
 * (no lo carga entero en memoria) con Mediabunny y WebCodecs.
 */
import { extensionDe } from "./reglas";

const MB = 1024 * 1024;
/** Por encima de esto se convierte (deja margen al límite de 50 MB del almacenamiento). */
export const UMBRAL_CONVERSION = 45 * MB;
/** Formatos de audio y video que el navegador puede leer para convertir. */
export const EXTENSIONES_MEDIOS = ["mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac", "mp4", "m4v", "mov", "webm", "mkv"] as const;
/** Formatos que el servidor ya sabe leer tal cual. */
const NATIVOS = new Set(["mp3", "wav", "ogg", "oga", "opus", "m4a", "mp4", "m4v", "webm"]);

export function esMedio(nombre: string): boolean {
  return (EXTENSIONES_MEDIOS as readonly string[]).includes(extensionDe(nombre));
}

export function necesitaConversion(archivo: { name: string; size: number }): boolean {
  if (!esMedio(archivo.name)) return false;
  return archivo.size > UMBRAL_CONVERSION || !NATIVOS.has(extensionDe(archivo.name));
}

export function puedeConvertirEnEsteNavegador(): boolean {
  return typeof window !== "undefined" && "AudioEncoder" in window && "AudioDecoder" in window;
}

export async function convertirAAudioLigero(archivo: File, alAvanzar: (fraccion: number) => void): Promise<File> {
  if (!puedeConvertirEnEsteNavegador()) {
    throw new Error("Este navegador no puede convertir audio. Usa Chrome o Edge actualizados, o sube el archivo desde la computadora.");
  }
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WebMOutputFormat } = await import("mediabunny");
  const entrada = new Input({ formats: ALL_FORMATS, source: new BlobSource(archivo) });
  const duracion = await entrada.computeDuration().catch(() => 0);
  // 32 kbps alcanzan para voz; en grabaciones de más de 3 horas se baja a 24 kbps para no pasar de 50 MB.
  const bitrate = duracion > 3 * 3600 ? 24_000 : 32_000;
  const salida = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input: entrada,
    output: salida,
    video: { discard: true },
    audio: { codec: "opus", numberOfChannels: 1, sampleRate: 48_000, bitrate, forceTranscode: true },
    showWarnings: false,
  });
  if (!conversion.isValid) {
    throw new Error("No se encontró una pista de audio que este navegador pueda leer en el archivo.");
  }
  conversion.onProgress = (p) => alAvanzar(Math.min(1, Math.max(0, p)));
  await conversion.execute();
  const datos = salida.target.buffer;
  if (!datos || datos.byteLength < 1024) throw new Error("La conversión no produjo audio.");
  if (datos.byteLength > 50 * MB) throw new Error("Aun convertido, el audio supera 50 MB: divide la grabación en partes de menos de 4 horas.");
  const nombre = `${archivo.name.replace(/\.[^.]+$/, "")} (audio).webm`;
  return new File([datos], nombre, { type: "audio/webm" });
}
