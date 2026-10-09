/**
 * Worker de ingesta. Corre con la llave de servicio, fuera del navegador: como
 * proceso aparte (`npm run ingesta:worker`) o invocado por la administración
 * desde la app. No importa nada de Next para poder ejecutarse con Node a secas.
 */
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { diffLines } from "diff";
import { aVector, crearEmbeddingsLocales, type ProveedorEmbeddings } from "./embeddings";
import { extraerDocumento, ocrImagen } from "./extraer";
import { describirConVision, describirSinVision, proveedorVisionConfigurado, type DescripcionFigura } from "./figuras";
import { EXTENSIONES, LIMITES, detectarFormato, revisarContenidoActivo, type Formato } from "./formatos";
import { fragmentar } from "./fragmentar";
import { detectarInyeccion } from "./inyeccion";
import type { DocumentoExtraido } from "./tipos";
import { ErrorWeb, obtenerPaginaWeb } from "./web";

const ejecutar = promisify(execFile);

export function clienteServicio(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !llave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface Trabajo {
  id: string;
  source_id: string;
  etapa: "extraer" | "indexar";
  storage_path: string | null;
  url: string | null;
  nombre_archivo: string | null;
  source_version_id: string | null;
}

export interface ResultadoTrabajo {
  trabajoId: string;
  fuenteId: string;
  etapa: string;
  estado: "requiere_revision" | "indexado" | "fallido";
  mensaje: string;
}

class ErrorIngesta extends Error {}

export type Ejecutor = (programa: string, args: string[]) => Promise<{ stdout: string }>;

/**
 * Escaneo con ClamAV si está instalado (prefiere `clamdscan`, el demonio, y si no
 * `clamscan`). Con CLAMAV_OBLIGATORIO=1, un escáner ausente o con error rechaza el
 * archivo; si no, se deja una advertencia. Código 1 de ClamAV = amenaza encontrada.
 */
export async function antivirus(
  bytes: Uint8Array,
  opciones: { obligatorio?: boolean; ejecutar?: Ejecutor } = {},
): Promise<string | null> {
  const correr: Ejecutor = opciones.ejecutar ?? ((p, a) => ejecutar(p, a, { maxBuffer: 1024 * 1024 }));
  const obligatorio = opciones.obligatorio ?? process.env.CLAMAV_OBLIGATORIO === "1";
  let escaner: string | null = null;
  for (const candidato of ["clamdscan", "clamscan"]) {
    try {
      await correr(candidato, ["--version"]);
      escaner = candidato;
      break;
    } catch {
      // probar el siguiente
    }
  }
  if (!escaner) {
    if (obligatorio) throw new ErrorIngesta("El antivirus es obligatorio en este entorno y ClamAV no está instalado.");
    return "Antivirus (ClamAV) no disponible en este entorno: el archivo no se escaneó.";
  }
  const { writeFile, rm } = await import("node:fs/promises");
  const ruta = `/tmp/cn-${randomUUID()}`;
  await writeFile(ruta, bytes);
  try {
    await correr(escaner, ["--no-summary", ...(escaner === "clamdscan" ? ["--fdpass"] : []), ruta]);
    return null;
  } catch (e) {
    const codigo = (e as { code?: number }).code;
    const salida = String((e as { stdout?: string }).stdout ?? "");
    if (codigo === 1) throw new ErrorIngesta(`El antivirus detectó contenido malicioso${/: (.+) FOUND/.exec(salida)?.[1] ? ` (${/: (.+) FOUND/.exec(salida)?.[1]})` : ""}.`);
    if (obligatorio) throw new ErrorIngesta("El antivirus no pudo analizar el archivo.");
    return "El antivirus no pudo analizar el archivo (¿base de firmas sin descargar?).";
  } finally {
    await rm(ruta, { force: true });
  }
}

function resumenDiff(anterior: string | null, nuevo: string): string | null {
  if (anterior === null) return null;
  const partes = diffLines(anterior, nuevo);
  const sumadas = partes.filter((p) => p.added).reduce((n, p) => n + (p.count ?? 0), 0);
  const quitadas = partes.filter((p) => p.removed).reduce((n, p) => n + (p.count ?? 0), 0);
  const detalle = partes
    .filter((p) => p.added || p.removed)
    .flatMap((p) => p.value.split("\n").filter(Boolean).map((l) => `${p.added ? "+" : "-"} ${l}`))
    .slice(0, 200)
    .join("\n");
  return `+${sumadas} líneas, −${quitadas} líneas respecto a la versión anterior\n${detalle}`;
}

async function marcarFallo(db: SupabaseClient, t: Trabajo, mensaje: string): Promise<ResultadoTrabajo> {
  await db.from("ingestion_jobs").update({ estado: "fallido", errores: [mensaje], terminado_at: new Date().toISOString() }).eq("id", t.id);
  await db.from("sources").update({ estado: "fallido", motivo_fallo: mensaje }).eq("id", t.source_id);
  if (t.storage_path) await db.storage.from("cuarentena").remove([t.storage_path]);
  return { trabajoId: t.id, fuenteId: t.source_id, etapa: t.etapa, estado: "fallido", mensaje };
}

async function extraer(db: SupabaseClient, t: Trabajo): Promise<ResultadoTrabajo> {
  const { data: fuente } = await db.from("sources").select("*").eq("id", t.source_id).single();
  if (!fuente) throw new ErrorIngesta("La fuente ya no existe.");
  await db.from("sources").update({ estado: "procesando", motivo_fallo: null }).eq("id", t.source_id);

  let documento: DocumentoExtraido;
  let original: Uint8Array | null = null;
  let formato: Formato | "web";
  const advertencias: string[] = [];

  if (t.url) {
    formato = "web";
    try {
      documento = await obtenerPaginaWeb(t.url, { permitirLocales: process.env.INGESTA_PERMITIR_HOSTS_LOCALES === "1" });
    } catch (e) {
      if (e instanceof ErrorWeb) {
        throw new ErrorIngesta(`${e.message}${e.soloMetadatos ? " Se conservan solo los metadatos y el enlace." : ""}`);
      }
      throw e;
    }
    const m = documento.metadatos ?? {};
    await db
      .from("sources")
      .update({
        url: m.urlCanonica ?? t.url,
        autor: fuente.autor ?? m.autor ?? null,
        fecha_publicacion: fuente.fecha_publicacion ?? m.fechaPublicacion ?? null,
        fecha_consulta: new Date().toISOString().slice(0, 10),
        idioma: m.idioma?.slice(0, 2) ?? fuente.idioma,
        formato: "web",
      })
      .eq("id", t.source_id);
  } else {
    if (!t.storage_path) throw new ErrorIngesta("El trabajo no tiene archivo.");
    const { data: blob, error } = await db.storage.from("cuarentena").download(t.storage_path);
    if (error || !blob) throw new ErrorIngesta("No se encontró el archivo en cuarentena.");
    original = new Uint8Array(await blob.arrayBuffer());
    const deteccion = await detectarFormato(original, t.nombre_archivo ?? t.storage_path, LIMITES.bytesCargaDirecta);
    if (!deteccion.ok) throw new ErrorIngesta(deteccion.error);
    formato = deteccion.formato;
    const activo = await revisarContenidoActivo(formato, original);
    if (activo.rechazar) throw new ErrorIngesta(activo.motivos.join(" "));
    const aviso = await antivirus(original);
    if (aviso) advertencias.push(aviso);
    documento = await extraerDocumento(formato, original, t.nombre_archivo ?? undefined).catch((e: unknown) => {
      throw new ErrorIngesta(e instanceof Error ? e.message : "No se pudo extraer el contenido.");
    });
  }
  advertencias.push(...documento.advertencias);

  const huella = createHash("sha256").update(original ?? documento.markdown).digest("hex");
  const { data: repetida } = await db.from("source_versions").select("id").eq("source_id", t.source_id).eq("sha256", huella).maybeSingle();
  if (repetida) {
    await db.from("ingestion_jobs").update({ estado: "indexado", errores: ["Sin cambios respecto a una versión existente."], terminado_at: new Date().toISOString() }).eq("id", t.id);
    const { data: vigente } = await db.from("source_versions").select("id").eq("source_id", t.source_id).eq("es_vigente", true).maybeSingle();
    await db.from("sources").update({ estado: vigente ? "indexado" : "requiere_revision" }).eq("id", t.source_id);
    if (t.storage_path) await db.storage.from("cuarentena").remove([t.storage_path]);
    return { trabajoId: t.id, fuenteId: t.source_id, etapa: t.etapa, estado: "indexado", mensaje: "Sin cambios: el contenido ya estaba en una versión anterior." };
  }

  const fragmentos = fragmentar(documento.segmentos);
  if (!fragmentos.length) throw new ErrorIngesta("No se extrajo texto. Revisa el archivo o súbelo en otro formato.");

  const { data: anterior } = await db.from("source_versions").select("markdown_path").eq("source_id", t.source_id).eq("es_vigente", true).maybeSingle();
  let markdownAnterior: string | null = null;
  if (anterior?.markdown_path) {
    const { data } = await db.storage.from("biblioteca-derivados").download(anterior.markdown_path);
    markdownAnterior = data ? await data.text() : null;
  }

  const versionId = randomUUID();
  const extension = formato === "web" ? null : EXTENSIONES[formato][0];
  const rutaOriginal = extension ? `${t.source_id}/${versionId}.${extension}` : null;
  const rutaMarkdown = `${t.source_id}/${versionId}.md`;
  if (original && rutaOriginal) {
    const { error } = await db.storage.from("biblioteca-originales").upload(rutaOriginal, original, { upsert: false });
    if (error) throw new ErrorIngesta(`No se pudo guardar el original: ${error.message}`);
  }
  await db.storage.from("biblioteca-derivados").upload(rutaMarkdown, new TextEncoder().encode(documento.markdown), { contentType: "text/markdown", upsert: false });

  const { error: errorVersion } = await db.from("source_versions").insert({
    id: versionId,
    source_id: t.source_id,
    sha256: huella,
    metodo_extraccion: documento.metodo,
    es_vigente: false,
    original_path: rutaOriginal,
    markdown_path: rutaMarkdown,
    num_fragmentos: fragmentos.length,
    advertencias,
    diff_resumen: resumenDiff(markdownAnterior, documento.markdown),
  });
  if (errorVersion) throw new ErrorIngesta(`No se pudo registrar la versión: ${errorVersion.message}`);

  for (let i = 0; i < fragmentos.length; i += 200) {
    const { error } = await db.from("chunks").insert(
      fragmentos.slice(i, i + 200).map((f) => ({
        source_version_id: versionId,
        texto: f.texto,
        localizador: f.localizador,
        jerarquia: f.jerarquia,
        ocr_confianza: f.ocrConfianza ?? null,
        idioma: fuente.idioma,
        tradicion: fuente.tradicion,
        nivel_acceso: fuente.nivel_acceso,
        orden: f.orden,
        sospechoso: f.sospechoso,
        motivo_sospecha: f.motivoSospecha ?? null,
      })),
    );
    if (error) throw new ErrorIngesta(`No se pudieron guardar los fragmentos: ${error.message}`);
  }

  const figuras = await guardarFiguras(db, documento, { fuenteId: t.source_id, versionId, ordenInicial: fragmentos.length, fuente });
  advertencias.push(...figuras.avisos);

  if (t.storage_path) await db.storage.from("cuarentena").remove([t.storage_path]);
  await db
    .from("ingestion_jobs")
    .update({
      estado: "requiere_revision",
      source_version_id: versionId,
      formato_detectado: formato,
      tamano_bytes: original?.byteLength ?? documento.markdown.length,
      elementos_extraidos: fragmentos.length,
      errores: advertencias,
      terminado_at: new Date().toISOString(),
    })
    .eq("id", t.id);
  await db.from("sources").update({ estado: "requiere_revision", formato }).eq("id", t.source_id);
  const sospechosos = fragmentos.filter((f) => f.sospechoso).length;
  return {
    trabajoId: t.id,
    fuenteId: t.source_id,
    etapa: t.etapa,
    estado: "requiere_revision",
    mensaje: `${fragmentos.length + figuras.total} fragmentos listos para revisión${figuras.total ? `, ${figuras.total} de figuras` : ""}${sospechosos ? ` (${sospechosos} marcados como posible instrucción incrustada)` : ""}.`,
  };
}

/**
 * Figuras de PDF: OCR de rótulos, descripción (visión solo si está configurada y
 * declarada; si no, leyenda + OCR), imagen en el bucket privado de derivados y un
 * fragmento consultable vinculado a la figura.
 */
async function guardarFiguras(
  db: SupabaseClient,
  documento: DocumentoExtraido,
  c: { fuenteId: string; versionId: string; ordenInicial: number; fuente: { idioma: string; tradicion: string | null; nivel_acceso: string } },
): Promise<{ total: number; avisos: string[] }> {
  const figuras = documento.figuras ?? [];
  if (!figuras.length) return { total: 0, avisos: [] };
  const avisos: string[] = [];
  const vision = await proveedorVisionConfigurado(db).catch(() => null);
  for (const f of figuras) {
    const ocr = await ocrImagen(f.png).catch(() => ({ texto: "", confianza: 0 }));
    let descripcion: DescripcionFigura = describirSinVision({ numero: f.numero, pagina: f.pagina, leyenda: f.leyenda, ocr: ocr.texto, confianzaOcr: ocr.texto ? ocr.confianza : undefined });
    if (vision) {
      try {
        descripcion = await describirConVision(f.png, vision, { leyenda: f.leyenda }, {
          registrar: async (r) => {
            await db.from("ai_usage").insert({
              provider_id: vision.proveedor.id,
              modelo: vision.proveedor.modelo,
              codigo_resultado: r.codigo,
              intento: 1,
              latencia_ms: r.latenciaMs,
              tokens_entrada: r.tokensEntrada ?? null,
              tokens_salida: r.tokensSalida ?? null,
              origen: "biblioteca",
            });
          },
        });
      } catch (e) {
        avisos.push(`Figura ${f.numero}: ${e instanceof Error ? e.message : "fallo del modelo de visión"}; se usó la leyenda y el OCR.`);
      }
    }
    const ruta = `${c.fuenteId}/${c.versionId}/figura-${f.numero}.png`;
    const { error: errorImagen } = await db.storage.from("biblioteca-derivados").upload(ruta, f.png, { contentType: "image/png", upsert: false });
    if (errorImagen) throw new ErrorIngesta(`No se pudo guardar la figura ${f.numero}: ${errorImagen.message}`);
    const figuraId = randomUUID();
    const fragmentoId = randomUUID();
    await db.from("visual_assets").insert({
      id: figuraId,
      source_version_id: c.versionId,
      storage_path: ruta,
      pagina: String(f.pagina),
      leyenda: f.leyenda ?? null,
      ocr: ocr.texto || null,
      descripcion_generada: descripcion.descripcion,
      descripcion_modelo: descripcion.modelo,
      descripcion_fecha: new Date().toISOString(),
    });
    const texto = `[Figura ${f.numero}, p. ${f.pagina}] ${descripcion.descripcion}`;
    const inyeccion = detectarInyeccion(`${f.leyenda ?? ""} ${ocr.texto} ${descripcion.descripcion}`);
    const { error } = await db.from("chunks").insert({
      id: fragmentoId,
      source_version_id: c.versionId,
      texto,
      localizador: { paginaArchivo: f.pagina, figura: String(f.numero) },
      jerarquia: [`Figura ${f.numero}`],
      ocr_confianza: ocr.texto ? ocr.confianza : null,
      idioma: c.fuente.idioma,
      tradicion: c.fuente.tradicion,
      nivel_acceso: c.fuente.nivel_acceso,
      orden: c.ordenInicial + f.numero - 1,
      sospechoso: inyeccion.sospechoso || descripcion.avisos.length > 0,
      motivo_sospecha: [...inyeccion.motivos, ...descripcion.avisos].join("; ") || null,
    });
    if (error) throw new ErrorIngesta(`No se pudo guardar el fragmento de la figura ${f.numero}: ${error.message}`);
    await db.from("chunk_visual_links").insert({ chunk_id: fragmentoId, visual_asset_id: figuraId });
  }
  await db.from("source_versions").update({ num_fragmentos: c.ordenInicial + figuras.length }).eq("id", c.versionId);
  return { total: figuras.length, avisos };
}

async function indexar(db: SupabaseClient, t: Trabajo, embeddings: ProveedorEmbeddings): Promise<ResultadoTrabajo> {
  if (!t.source_version_id) throw new ErrorIngesta("El trabajo de indexado no indica la versión.");
  const { data: fragmentos } = await db
    .from("chunks")
    .select("id, texto")
    .eq("source_version_id", t.source_version_id)
    .eq("excluido", false)
    .order("orden");
  const lista = fragmentos ?? [];
  const vectores = await embeddings.embeberPasajes(lista.map((f) => f.texto));
  for (let i = 0; i < lista.length; i++) {
    const { error } = await db.from("chunks").update({ embedding: aVector(vectores[i]), embedding_model: embeddings.modelo }).eq("id", lista[i].id);
    if (error) throw new ErrorIngesta(`No se pudo guardar el vector: ${error.message}`);
  }
  await db.from("source_versions").update({ es_vigente: false }).eq("source_id", t.source_id).neq("id", t.source_version_id);
  await db.from("source_versions").update({ es_vigente: true }).eq("id", t.source_version_id);
  await db.from("ingestion_jobs").update({ estado: "indexado", elementos_extraidos: lista.length, terminado_at: new Date().toISOString() }).eq("id", t.id);
  await db.from("sources").update({ estado: "indexado", motivo_fallo: null }).eq("id", t.source_id);
  return { trabajoId: t.id, fuenteId: t.source_id, etapa: t.etapa, estado: "indexado", mensaje: `${lista.length} fragmentos indexados con ${embeddings.modelo}.` };
}

let embeddingsCompartidos: ProveedorEmbeddings | null = null;

/** Toma el siguiente trabajo pendiente (atómico) y lo procesa. Devuelve null si no hay. */
export async function procesarSiguiente(db = clienteServicio(), embeddings?: ProveedorEmbeddings): Promise<ResultadoTrabajo | null> {
  const { data, error } = await db.rpc("tomar_trabajo_ingesta");
  if (error) throw new Error(`No se pudo tomar un trabajo: ${error.message}`);
  const t = (data as Trabajo[] | null)?.[0];
  if (!t) return null;
  try {
    if (t.etapa === "indexar") {
      embeddingsCompartidos ??= crearEmbeddingsLocales();
      return await indexar(db, t, embeddings ?? embeddingsCompartidos);
    }
    return await extraer(db, t);
  } catch (e) {
    const mensaje = e instanceof ErrorIngesta ? e.message : `Error inesperado: ${e instanceof Error ? e.message : String(e)}`;
    return marcarFallo(db, t, mensaje);
  }
}
