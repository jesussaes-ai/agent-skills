import { spawn } from "node:child_process";
import { join } from "node:path";
import { LIMITES } from "./formatos";
import type { DocumentoExtraido, Segmento } from "./tipos";

/**
 * Transcripción local y gratuita con Whisper (transformers.js). Por defecto
 * `Xenova/whisper-base` en precisión completa: en pruebas, la versión cuantizada
 * y la «tiny» alucinaban con audio en español. Requiere ffmpeg para decodificar.
 * No separa hablantes (exigiría consentimiento) ni extrae fotogramas del video.
 */
export const MODELO_TRANSCRIPCION = "Xenova/whisper-base";
const MUESTREO = 16_000;
/** Duración aproximada de cada fragmento de transcripción. */
export const SEGUNDOS_POR_SEGMENTO = 60;

export function marcaTiempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dos = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${dos(m)}:${dos(r)}` : `${dos(m)}:${dos(r)}`;
}

/** Decodifica cualquier audio o video a PCM mono de 16 kHz con ffmpeg (sin red, sin protocolos externos). */
export function decodificarAudio(bytes: Uint8Array): Promise<Float32Array> {
  return new Promise((resolver, rechazar) => {
    // Nombre fijo (se busca en el PATH): una ruta dinámica hace que Next incluya todo el proyecto en la traza del servidor.
    const ff = spawn(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-protocol_whitelist", "pipe", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", String(MUESTREO), "-t", String(LIMITES.segundosAudio + 1), "-f", "f32le", "pipe:1"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const salida: Buffer[] = [];
    let errores = "";
    ff.stdout.on("data", (d: Buffer) => salida.push(d));
    ff.stderr.on("data", (d: Buffer) => (errores += d.toString()));
    ff.on("error", () => rechazar(new Error("No se encontró ffmpeg: instálalo en el worker de ingesta para procesar audio y video.")));
    ff.on("close", (codigo) => {
      if (codigo !== 0) return rechazar(new Error(`ffmpeg no pudo leer el archivo: ${errores.trim().split("\n").at(-1) ?? codigo}`));
      const b = Buffer.concat(salida);
      resolver(new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)));
    });
    ff.stdin.on("error", () => {});
    ff.stdin.end(Buffer.from(bytes));
  });
}

interface TrozoWhisper {
  timestamp: [number, number | null];
  text: string;
}

type Transcriptor = (audio: Float32Array, opciones: Record<string, unknown>) => Promise<{ text: string; chunks?: TrozoWhisper[] }>;
const cargados = new Map<string, Promise<Transcriptor>>();

async function transcriptor(modelo: string): Promise<Transcriptor> {
  if (!cargados.has(modelo)) {
    cargados.set(
      modelo,
      (async () => {
        const { pipeline, env } = await import("@huggingface/transformers");
        env.cacheDir = process.env.MODELOS_CACHE?.trim() || join(process.cwd(), ".cache", "modelos");
        return (await pipeline("automatic-speech-recognition", modelo, { dtype: "fp32" })) as unknown as Transcriptor;
      })(),
    );
  }
  return cargados.get(modelo)!;
}

/** Agrupa los trozos de Whisper en segmentos de ~1 minuto con su rango de tiempo. */
export function agruparTranscripcion(trozos: TrozoWhisper[], duracion: number): Segmento[] {
  const segmentos: Segmento[] = [];
  let actual: TrozoWhisper[] = [];
  const cerrar = () => {
    if (!actual.length) return;
    const inicio = actual[0].timestamp[0];
    const fin = actual.at(-1)!.timestamp[1] ?? duracion;
    const texto = actual.map((t) => t.text.trim()).join(" ").trim();
    if (texto) segmentos.push({ texto: `[${marcaTiempo(inicio)}–${marcaTiempo(fin)}] ${texto}`, jerarquia: [], localizador: { marcaTiempo: `${marcaTiempo(inicio)}–${marcaTiempo(fin)}` } });
    actual = [];
  };
  for (const t of trozos) {
    if (actual.length && t.timestamp[0] - actual[0].timestamp[0] >= SEGUNDOS_POR_SEGMENTO) cerrar();
    actual.push(t);
  }
  cerrar();
  return segmentos;
}

export async function extraerAudioVideo(bytes: Uint8Array, esVideo: boolean): Promise<DocumentoExtraido> {
  const audio = await decodificarAudio(bytes);
  const duracion = audio.length / MUESTREO;
  if (duracion > LIMITES.segundosAudio) throw new Error(`La grabación supera el límite de ${LIMITES.segundosAudio / 60} minutos.`);
  if (duracion < 0.5) throw new Error("La grabación no tiene audio.");
  const modelo = process.env.TRANSCRIPCION_MODELO?.trim() || MODELO_TRANSCRIPCION;
  const asr = await transcriptor(modelo);
  const r = await asr(audio, { language: "spanish", task: "transcribe", return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
  const segmentos = agruparTranscripcion(r.chunks ?? [{ timestamp: [0, duracion], text: r.text }], duracion);
  const advertencias = [
    `Transcripción automática (${modelo}); puede contener errores. Revísala antes de aprobar.`,
    ...(esVideo ? ["Del video solo se transcribe el audio; no se extraen fotogramas."] : []),
  ];
  return {
    markdown: segmentos.map((s) => s.texto).join("\n\n"),
    segmentos,
    metodo: `Transcripción local ${modelo} (ffmpeg → 16 kHz) con marcas de tiempo`,
    advertencias,
  };
}
