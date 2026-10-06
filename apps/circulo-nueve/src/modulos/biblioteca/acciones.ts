"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datosDe, erroresDe, type EstadoFormulario } from "@/modulos/auth/esquemas";
import { obtenerSesion, type Sesion } from "@/modulos/auth/sesion";
import { clienteSupabaseAdmin, clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { formularioAObjeto } from "@/modulos/expedientes/esquemas";
import { aVector, crearEmbeddingsLocales } from "./embeddings";
import { esquemaEditarFuente, esquemaMetadatos, esquemaPregunta, esquemaWeb } from "./esquemas";
import { EXTENSIONES, LIMITES, detectarFormato, revisarContenidoActivo, type Formato } from "./formatos";
import { procesarSiguiente, type ResultadoTrabajo } from "./ingesta";
import { llmParaBiblioteca, mensajeErrorProveedor } from "./llm";
import { construirMensajes, medirProporcion, respuestaExtractiva, validarRespuesta } from "./respuesta";
import type { LlmProvider } from "@/modulos/proveedores/tipos";
import type { AfirmacionValidada, FragmentoRecuperado, ProporcionAfirmaciones } from "./tipos";

const SIN_PERMISO: EstadoFormulario = { mensaje: "No tienes permiso para administrar la biblioteca." };

async function sesionFuentes(): Promise<Sesion | null> {
  const s = await obtenerSesion();
  return s?.acceso.activo && s.acceso.aal2 && s.acceso.permisos.includes("admin_fuentes") ? s : null;
}

/** Valores enviados (sin archivo ni confirmación de derechos) para rellenar el formulario tras un error. */
function valoresDe(form: FormData): Record<string, string> {
  const { archivo: _archivo, derechos: _derechos, ...resto } = datosDe(form);
  return resto;
}

/** Borra recursivamente los objetos bajo una carpeta de un bucket (Storage no tiene borrado por prefijo). */
async function borrarCarpeta(bucket: string, prefijo: string): Promise<void> {
  const almacen = clienteSupabaseAdmin().storage.from(bucket);
  const { data } = await almacen.list(prefijo, { limit: 1000 });
  const archivos: string[] = [];
  for (const o of data ?? []) {
    const ruta = `${prefijo}/${o.name}`;
    if (o.id === null) await borrarCarpeta(bucket, ruta);
    else archivos.push(ruta);
  }
  if (archivos.length) await almacen.remove(archivos);
}

function metadatosAFila(d: ReturnType<typeof esquemaMetadatos.parse>) {
  return {
    titulo: d.titulo,
    autor: d.autor,
    referencia: d.referencia,
    edicion: d.edicion,
    idioma: d.idioma,
    tradicion: d.tradicion,
    grupo: d.grupo,
    licencia: d.licencia,
    notas_derechos: d.notasDerechos,
    nivel_acceso: d.nivelAcceso,
    es_demo: d.esDemo === "on",
  };
}

async function encolarArchivo(sesion: Sesion, fuenteId: string, archivo: File): Promise<EstadoFormulario | null> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const deteccion = await detectarFormato(bytes, archivo.name);
  if (!deteccion.ok) return { errores: { archivo: deteccion.error } };
  const activo = await revisarContenidoActivo(deteccion.formato, bytes);
  if (activo.rechazar) return { errores: { archivo: activo.motivos.join(" ") } };

  const ruta = `${randomUUID()}.${EXTENSIONES[deteccion.formato][0]}`;
  const { error: errorSubida } = await clienteSupabaseAdmin().storage.from("cuarentena").upload(ruta, bytes, { contentType: deteccion.mime });
  if (errorSubida) return { mensaje: "No se pudo guardar el archivo en cuarentena." };
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase.from("ingestion_jobs").insert({
    source_id: fuenteId,
    etapa: "extraer",
    nombre_archivo: archivo.name.slice(0, 255),
    formato_detectado: deteccion.formato,
    tamano_bytes: bytes.byteLength,
    storage_path: ruta,
    created_by: sesion.usuarioId,
  });
  if (error) {
    await clienteSupabaseAdmin().storage.from("cuarentena").remove([ruta]);
    return { mensaje: "No se pudo crear el trabajo de ingesta." };
  }
  return null;
}

// ---------------------------------------------------------------- alta de fuentes

export async function accionCargarArchivo(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionFuentes();
  if (!sesion) return SIN_PERMISO;
  const datos = esquemaMetadatos.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error), valores: valoresDe(form) };
  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || !archivo.size) return { errores: { archivo: "Elige un archivo." }, valores: valoresDe(form) };

  const id = randomUUID();
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase.from("sources").insert({ id, ...metadatosAFila(datos.data), origen: "archivo", created_by: sesion.usuarioId });
  if (error) return SIN_PERMISO;
  const fallo = await encolarArchivo(sesion, id, archivo);
  if (fallo) {
    await supabase.from("sources").update({ estado: "fallido", motivo_fallo: fallo.errores?.archivo ?? fallo.mensaje }).eq("id", id);
    revalidatePath("/biblioteca");
    return { ...fallo, valores: valoresDe(form) };
  }
  revalidatePath("/biblioteca");
  return { ok: true, mensaje: `«${datos.data.titulo}» quedó en cuarentena, pendiente de procesar.` };
}

export async function accionAgregarWeb(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionFuentes();
  if (!sesion) return SIN_PERMISO;
  const datos = esquemaWeb.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error), valores: valoresDe(form) };
  const id = randomUUID();
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase
    .from("sources")
    .insert({ id, ...metadatosAFila(datos.data), origen: "web", url: datos.data.url, formato: "web", created_by: sesion.usuarioId });
  if (error) return SIN_PERMISO;
  const { error: errorTrabajo } = await supabase
    .from("ingestion_jobs")
    .insert({ source_id: id, etapa: "extraer", url: datos.data.url, created_by: sesion.usuarioId });
  if (errorTrabajo) return { mensaje: "No se pudo crear el trabajo de ingesta." };
  revalidatePath("/biblioteca");
  return { ok: true, mensaje: `Página añadida; pendiente de descargar y revisar.` };
}

/** Procesa en este servidor hasta 5 trabajos. En producción lo hace el worker aparte. */
export async function accionProcesarPendientes(_: EstadoFormulario): Promise<EstadoFormulario & { resultados?: ResultadoTrabajo[] }> {
  if (!(await sesionFuentes())) return SIN_PERMISO;
  const resultados: ResultadoTrabajo[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await procesarSiguiente(clienteSupabaseAdmin());
    if (!r) break;
    resultados.push(r);
  }
  revalidatePath("/biblioteca");
  if (!resultados.length) return { ok: true, mensaje: "No hay trabajos pendientes." };
  return { ok: true, mensaje: resultados.map((r) => `${r.estado}: ${r.mensaje}`).join(" · "), resultados };
}

// ---------------------------------------------------------------- revisión y versiones

export async function accionExcluirFragmento(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionFuentes())) return SIN_PERMISO;
  const id = String(form.get("fragmentoId") ?? "");
  const fuenteId = String(form.get("fuenteId") ?? "");
  const excluir = form.get("excluir") === "1";
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase.from("chunks").update({ excluido: excluir }).eq("id", id).select("id");
  if (error || !data?.length) return SIN_PERMISO;
  revalidatePath(`/biblioteca/fuentes/${fuenteId}`);
  return { ok: true, mensaje: excluir ? "Fragmento excluido: no se indexará." : "Fragmento incluido de nuevo." };
}

export async function accionAprobarVersion(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionFuentes();
  if (!sesion) return SIN_PERMISO;
  const fuenteId = String(form.get("fuenteId") ?? "");
  const versionId = String(form.get("versionId") ?? "");
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase
    .from("ingestion_jobs")
    .insert({ source_id: fuenteId, source_version_id: versionId, etapa: "indexar", created_by: sesion.usuarioId });
  if (error) return SIN_PERMISO;
  await supabase.from("sources").update({ estado: "procesando" }).eq("id", fuenteId);
  revalidatePath(`/biblioteca/fuentes/${fuenteId}`);
  return { ok: true, mensaje: "Versión aprobada: se calcularán los vectores e indexará." };
}

export async function accionRechazarVersion(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionFuentes())) return SIN_PERMISO;
  const fuenteId = String(form.get("fuenteId") ?? "");
  const versionId = String(form.get("versionId") ?? "");
  const admin = clienteSupabaseAdmin();
  const { data: version } = await admin.from("source_versions").select("original_path, markdown_path, es_vigente").eq("id", versionId).eq("source_id", fuenteId).maybeSingle();
  if (!version || version.es_vigente) return { mensaje: "Solo se puede rechazar una versión que aún no está indexada." };
  await admin.from("source_versions").delete().eq("id", versionId);
  if (version.original_path) await admin.storage.from("biblioteca-originales").remove([version.original_path]);
  if (version.markdown_path) await admin.storage.from("biblioteca-derivados").remove([version.markdown_path]);
  await borrarCarpeta("biblioteca-derivados", `${fuenteId}/${versionId}`);
  const { data: vigente } = await admin.from("source_versions").select("id").eq("source_id", fuenteId).eq("es_vigente", true).maybeSingle();
  const supabase = await clienteSupabaseServidor();
  await supabase
    .from("sources")
    .update(vigente ? { estado: "indexado" } : { estado: "fallido", motivo_fallo: "Versión rechazada en la revisión." })
    .eq("id", fuenteId);
  revalidatePath(`/biblioteca/fuentes/${fuenteId}`);
  return { ok: true, mensaje: "Versión rechazada y eliminada." };
}

export async function accionActualizarWeb(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionFuentes();
  if (!sesion) return SIN_PERMISO;
  const fuenteId = String(form.get("fuenteId") ?? "");
  const supabase = await clienteSupabaseServidor();
  const { data: fuente } = await supabase.from("sources").select("url, origen").eq("id", fuenteId).maybeSingle();
  if (!fuente?.url || fuente.origen !== "web") return { mensaje: "Esta fuente no es una página web." };
  const { error } = await supabase.from("ingestion_jobs").insert({ source_id: fuenteId, etapa: "extraer", url: fuente.url, created_by: sesion.usuarioId });
  if (error) return SIN_PERMISO;
  revalidatePath(`/biblioteca/fuentes/${fuenteId}`);
  return { ok: true, mensaje: "Actualización solicitada: se creará una versión nueva para revisar." };
}

export async function accionReemplazarArchivo(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionFuentes();
  if (!sesion) return SIN_PERMISO;
  const fuenteId = String(form.get("fuenteId") ?? "");
  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || !archivo.size) return { errores: { archivo: "Elige un archivo." } };
  const fallo = await encolarArchivo(sesion, fuenteId, archivo);
  if (fallo) return fallo;
  revalidatePath(`/biblioteca/fuentes/${fuenteId}`);
  return { ok: true, mensaje: "Archivo nuevo en cuarentena: al procesarlo se creará otra versión para revisar." };
}

export async function accionEditarFuente(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionFuentes())) return SIN_PERMISO;
  const datos = esquemaEditarFuente.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const { fuenteId, ...resto } = datos.data;
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase
    .from("sources")
    .update(metadatosAFila({ ...resto, derechos: "on" }))
    .eq("id", fuenteId)
    .select("id");
  if (error || !data?.length) return SIN_PERMISO;
  revalidatePath(`/biblioteca/fuentes/${fuenteId}`);
  return { ok: true, mensaje: "Metadatos guardados. El nivel de acceso de los fragmentos ya indexados se mantiene hasta reindexar." };
}

export async function accionRetirarFuente(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionFuentes())) return SIN_PERMISO;
  const fuenteId = String(form.get("fuenteId") ?? "");
  if (String(form.get("confirmacion") ?? "").trim().toUpperCase() !== "RETIRAR") return { errores: { confirmacion: "Escribe RETIRAR para confirmar." } };
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase.from("sources").update({ estado: "retirado" }).eq("id", fuenteId).select("id");
  if (error || !data?.length) return SIN_PERMISO;
  const admin = clienteSupabaseAdmin();
  await admin.from("source_versions").delete().eq("source_id", fuenteId);
  for (const bucket of ["biblioteca-originales", "biblioteca-derivados"]) await borrarCarpeta(bucket, fuenteId);
  revalidatePath("/biblioteca");
  redirect("/biblioteca?retirada=1");
}

// ---------------------------------------------------------------- carga directa a Storage

export interface EstadoCargaDirecta extends EstadoFormulario {
  fuenteId?: string;
  ruta?: string;
  token?: string;
}

/**
 * Archivos grandes: el servidor valida metadatos y permisos, crea la fuente y
 * entrega una URL firmada de subida a la cuarentena (válida 2 h). El navegador
 * sube el archivo directamente a Storage y después pide confirmar.
 */
export async function accionPrepararCargaDirecta(form: FormData): Promise<EstadoCargaDirecta> {
  const sesion = await sesionFuentes();
  if (!sesion) return SIN_PERMISO;
  const datos = esquemaMetadatos.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error), valores: valoresDe(form) };
  const nombre = String(form.get("nombreArchivo") ?? "").slice(0, 255);
  const tamano = Number(form.get("tamanoArchivo") ?? 0);
  const extension = nombre.toLowerCase().split(".").pop() ?? "";
  const formato = (Object.entries(EXTENSIONES) as [Formato, string[]][]).find(([, exts]) => exts.includes(extension))?.[0];
  if (!formato) return { errores: { archivo: `La extensión «.${extension}» no se admite.` }, valores: valoresDe(form) };
  if (!tamano || tamano > LIMITES.bytesCargaDirecta) {
    return { errores: { archivo: `El archivo supera el límite de ${LIMITES.bytesCargaDirecta / 1024 / 1024} MB.` }, valores: valoresDe(form) };
  }

  const fuenteId = randomUUID();
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase.from("sources").insert({ id: fuenteId, ...metadatosAFila(datos.data), origen: "archivo", formato, created_by: sesion.usuarioId });
  if (error) return SIN_PERMISO;
  const ruta = `${fuenteId}.${extension}`;
  const { data: firmada, error: errorFirma } = await clienteSupabaseAdmin().storage.from("cuarentena").createSignedUploadUrl(ruta);
  if (errorFirma || !firmada) return { mensaje: "No se pudo preparar la carga directa." };
  return { ok: true, fuenteId, ruta, token: firmada.token };
}

export async function accionConfirmarCargaDirecta(fuenteId: string, nombreArchivo: string): Promise<EstadoFormulario> {
  const sesion = await sesionFuentes();
  if (!sesion) return SIN_PERMISO;
  const supabase = await clienteSupabaseServidor();
  const { data: fuente } = await supabase.from("sources").select("id, estado, formato").eq("id", fuenteId).maybeSingle();
  if (!fuente || fuente.estado !== "pendiente") return { mensaje: "La fuente no está esperando un archivo." };
  const extension = EXTENSIONES[fuente.formato as Formato]?.find((e) => nombreArchivo.toLowerCase().endsWith(`.${e}`));
  if (!extension) return { mensaje: "El archivo no coincide con el preparado." };

  const ruta = `${fuenteId}.${extension}`;
  const admin = clienteSupabaseAdmin();
  const fallar = async (motivo: string) => {
    await admin.storage.from("cuarentena").remove([ruta]);
    await supabase.from("sources").update({ estado: "fallido", motivo_fallo: motivo }).eq("id", fuenteId);
    revalidatePath("/biblioteca");
    return { errores: { archivo: motivo } };
  };
  const { data: blob } = await admin.storage.from("cuarentena").download(ruta);
  if (!blob) return fallar("No llegó el archivo a la cuarentena.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const deteccion = await detectarFormato(bytes, nombreArchivo, LIMITES.bytesCargaDirecta);
  if (!deteccion.ok) return fallar(deteccion.error);
  const activo = await revisarContenidoActivo(deteccion.formato, bytes);
  if (activo.rechazar) return fallar(activo.motivos.join(" "));

  const { error } = await supabase.from("ingestion_jobs").insert({
    source_id: fuenteId,
    etapa: "extraer",
    nombre_archivo: nombreArchivo.slice(0, 255),
    formato_detectado: deteccion.formato,
    tamano_bytes: bytes.byteLength,
    storage_path: ruta,
    created_by: sesion.usuarioId,
  });
  if (error) return fallar("No se pudo crear el trabajo de ingesta.");
  revalidatePath("/biblioteca");
  return { ok: true, mensaje: `Archivo de ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB subido directamente a la cuarentena, pendiente de procesar.` };
}

export async function accionCorregirFigura(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionFuentes())) return SIN_PERMISO;
  const figuraId = String(form.get("figuraId") ?? "");
  const fuenteId = String(form.get("fuenteId") ?? "");
  const correccion = String(form.get("correccion") ?? "").trim().slice(0, 2000) || null;
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase.from("visual_assets").update({ correccion_admin: correccion }).eq("id", figuraId).select("id");
  if (error || !data?.length) return SIN_PERMISO;
  revalidatePath(`/biblioteca/fuentes/${fuenteId}`);
  return { ok: true, mensaje: correccion ? "Corrección guardada; se muestra junto a la descripción generada." : "Corrección eliminada." };
}

// ---------------------------------------------------------------- bot de la biblioteca

export interface RespuestaBiblioteca {
  estado: "ok" | "sin_aportadas" | "sin_resultados" | "error";
  mensaje?: string;
  modo?: "extractivo" | "llm";
  proveedor?: string;
  afirmaciones?: AfirmacionValidada[];
  fragmentos?: FragmentoRecuperado[];
  /** Figura vinculada a un fragmento citado (por id de fragmento). */
  figuras?: Record<string, { figuraId: string; pagina: string | null; leyenda: string | null; correccion: string | null }>;
  proporcion?: ProporcionAfirmaciones;
  incluyoComplementarias?: boolean;
  errores?: Record<string, string>;
}

interface FilaBusqueda {
  chunk_id: string;
  source_id: string;
  titulo: string;
  autor: string | null;
  referencia: string;
  edicion: string | null;
  fecha_consulta: string | null;
  grupo: "aportada" | "complementaria";
  es_demo: boolean;
  texto: string;
  localizador: FragmentoRecuperado["localizador"];
  jerarquia: string[];
  sospechoso: boolean;
  ocr_confianza: number | null;
  puntaje: number;
}

let embeddingsConsulta: ReturnType<typeof crearEmbeddingsLocales> | null = null;

export async function accionPreguntarBiblioteca(_: RespuestaBiblioteca, form: FormData): Promise<RespuestaBiblioteca> {
  const sesion = await obtenerSesion();
  if (!sesion?.acceso.activo) return { estado: "error", mensaje: "Entra con una cuenta activa para consultar la biblioteca." };
  const datos = esquemaPregunta.safeParse(formularioAObjeto(form));
  if (!datos.success) return { estado: "error", errores: erroresDe(datos.error) };
  const { pregunta } = datos.data;
  const incluir = datos.data.incluirComplementarias === "on";

  embeddingsConsulta ??= crearEmbeddingsLocales();
  const vector = aVector(await embeddingsConsulta.embeberConsulta(pregunta));
  const supabase = await clienteSupabaseServidor();
  const buscar = async (grupo: string | null) => {
    const { data } = await supabase.rpc("hybrid_search", { query_text: pregunta, query_embedding: vector, match_count: 6, filtro_grupo: grupo });
    return ((data ?? []) as FilaBusqueda[]).map(
      (f): FragmentoRecuperado => ({
        chunkId: f.chunk_id,
        fuenteId: f.source_id,
        titulo: f.titulo,
        autor: f.autor,
        referencia: f.referencia,
        edicion: f.edicion,
        fechaConsulta: f.fecha_consulta,
        grupo: f.grupo,
        esDemo: f.es_demo,
        texto: f.texto,
        localizador: f.localizador,
        jerarquia: f.jerarquia,
        sospechoso: f.sospechoso,
        ocrConfianza: f.ocr_confianza,
        puntaje: f.puntaje,
      }),
    );
  };

  // Las fuentes aportadas van primero; las complementarias solo con autorización explícita.
  const aportadas = await buscar("aportada");
  if (!aportadas.length && !incluir) {
    return { estado: "sin_aportadas", mensaje: "No encontré respaldo en las fuentes aportadas por el propietario." };
  }
  const recuperados = incluir ? await buscar(null) : aportadas;
  const proveedorId = String(form.get("proveedorId") ?? "");
  let llm: LlmProvider | null = null;
  if (proveedorId) {
    const elegido = await llmParaBiblioteca({ proveedorId, consentido: datos.data.enviarALlm === "on", pregunta, usuarioId: sesion.usuarioId });
    if (!elegido.ok) return { estado: "error", mensaje: elegido.mensaje };
    llm = elegido.llm;
  }
  const usarLlm = llm !== null;
  // Los fragmentos marcados como posible instrucción incrustada nunca se envían a un LLM;
  // en modo extractivo se muestran con aviso porque solo se citan literalmente.
  const utilizables = usarLlm ? recuperados.filter((f) => !f.sospechoso) : recuperados;
  if (!utilizables.length) return { estado: "sin_resultados", mensaje: "No encontré fragmentos que respondan a la pregunta.", incluyoComplementarias: incluir };

  let afirmaciones: AfirmacionValidada[];
  let modo: RespuestaBiblioteca["modo"] = "extractivo";
  let aviso: string | undefined;
  if (llm) {
    try {
      const salida = await llm.completar({ mensajes: construirMensajes(pregunta, utilizables), respuestaJson: true, temperatura: 0.2, maxTokens: 1200 });
      afirmaciones = validarRespuesta(salida.texto, utilizables);
      modo = "llm";
    } catch (e) {
      const mensaje = mensajeErrorProveedor(e);
      if (!mensaje) throw e;
      aviso = `${mensaje} Se muestran citas literales de las fuentes.`;
      afirmaciones = respuestaExtractiva(recuperados);
    }
  } else {
    afirmaciones = respuestaExtractiva(utilizables);
  }
  const citados = new Set(afirmaciones.flatMap((a) => a.chunkIds));
  const { data: filasFiguras } = await supabase.rpc("figuras_de_fragmentos", { ids: [...citados] });
  const figuras = Object.fromEntries(
    ((filasFiguras ?? []) as { chunk_id: string; figura_id: string; pagina: string | null; leyenda: string | null; correccion: string | null }[]).map((f) => [
      f.chunk_id,
      { figuraId: f.figura_id, pagina: f.pagina, leyenda: f.leyenda, correccion: f.correccion },
    ]),
  );
  return {
    figuras,
    estado: "ok",
    mensaje: aviso,
    modo,
    proveedor: modo === "llm" && llm ? `${llm.nombre} (${llm.modelo})` : undefined,
    afirmaciones,
    fragmentos: recuperados.filter((f) => citados.has(f.chunkId)),
    proporcion: medirProporcion(afirmaciones, recuperados),
    incluyoComplementarias: incluir,
  };
}
