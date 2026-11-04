/**
 * YouTube y audios por enlace (podcasts). Solo corre en el worker (DGX Spark):
 * usa yt-dlp y ffmpeg, que no existen en Vercel. Primero intenta los subtítulos
 * (rápido y gratis); si el video no tiene, descarga solo el audio y lo transcribe con Whisper.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { marcaTiempoCorta, vttASegmentos } from "./enlaces";
import { LIMITES } from "./formatos";
import { extraerAudioVideo } from "./multimedia";
import type { DocumentoExtraido } from "./tipos";
import { descargarSeguro, type OpcionesWeb } from "./web";

const ejecutar = promisify(execFile);
const YTDLP = process.env.YTDLP_BIN?.trim() || "yt-dlp";

async function ytdlp(args: string[], tiempoMs = 30 * 60_000): Promise<string> {
  try {
    const { stdout } = await ejecutar(YTDLP, ["--no-warnings", "--no-progress", "--ignore-config", ...args], {
      maxBuffer: 64 * 1024 * 1024,
      timeout: tiempoMs,
    });
    return stdout;
  } catch (e) {
    const err = e as { code?: string; stderr?: string; message?: string };
    if (err.code === "ENOENT") throw new Error("Falta yt-dlp en el worker: instálalo para procesar enlaces de YouTube.");
    const linea = String(err.stderr ?? err.message ?? "").trim().split("\n").filter(Boolean).at(-1) ?? "error desconocido";
    throw new Error(`YouTube no entregó el video: ${linea.replace(/^ERROR:\s*/, "")}`);
  }
}

export interface EntradaLista {
  id: string;
  titulo: string;
  duracionSegundos: number | null;
}

export interface InfoListaYoutube {
  titulo: string;
  canal: string | null;
  entradas: EntradaLista[];
}

/** Lista, canal o «@usuario» → videos (sin descargarlos). Máximo 300. */
export async function expandirListaYoutube(url: string): Promise<InfoListaYoutube> {
  const datos = JSON.parse(await ytdlp(["--flat-playlist", "--playlist-end", "300", "-J", url], 5 * 60_000)) as {
    title?: string;
    uploader?: string;
    channel?: string;
    entries?: { id?: string; title?: string; duration?: number; ie_key?: string; entries?: unknown[] }[];
  };
  const entradas = (datos.entries ?? [])
    .filter((e) => e.id && /^[\w-]{11}$/.test(e.id))
    .map((e) => ({ id: e.id!, titulo: e.title ?? "Video sin título", duracionSegundos: e.duration ?? null }));
  if (!entradas.length) throw new Error("La lista o el canal no tiene videos públicos.");
  return { titulo: datos.title ?? "Lista de YouTube", canal: datos.channel ?? datos.uploader ?? null, entradas };
}

interface InfoVideo {
  id: string;
  title?: string;
  channel?: string;
  uploader?: string;
  upload_date?: string;
  duration?: number;
  language?: string;
  subtitles?: Record<string, unknown>;
  automatic_captions?: Record<string, unknown>;
}

/** Elige el idioma de subtítulos: manuales en español, automáticos en el idioma original, o nada. */
export function elegirSubtitulos(info: Pick<InfoVideo, "subtitles" | "automatic_captions" | "language">): { idioma: string; automaticos: boolean } | null {
  const manuales = Object.keys(info.subtitles ?? {}).filter((k) => k !== "live_chat");
  const automaticos = Object.keys(info.automatic_captions ?? {});
  const original = info.language?.split("-")[0];
  const es = (l: string) => l === "es" || l.startsWith("es-");
  const manualEs = manuales.find(es);
  if (manualEs) return { idioma: manualEs, automaticos: false };
  if (original) {
    const manualOriginal = manuales.find((l) => l.split("-")[0] === original);
    if (manualOriginal) return { idioma: manualOriginal, automaticos: false };
    // Los automáticos del idioma original se llaman «xx-orig» o «xx»; los traducidos no se usan.
    const auto = automaticos.find((l) => l === `${original}-orig`) ?? automaticos.find((l) => l === original);
    if (auto) return { idioma: auto, automaticos: true };
  }
  if (manuales.length) return { idioma: manuales[0], automaticos: false };
  return null;
}

function enlaceAlMinuto(id: string) {
  return (segundos: number) => `https://www.youtube.com/watch?v=${id}&t=${segundos}s`;
}

export interface MetadatosMedio {
  titulo?: string;
  autor?: string;
  fechaPublicacion?: string;
  duracionSegundos?: number;
  canal?: string;
  idioma?: string;
}

export async function extraerYoutube(url: string): Promise<{ documento: DocumentoExtraido; meta: MetadatosMedio }> {
  const info = JSON.parse(await ytdlp(["--skip-download", "-J", url], 3 * 60_000)) as InfoVideo;
  if ((info.duration ?? 0) > LIMITES.segundosAudio) {
    throw new Error(`El video dura más de ${LIMITES.segundosAudio / 3600} horas.`);
  }
  const meta: MetadatosMedio = {
    titulo: info.title,
    autor: info.channel ?? info.uploader,
    canal: info.channel ?? info.uploader,
    fechaPublicacion: info.upload_date ? `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(4, 6)}-${info.upload_date.slice(6, 8)}` : undefined,
    duracionSegundos: info.duration,
    idioma: info.language?.split("-")[0],
  };
  const carpeta = await mkdtemp(join(tmpdir(), "cn-yt-"));
  try {
    const subtitulos = elegirSubtitulos(info);
    if (subtitulos) {
      await ytdlp([
        "--skip-download",
        subtitulos.automaticos ? "--write-auto-subs" : "--write-subs",
        "--sub-langs", subtitulos.idioma,
        "--sub-format", "vtt",
        "-o", join(carpeta, "subs.%(ext)s"),
        url,
      ], 5 * 60_000);
      const vtt = (await readdir(carpeta)).find((f) => f.endsWith(".vtt"));
      if (vtt) {
        const segmentos = vttASegmentos(await readFile(join(carpeta, vtt), "utf8"), { enlace: enlaceAlMinuto(info.id) });
        if (segmentos.length) {
          return {
            meta,
            documento: {
              markdown: `# ${info.title ?? "Video"}\n\n${segmentos.map((s) => s.texto).join("\n\n")}`,
              segmentos,
              metodo: `Subtítulos de YouTube (${subtitulos.automaticos ? "automáticos" : "del autor"}, ${subtitulos.idioma}) con yt-dlp`,
              advertencias: subtitulos.automaticos ? ["Subtítulos automáticos de YouTube: pueden tener errores de reconocimiento."] : [],
            },
          };
        }
      }
    }
    // Sin subtítulos: se baja solo el audio (el formato más ligero) y se transcribe.
    await ytdlp(["-f", "bestaudio[filesize<600M]/bestaudio/best", "-o", join(carpeta, "audio.%(ext)s"), url]);
    const audio = (await readdir(carpeta)).find((f) => f.startsWith("audio."));
    if (!audio) throw new Error("No se pudo descargar el audio del video.");
    const documento = await extraerAudioVideo(new Uint8Array(await readFile(join(carpeta, audio))), false, meta.idioma);
    return { meta, documento: conEnlaces(documento, enlaceAlMinuto(info.id), info.title) };
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

/** Añade a cada segmento con marca de tiempo un enlace al segundo exacto. */
function conEnlaces(documento: DocumentoExtraido, enlace: (s: number) => string, titulo?: string): DocumentoExtraido {
  const segmentos = documento.segmentos.map((s) => {
    const inicio = s.localizador.marcaTiempo?.split("–")[0];
    if (!inicio) return s;
    const segundos = inicio.split(":").map(Number).reduce((a, n) => a * 60 + n, 0);
    return { ...s, localizador: { ...s.localizador, url: enlace(segundos) } };
  });
  return { ...documento, segmentos, markdown: titulo ? `# ${titulo}\n\n${documento.markdown}` : documento.markdown };
}

/** Episodio de podcast o cualquier audio/video por enlace directo. */
export async function extraerAudioRemoto(url: string, opciones: OpcionesWeb = {}, idioma = "es"): Promise<DocumentoExtraido> {
  const bytes = await descargarSeguro(url, LIMITES.bytesAudioRemoto, { ...opciones, accept: "audio/*,video/*;q=0.9,*/*;q=0.5" });
  if (bytes.byteLength < 1024) throw new Error("El enlace no devolvió un audio.");
  const documento = await extraerAudioVideo(bytes, false, idioma);
  return { ...documento, metodo: `${documento.metodo}; descargado del enlace`, advertencias: [...documento.advertencias, `Audio descargado de ${new URL(url).hostname} el ${new Date().toISOString().slice(0, 10)}; no se guarda el archivo, solo la transcripción.`] };
}

export { marcaTiempoCorta };
