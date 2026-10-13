import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import robotsParser from "robots-parser";
import { LIMITES } from "./formatos";
import { htmlAMarkdown, segmentarMarkdown } from "./markdown";
import type { DocumentoExtraido } from "./tipos";

export const AGENTE = "CirculoNueveBot/1.0 (+biblioteca personal; respeta robots.txt)";
const TIEMPO_MS = 15_000;
const REDIRECCIONES = 3;

export class ErrorWeb extends Error {
  constructor(
    mensaje: string,
    /** Si es true, la fuente puede guardarse solo con metadatos y enlace. */
    readonly soloMetadatos = true,
  ) {
    super(mensaje);
  }
}

function ipPrivada(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return ipPrivada(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export interface OpcionesWeb {
  /** Solo para pruebas locales: permite hosts de la red interna (desactiva la protección SSRF). */
  permitirLocales?: boolean;
  fetch?: typeof fetch;
}

async function validarDestino(url: URL, opciones: OpcionesWeb) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ErrorWeb("Solo se admiten direcciones http o https.", false);
  if (url.username || url.password) throw new ErrorWeb("La dirección no puede incluir usuario ni contraseña.", false);
  if (opciones.permitirLocales) return;
  const direcciones = isIP(url.hostname) ? [url.hostname] : (await lookup(url.hostname, { all: true }).catch(() => [])).map((d) => d.address);
  if (!direcciones.length) throw new ErrorWeb("No se pudo resolver el dominio.");
  if (direcciones.some(ipPrivada)) throw new ErrorWeb("La dirección apunta a una red interna; no se permite.", false);
}

async function pedir(url: URL, opciones: OpcionesWeb): Promise<Response> {
  const f = opciones.fetch ?? fetch;
  let actual = url;
  for (let i = 0; i <= REDIRECCIONES; i++) {
    await validarDestino(actual, opciones);
    const respuesta = await f(actual, {
      redirect: "manual",
      headers: { "user-agent": AGENTE, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(TIEMPO_MS),
    });
    if (respuesta.status >= 300 && respuesta.status < 400 && respuesta.headers.get("location")) {
      actual = new URL(respuesta.headers.get("location")!, actual);
      continue;
    }
    return respuesta;
  }
  throw new ErrorWeb("Demasiadas redirecciones.");
}

async function leerLimitado(respuesta: Response): Promise<string> {
  const declarado = Number(respuesta.headers.get("content-length") ?? 0);
  if (declarado > LIMITES.bytesWeb) throw new ErrorWeb("La página supera el límite de 5 MB.");
  const lector = respuesta.body?.getReader();
  if (!lector) return "";
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITES.bytesWeb) {
      await lector.cancel();
      throw new ErrorWeb("La página supera el límite de 5 MB.");
    }
    partes.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(partes));
}

export async function permitidoPorRobots(url: URL, opciones: OpcionesWeb): Promise<boolean> {
  const robotsUrl = new URL("/robots.txt", url);
  try {
    const r = await pedir(robotsUrl, opciones);
    if (r.status >= 400) return true;
    const robots = robotsParser(robotsUrl.href, await leerLimitado(r));
    return robots.isAllowed(url.href, AGENTE) !== false;
  } catch (e) {
    if (e instanceof ErrorWeb && !e.soloMetadatos) throw e;
    return true;
  }
}

/**
 * Descarga una página pública y extrae su contenido principal a Markdown. Respeta
 * robots.txt, no sigue a redes internas, no envía credenciales ni intenta superar
 * muros de pago o inicios de sesión: si la página lo exige, falla con el motivo.
 */
export async function obtenerPaginaWeb(direccion: string, opciones: OpcionesWeb = {}): Promise<DocumentoExtraido> {
  let url: URL;
  try {
    url = new URL(direccion);
  } catch {
    throw new ErrorWeb("La dirección no es válida.", false);
  }
  if (!(await permitidoPorRobots(url, opciones))) throw new ErrorWeb("robots.txt no permite que Círculo Nueve lea esta página.");

  const respuesta = await pedir(url, opciones);
  if (respuesta.status === 401 || respuesta.status === 403) throw new ErrorWeb("La página exige inicio de sesión o no permite el acceso.");
  if (respuesta.status === 402) throw new ErrorWeb("La página está detrás de un muro de pago.");
  if (!respuesta.ok) throw new ErrorWeb(`La página respondió con el código ${respuesta.status}.`);
  const tipo = respuesta.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml\+xml/i.test(tipo)) throw new ErrorWeb(`El contenido no es HTML (${tipo || "sin tipo"}).`);

  const html = await leerLimitado(respuesta);
  const { document } = parseHTML(html);
  const canonica = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const urlCanonica = canonica ? new URL(canonica, url).href : url.href;
  const meta = (n: string) =>
    document.querySelector(`meta[property="${n}"]`)?.getAttribute("content") ?? document.querySelector(`meta[name="${n}"]`)?.getAttribute("content") ?? undefined;

  const articulo = new Readability(document as unknown as Document, { keepClasses: false }).parse();
  if (!articulo?.content) throw new ErrorWeb("No se encontró contenido principal en la página.");
  const markdown = htmlAMarkdown(articulo.content);
  return {
    markdown,
    segmentos: segmentarMarkdown(markdown, { url: urlCanonica }, true),
    metodo: "Readability → Markdown (turndown)",
    advertencias: [],
    metadatos: {
      titulo: articulo.title || document.title || undefined,
      autor: articulo.byline || meta("author") || undefined,
      fechaPublicacion: meta("article:published_time") ?? meta("date") ?? undefined,
      urlCanonica,
      idioma: articulo.lang || document.documentElement?.getAttribute("lang") || undefined,
    },
  };
}
