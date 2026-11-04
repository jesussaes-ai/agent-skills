"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { obtenerSesion, type Sesion } from "@/modulos/auth/sesion";
import { clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { z } from "@/modulos/seguridad/zod";
import { buscarFeedApple, detectarEnlace, idiomaWhisper, leerRss, type EpisodioPodcast, type TipoEnlace } from "./enlaces";
import { ErrorWeb, descargarSeguro } from "./web";

/**
 * Pegar un enlace en la Biblioteca: YouTube (video, lista, canal), podcast (RSS o Apple
 * Podcasts), audio directo o página web. Pocos datos obligatorios: el título y el autor
 * se completan solos al procesar. Ver docs/biblioteca.md («Enlaces de YouTube y podcasts»).
 */

export interface VistaEnlace {
  estado: "inicial" | "listo" | "podcast" | "error";
  mensaje?: string;
  tipo?: TipoEnlace["tipo"];
  url?: string;
  podcast?: { titulo: string; autor: string | null; feed: string; episodios: EpisodioPodcast[] };
}

const LICENCIA_PROPIA = "Material propio o de uso personal autorizado por la persona propietaria";

const esquemaComun = z.object({
  titulo: z.string().trim().max(300).default(""),
  autor: z.string().trim().max(200).default(""),
  tradicion: z.string().trim().max(120).default(""),
  grupo: z.enum(["aportada", "complementaria"]).default("aportada"),
  nivelAcceso: z.enum(["consultores", "publico", "admin"]).default("consultores"),
  aprobarAutomatico: z.enum(["on"]).optional(),
  derechos: z.literal("on", { message: "Confirma que tienes derecho a usar esta fuente." }),
});

async function sesionFuentes(): Promise<Sesion | null> {
  const s = await obtenerSesion();
  return s?.acceso.activo && s.acceso.permisos.includes("admin_fuentes") ? s : null;
}

function objeto(form: FormData) {
  return Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

async function leerPodcast(feed: string) {
  const bytes = await descargarSeguro(feed, 15 * 1024 * 1024, { accept: "application/rss+xml,application/xml,text/xml,*/*;q=0.5", tiempoMs: 20_000 });
  const p = leerRss(new TextDecoder().decode(bytes));
  return { ...p, feed };
}

/** Paso 1: reconoce el enlace. Si es un podcast, devuelve sus episodios para elegir. */
export async function accionRevisarEnlace(_: VistaEnlace, form: FormData): Promise<VistaEnlace> {
  if (!(await sesionFuentes())) return { estado: "error", mensaje: "No tienes permiso para administrar la biblioteca." };
  const texto = String(form.get("url") ?? "").trim();
  const enlace = detectarEnlace(texto);
  if (!enlace) return { estado: "error", mensaje: "Pega una dirección completa que empiece por https://" };
  if (enlace.tipo === "spotify") {
    return {
      estado: "error",
      mensaje: "Spotify no permite descargar sus episodios. Busca el mismo podcast en Apple Podcasts o su página y pega ese enlace (o su RSS).",
    };
  }
  try {
    if (enlace.tipo === "apple-podcast") {
      const p = await leerPodcast(await buscarFeedApple(enlace.id));
      return { estado: "podcast", tipo: "podcast-rss", url: p.feed, podcast: { titulo: p.titulo, autor: p.autor, feed: p.feed, episodios: p.episodios.slice(0, 200) } };
    }
    if (enlace.tipo === "podcast-rss" || enlace.tipo === "web") {
      // Una «página» puede ser en realidad un feed: se comprueba antes de tratarla como web.
      const p = await leerPodcast(enlace.url).catch(() => null);
      if (p?.episodios.length) {
        return { estado: "podcast", tipo: "podcast-rss", url: p.feed, podcast: { titulo: p.titulo, autor: p.autor, feed: p.feed, episodios: p.episodios.slice(0, 200) } };
      }
      if (enlace.tipo === "podcast-rss") return { estado: "error", mensaje: "No se encontraron episodios con audio en ese feed." };
    }
  } catch (e) {
    return { estado: "error", mensaje: e instanceof ErrorWeb || e instanceof Error ? e.message : "No se pudo leer el podcast." };
  }
  return { estado: "listo", tipo: enlace.tipo, url: enlace.url };
}

/** Paso 2: agrega el enlace (o los episodios elegidos) a la cola del worker. */
export async function accionAgregarEnlace(_: VistaEnlace, form: FormData): Promise<VistaEnlace> {
  const sesion = await sesionFuentes();
  if (!sesion) return { estado: "error", mensaje: "No tienes permiso para administrar la biblioteca." };
  const datos = esquemaComun.safeParse(objeto(form));
  if (!datos.success) return { estado: "error", mensaje: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const enlace = detectarEnlace(String(form.get("url") ?? ""));
  if (!enlace || enlace.tipo === "spotify" || enlace.tipo === "apple-podcast") return { estado: "error", mensaje: "Enlace no válido." };

  const supabase = await clienteSupabaseServidor();
  const base = {
    autor: d.autor || null,
    idioma: "es",
    tradicion: d.tradicion || null,
    grupo: d.grupo,
    licencia: LICENCIA_PROPIA,
    nivel_acceso: d.nivelAcceso,
    aprobar_automatico: d.aprobarAutomatico === "on",
    created_by: sesion.usuarioId,
  };

  const altas: { titulo: string; url: string; origen: string; formato: string; referencia: string; extra?: Record<string, unknown> }[] = [];
  if (enlace.tipo === "podcast-rss") {
    // Los episodios se vuelven a leer del feed en el servidor: no se confía en lo que mande el navegador.
    const elegidos = new Set(form.getAll("episodio").map(String));
    if (!elegidos.size) return { estado: "error", mensaje: "Marca al menos un episodio." };
    let p;
    try {
      p = await leerPodcast(enlace.url);
    } catch (e) {
      return { estado: "error", mensaje: e instanceof Error ? e.message : "No se pudo leer el podcast." };
    }
    for (const ep of p.episodios.filter((e) => elegidos.has(e.audio)).slice(0, 100)) {
      altas.push({
        titulo: ep.titulo.slice(0, 300),
        url: ep.audio,
        origen: "podcast",
        formato: "audio",
        referencia: `${p.titulo} (podcast) · ${enlace.url}`.slice(0, 500),
        extra: { idioma: idiomaWhisper(p.idioma), autor: d.autor || p.autor, fecha_publicacion: ep.fecha, duracion_segundos: ep.duracionSegundos, canal: p.titulo.slice(0, 300) },
      });
    }
    if (!altas.length) return { estado: "error", mensaje: "Los episodios elegidos ya no están en el feed." };
  } else if (enlace.tipo === "youtube-video" || enlace.tipo === "youtube-lista") {
    altas.push({
      titulo: d.titulo || enlace.url,
      url: enlace.url,
      origen: "youtube",
      formato: enlace.tipo === "youtube-lista" ? "youtube-lista" : "youtube",
      referencia: enlace.url,
    });
  } else if (enlace.tipo === "audio") {
    altas.push({ titulo: d.titulo || decodeURIComponent(new URL(enlace.url).pathname.split("/").pop() || "Audio"), url: enlace.url, origen: "audio-url", formato: "audio", referencia: enlace.url });
  } else {
    altas.push({ titulo: d.titulo || enlace.url, url: enlace.url, origen: "web", formato: "web", referencia: enlace.url });
  }

  const { data: repetidas } = await supabase.from("sources").select("url").in("url", altas.map((a) => a.url)).neq("estado", "retirado");
  const ya = new Set((repetidas ?? []).map((r) => r.url));
  let agregadas = 0;
  for (const a of altas.filter((x) => !ya.has(x.url))) {
    const id = randomUUID();
    const { error } = await supabase
      .from("sources")
      .insert({ id, ...base, ...a.extra, titulo: a.titulo, referencia: a.referencia, origen: a.origen, formato: a.formato, url: a.url });
    if (error) return { estado: "error", mensaje: "No tienes permiso para agregar fuentes." };
    const { error: errorTrabajo } = await supabase
      .from("ingestion_jobs")
      .insert({ source_id: id, etapa: "extraer", url: a.url, requiere_worker: a.origen !== "web", created_by: sesion.usuarioId });
    if (errorTrabajo) return { estado: "error", mensaje: "No se pudo crear el trabajo de ingesta." };
    agregadas++;
  }
  revalidatePath("/biblioteca");
  const repetidasN = altas.length - agregadas;
  const que =
    enlace.tipo === "youtube-lista" ? "La lista se dividirá en un video por fuente" :
    enlace.tipo === "podcast-rss" ? `${agregadas} episodio${agregadas === 1 ? "" : "s"} en cola` :
    agregadas ? "Enlace en cola" : "Nada nuevo";
  return {
    estado: "listo",
    mensaje: `${que}${repetidasN ? ` (${repetidasN} ya estaba${repetidasN === 1 ? "" : "n"} en la biblioteca)` : ""}. La DGX Spark lo transcribe e indexa; verás el avance en la lista de fuentes.`,
  };
}
