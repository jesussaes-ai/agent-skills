/**
 * Reconoce qué tipo de enlace pegó la persona y lee podcasts (RSS) y subtítulos (VTT).
 * Funciones puras: no hacen red, salvo `buscarFeedApple`, que consulta la API pública de iTunes.
 */
import type { Segmento } from "./tipos";

export type TipoEnlace =
  | { tipo: "youtube-video"; id: string; url: string }
  | { tipo: "youtube-lista"; lista: string; url: string }
  | { tipo: "apple-podcast"; id: string; url: string }
  | { tipo: "spotify"; url: string }
  | { tipo: "audio"; url: string }
  | { tipo: "podcast-rss"; url: string }
  | { tipo: "web"; url: string };

const AUDIO = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm|mp4|m4v|mov)(\?|#|$)/i;
const RSS = /(\/feed\/?|\/rss\/?|\.rss|\.xml|feeds?\.|\/podcast\.xml|anchor\.fm\/s\/|feeds\.buzzsprout|feeds\.megaphone|rss\.)/i;

export function detectarEnlace(texto: string): TipoEnlace | null {
  let u: URL;
  try {
    u = new URL(texto.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  const url = u.toString();

  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (/^[\w-]{11}$/.test(id)) return { tipo: "youtube-video", id, url: `https://www.youtube.com/watch?v=${id}` };
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    const lista = u.searchParams.get("list");
    const corto = /^\/(shorts|live|embed)\/([\w-]{11})/.exec(u.pathname)?.[2];
    if (u.pathname === "/playlist" && lista) return { tipo: "youtube-lista", lista, url: `https://www.youtube.com/playlist?list=${lista}` };
    if (v && /^[\w-]{11}$/.test(v)) return { tipo: "youtube-video", id: v, url: `https://www.youtube.com/watch?v=${v}` };
    if (corto) return { tipo: "youtube-video", id: corto, url: `https://www.youtube.com/watch?v=${corto}` };
    if (/^\/(@[\w.-]+|c\/|channel\/|user\/)/.test(u.pathname)) return { tipo: "youtube-lista", lista: u.pathname, url };
  }
  if (host === "podcasts.apple.com") {
    const id = /id(\d+)/.exec(u.pathname)?.[1];
    if (id) return { tipo: "apple-podcast", id, url };
  }
  if (host === "open.spotify.com" || host === "spotify.com") return { tipo: "spotify", url };
  if (AUDIO.test(u.pathname)) return { tipo: "audio", url };
  if (RSS.test(url)) return { tipo: "podcast-rss", url };
  return { tipo: "web", url };
}

export interface EpisodioPodcast {
  titulo: string;
  audio: string;
  fecha: string | null;
  duracionSegundos: number | null;
  guid: string | null;
}

export interface Podcast {
  titulo: string;
  autor: string | null;
  idioma: string | null;
  episodios: EpisodioPodcast[];
}

function textoDe(xml: string, etiqueta: string): string | null {
  const m = new RegExp(`<${etiqueta}(?:\\s[^>]*)?>([\\s\\S]*?)</${etiqueta}>`, "i").exec(xml);
  if (!m) return null;
  return decodificarXml(m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").trim()) || null;
}

function decodificarXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** «1:02:03», «62:03» o «3723» → segundos. */
/** Código ISO de 2 letras válido para Whisper; si no lo es, español. */
export function idiomaWhisper(idioma: string | null | undefined): string {
  const codigo = idioma?.trim().toLowerCase().slice(0, 2) ?? "";
  return /^[a-z]{2}$/.test(codigo) ? codigo : "es";
}

export function duracionASegundos(texto: string | null): number | null {
  if (!texto) return null;
  const partes = texto.trim().split(":").map(Number);
  if (!partes.length || partes.some((n) => !Number.isFinite(n))) return null;
  return partes.reduce((acc, n) => acc * 60 + n, 0);
}

/** Lee un feed RSS de podcast (RSS 2.0 con enclosure). No ejecuta nada del XML. */
export function leerRss(xml: string): Podcast {
  if (!/<rss[\s>]|<channel[\s>]/i.test(xml)) throw new Error("El enlace no es un feed RSS de podcast.");
  const canal = /<channel[\s>]([\s\S]*?)(<item[\s>]|<\/channel>)/i.exec(xml)?.[1] ?? "";
  const episodios: EpisodioPodcast[] = [];
  for (const m of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)) {
    const item = m[1];
    const audio = /<enclosure\b[^>]*\burl=["']([^"']+)["']/i.exec(item)?.[1];
    if (!audio) continue;
    const fecha = textoDe(item, "pubDate");
    const iso = fecha && !Number.isNaN(Date.parse(fecha)) ? new Date(fecha).toISOString().slice(0, 10) : null;
    episodios.push({
      titulo: textoDe(item, "title") ?? "Episodio sin título",
      audio: decodificarXml(audio),
      fecha: iso,
      duracionSegundos: duracionASegundos(textoDe(item, "itunes:duration")),
      guid: textoDe(item, "guid"),
    });
  }
  return {
    titulo: textoDe(canal, "title") ?? "Podcast",
    autor: textoDe(canal, "itunes:author") ?? textoDe(canal, "author"),
    idioma: textoDe(canal, "language")?.slice(0, 2).toLowerCase() ?? null,
    episodios,
  };
}

/** Apple Podcasts → URL del feed RSS mediante la API pública de búsqueda de iTunes. */
export async function buscarFeedApple(id: string, pedir: typeof fetch = fetch): Promise<string> {
  const r = await pedir(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&entity=podcast`, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error("Apple Podcasts no respondió.");
  const datos = (await r.json()) as { results?: { feedUrl?: string }[] };
  const feed = datos.results?.find((x) => x.feedUrl)?.feedUrl;
  if (!feed) throw new Error("Apple Podcasts no publica el RSS de este programa.");
  return feed;
}

function segundosVtt(t: string): number {
  const [hms, ms = "0"] = t.trim().replace(",", ".").split(".");
  const partes = hms.split(":").map(Number);
  const s = partes.reduce((acc, n) => acc * 60 + n, 0);
  return s + Number(`0.${ms}`);
}

export function marcaTiempoCorta(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dos = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${dos(m)}:${dos(r)}` : `${dos(m)}:${dos(r)}`;
}

/**
 * Subtítulos WebVTT (los de YouTube, incluidos los automáticos que repiten líneas) →
 * segmentos de ~`porSegmento` segundos con su marca de tiempo y enlace al minuto exacto.
 */
export function vttASegmentos(vtt: string, opciones: { porSegmento?: number; enlace?: (seg: number) => string } = {}): Segmento[] {
  const porSegmento = opciones.porSegmento ?? 60;
  const claves: { inicio: number; fin: number; texto: string }[] = [];
  let ultima = "";
  for (const bloque of vtt.replace(/\r/g, "").split(/\n\n+/)) {
    const lineas = bloque.split("\n");
    const i = lineas.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lineas[i].split("-->");
    const texto = lineas
      .slice(i + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!texto) continue;
    // Los automáticos repiten la línea anterior al empezar la siguiente: solo se agrega lo nuevo.
    const nuevo = texto.startsWith(ultima) && ultima ? texto.slice(ultima.length).trim() : texto === ultima ? "" : texto;
    ultima = texto;
    if (!nuevo) continue;
    claves.push({ inicio: segundosVtt(a), fin: segundosVtt(b.trim().split(" ")[0]), texto: nuevo });
  }
  const segmentos: Segmento[] = [];
  let actual: typeof claves = [];
  const cerrar = () => {
    if (!actual.length) return;
    const inicio = actual[0].inicio;
    const fin = actual.at(-1)!.fin;
    const rango = `${marcaTiempoCorta(inicio)}–${marcaTiempoCorta(fin)}`;
    const texto = actual.map((c) => c.texto).join(" ").replace(/\s+/g, " ").trim();
    segmentos.push({
      texto: `[${rango}] ${texto}`,
      jerarquia: [],
      localizador: { marcaTiempo: rango, ...(opciones.enlace ? { url: opciones.enlace(Math.floor(inicio)) } : {}) },
    });
    actual = [];
  };
  for (const c of claves) {
    if (actual.length && c.inicio - actual[0].inicio >= porSegmento) cerrar();
    actual.push(c);
  }
  cerrar();
  return segmentos;
}
