"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calcularNumerologia, crearConfig, type ResultadoNumerologia } from "@/modulos/calculo/numerologia";
import { erroresDe, type EstadoFormulario } from "@/modulos/auth/esquemas";
import { esAdmin, obtenerSesion, type Sesion } from "@/modulos/auth/sesion";
import { clienteSupabaseAdmin, clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import type { ResultadoCarta } from "@/modulos/calculo/astrologia";
import { generarReportePdf, reporteDeCartaNatal, reporteDeNumerologia } from "@/reportes";
import { consumirLimite, mensajeEspera } from "@/modulos/seguridad/limite-frecuencia";
import { borrarArchivosDeExpediente } from "./consultas";
import {
  CONSENTIMIENTOS,
  VERSION_TEXTO_CONSENTIMIENTO,
  esquemaAjustes,
  esquemaAviso,
  esquemaClienteVinculado,
  esquemaEditarExpediente,
  esquemaIdDocumento,
  esquemaIdExpediente,
  esquemaIdLectura,
  esquemaLectura,
  esquemaNuevoExpediente,
  esquemaPerfil,
  esquemaPermisoArchivo,
  esquemaPermisoExpediente,
  esquemaRetirarPermiso,
  formularioAObjeto,
} from "./esquemas";

const SIN_PERMISO: EstadoFormulario = { mensaje: "No tienes permiso para hacer esto en este expediente." };
const ERROR_GENERICO: EstadoFormulario = { mensaje: "No se pudo completar la operación. Inténtalo de nuevo." };

function mensajeDeError(error: { code?: string } | null): EstadoFormulario {
  if (error?.code === "CN001") {
    return { mensaje: "Falta el consentimiento correspondiente en este expediente. Actívalo en «Consentimientos» y vuelve a intentarlo." };
  }
  if (error?.code === "42501") return SIN_PERMISO;
  return ERROR_GENERICO;
}

async function sesionActiva(): Promise<Sesion | null> {
  const sesion = await obtenerSesion();
  return sesion?.acceso.activo ? sesion : null;
}

async function sesionAdmin(): Promise<Sesion | null> {
  const sesion = await sesionActiva();
  return sesion && esAdmin(sesion) && sesion.acceso.permisos.includes("admin_usuarios") ? sesion : null;
}

function rutaExpediente(id: string) {
  return `/expedientes/${id}`;
}

// ---------------------------------------------------------------- expediente

export async function accionCrearExpediente(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionActiva();
  if (!sesion) return SIN_PERMISO;
  const datos = esquemaNuevoExpediente.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  // Sin «returning»: la política de lectura usa has_case_perm, que no ve la fila
  // nueva dentro de la misma sentencia. El id se genera aquí.
  const id = randomUUID();
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase
    .from("case_files")
    .insert({ id, display_label: datos.data.etiqueta, created_by: sesion.usuarioId, es_demo: datos.data.esDemo === "on" });
  if (error) return mensajeDeError(error);
  redirect(rutaExpediente(id));
}

export async function accionEditarExpediente(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionActiva())) return SIN_PERMISO;
  const datos = esquemaEditarExpediente.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase
    .from("case_files")
    .update({ display_label: datos.data.etiqueta })
    .eq("id", datos.data.expedienteId)
    .select("id");
  if (error || !data?.length) return error ? mensajeDeError(error) : SIN_PERMISO;
  revalidatePath(rutaExpediente(datos.data.expedienteId));
  return { ok: true, mensaje: "Expediente actualizado." };
}

export async function accionVincularCliente(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionAdmin())) return SIN_PERMISO;
  const datos = esquemaClienteVinculado.safeParse(formularioAObjeto(form));
  if (!datos.success) return ERROR_GENERICO;
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase
    .from("case_files")
    .update({ client_user_id: datos.data.clienteId })
    .eq("id", datos.data.expedienteId)
    .select("id");
  if (error || !data?.length) return error ? mensajeDeError(error) : SIN_PERMISO;
  revalidatePath(rutaExpediente(datos.data.expedienteId));
  return { ok: true, mensaje: datos.data.clienteId ? "Cuenta cliente vinculada." : "Cuenta cliente desvinculada." };
}

export async function accionBorrarExpediente(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionActiva())) return SIN_PERMISO;
  const datos = esquemaIdExpediente.safeParse(formularioAObjeto(form));
  if (!datos.success) return ERROR_GENERICO;
  if (datos.data.confirmacion?.trim().toUpperCase() !== "BORRAR") {
    return { errores: { confirmacion: "Escribe BORRAR para confirmar." } };
  }
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase.from("case_files").delete().eq("id", datos.data.expedienteId).select("id");
  if (error || !data?.length) return error ? mensajeDeError(error) : SIN_PERMISO;
  await borrarArchivosDeExpediente(datos.data.expedienteId);
  revalidatePath("/expedientes");
  redirect("/expedientes?borrado=1");
}

// ---------------------------------------------------------------- consentimientos y perfil

export async function accionGuardarConsentimientos(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionActiva())) return SIN_PERMISO;
  const expedienteId = String(form.get("expedienteId") ?? "");
  if (!esquemaIdExpediente.safeParse({ expedienteId }).success) return ERROR_GENERICO;
  const supabase = await clienteSupabaseServidor();

  const cambios = [];
  for (const { tipo } of CONSENTIMIENTOS) {
    const quiere = form.get(tipo) === "on";
    const { data: vigente } = await supabase.rpc("consentimiento_vigente", { case_id: expedienteId, p_tipo: tipo });
    if (vigente !== quiere) {
      cambios.push({ case_file_id: expedienteId, tipo, otorgado: quiere, version_texto: VERSION_TEXTO_CONSENTIMIENTO });
    }
  }
  if (!cambios.length) return { ok: true, mensaje: "Sin cambios." };
  const { error } = await supabase.from("consents").insert(cambios);
  if (error) return mensajeDeError(error);
  revalidatePath(rutaExpediente(expedienteId));
  return { ok: true, mensaje: "Consentimientos guardados. Cada cambio queda registrado con su fecha." };
}

export async function accionGuardarPerfil(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionActiva())) return SIN_PERMISO;
  const datos = esquemaPerfil.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const d = datos.data;
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase.from("birth_profiles").upsert(
    {
      case_file_id: d.expedienteId,
      birth_name: d.nombreNacimiento,
      preferred_name: d.nombrePreferido,
      birth_date: d.fecha,
      birth_time: d.hora,
      birth_time_precision: d.precisionHora,
      birth_place: d.lugar,
      tz_id: d.zonaHoraria,
      tz_source: d.zonaHoraria ? "indicada por la persona" : null,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "case_file_id" },
  );
  if (error) return mensajeDeError(error);
  revalidatePath(rutaExpediente(d.expedienteId));
  return { ok: true, mensaje: "Perfil guardado." };
}

// ---------------------------------------------------------------- lecturas

export async function accionGuardarLectura(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionActiva();
  if (!sesion) return SIN_PERMISO;
  const datos = esquemaLectura.safeParse(formularioAObjeto(form));
  if (!datos.success) return ERROR_GENERICO;
  const d = datos.data;
  const config = crearConfig({
    numerosMaestros: d.numerosMaestros === "on",
    y: d.y,
    enye: d.enye,
    metodoCaminoDeVida: d.metodoCaminoDeVida,
    metodoNombre: d.metodoNombre,
  });
  const resultado = calcularNumerologia({ nombre: d.nombre, fecha: d.fecha }, config);
  if (!resultado.ok) return { mensaje: resultado.errores.join(" ") };

  const huella = createHash("sha256").update(JSON.stringify({ entradas: resultado.entradas, reglas: resultado.reglas })).digest("hex");
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase.from("readings").insert({
    case_file_id: d.expedienteId,
    sistema: "numerologia",
    motor: resultado.motor,
    motor_version: resultado.motorVersion,
    reglas_version: resultado.reglasVersion,
    entradas_hash: huella,
    resultado_calculado: resultado,
    created_by: sesion.usuarioId,
  });
  if (error) return mensajeDeError(error);
  revalidatePath(rutaExpediente(d.expedienteId));
  return { ok: true, mensaje: "Lectura guardada en el historial." };
}

export async function accionBorrarLectura(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionActiva())) return SIN_PERMISO;
  const datos = esquemaIdLectura.safeParse(formularioAObjeto(form));
  if (!datos.success) return ERROR_GENERICO;
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase
    .from("readings")
    .delete()
    .eq("id", datos.data.lecturaId)
    .eq("case_file_id", datos.data.expedienteId)
    .select("id");
  if (error || !data?.length) return error ? mensajeDeError(error) : SIN_PERMISO;
  revalidatePath(rutaExpediente(datos.data.expedienteId));
  return { ok: true, mensaje: "Lectura borrada." };
}

// ---------------------------------------------------------------- reportes PDF

export async function accionGenerarPdf(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionActiva();
  if (!sesion) return SIN_PERMISO;
  const datos = esquemaIdLectura.safeParse(formularioAObjeto(form));
  if (!datos.success) return ERROR_GENERICO;
  const { expedienteId, lecturaId } = datos.data;
  const limite = await consumirLimite("generarPdf", sesion.usuarioId);
  if (!limite.permitido) return { mensaje: mensajeEspera(limite.reintentarEnSegundos) };
  const supabase = await clienteSupabaseServidor();

  const [{ data: puedeLeer }, { data: puedeModificar }] = await Promise.all([
    supabase.rpc("has_case_perm", { case_id: expedienteId, p: "abrir_descargar" }),
    supabase.rpc("has_case_perm", { case_id: expedienteId, p: "modificar" }),
  ]);
  if (!puedeLeer || !puedeModificar) return SIN_PERMISO;
  const [{ data: lectura }, { data: expediente }, { data: perfil }, { data: aviso }] = await Promise.all([
    supabase.from("readings").select("id, sistema, resultado_calculado, created_at").eq("id", lecturaId).eq("case_file_id", expedienteId).maybeSingle(),
    supabase.from("case_files").select("display_label, es_demo").eq("id", expedienteId).maybeSingle(),
    supabase.from("birth_profiles").select("preferred_name").eq("case_file_id", expedienteId).maybeSingle(),
    supabase.from("privacy_notice_settings").select("responsable, finalidades, datos_tratados, conservacion, derechos, contacto").single(),
  ]);
  if (!lectura || !expediente) return SIN_PERMISO;

  const esCarta = lectura.sistema === "carta_natal";
  const hoy = new Date().toISOString().slice(0, 10);
  const documentoId = randomUUID();
  const folio = `CN-${hoy.replaceAll("-", "")}-${documentoId.slice(0, 8).toUpperCase()}`;
  const pdf = await generarReportePdf({
    ...(esCarta
      ? reporteDeCartaNatal(lectura.resultado_calculado as ResultadoCarta)
      : reporteDeNumerologia(lectura.resultado_calculado as ResultadoNumerologia)),
    titulo: esCarta ? "Carta natal" : "Lectura de numerología",
    nombrePersona: perfil?.preferred_name || expediente.display_label,
    folio,
    fechaElaboracion: hoy,
    demostracion: expediente.es_demo,
    interpretaciones: [],
    fuentes: [],
    avisoPrivacidad: {
      responsable: aviso?.responsable ?? undefined,
      finalidades: aviso?.finalidades ?? undefined,
      datosTratados: aviso?.datos_tratados ?? undefined,
      conservacion: aviso?.conservacion ?? undefined,
      derechos: aviso?.derechos ?? undefined,
      contacto: aviso?.contacto ?? undefined,
    },
  });

  const ruta = `${expedienteId}/${documentoId}.pdf`;
  const almacen = clienteSupabaseAdmin().storage.from("expedientes");
  const { error: errorSubida } = await almacen.upload(ruta, pdf, { contentType: "application/pdf", upsert: false });
  if (errorSubida) return ERROR_GENERICO;

  const { error } = await supabase.from("documents").insert({
    id: documentoId,
    case_file_id: expedienteId,
    reading_id: lecturaId,
    storage_path: ruta,
    version_plantilla: "reportes-1",
    tipo: "reporte",
    nombre: `${folio}.pdf`,
    sha256: createHash("sha256").update(pdf).digest("hex"),
    tamano_bytes: pdf.byteLength,
    created_by: sesion.usuarioId,
  });
  if (error) {
    await almacen.remove([ruta]);
    return mensajeDeError(error);
  }
  revalidatePath(rutaExpediente(expedienteId));
  return { ok: true, mensaje: `Reporte ${folio}.pdf guardado en «Documentos».` };
}

export async function accionBorrarDocumento(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionActiva())) return SIN_PERMISO;
  const datos = esquemaIdDocumento.safeParse(formularioAObjeto(form));
  if (!datos.success) return ERROR_GENERICO;
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", datos.data.documentoId)
    .eq("case_file_id", datos.data.expedienteId)
    .select("storage_path");
  if (error || !data?.length) return error ? mensajeDeError(error) : SIN_PERMISO;
  await clienteSupabaseAdmin().storage.from("expedientes").remove(data.map((d) => d.storage_path));
  revalidatePath(rutaExpediente(datos.data.expedienteId));
  return { ok: true, mensaje: "Documento borrado del expediente y del almacenamiento." };
}

// ---------------------------------------------------------------- permisos (administración)

function venceEn(dias: number | null): string | null {
  return dias ? new Date(Date.now() + dias * 86_400_000).toISOString() : null;
}

export async function accionAsignarPermisoExpediente(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionAdmin();
  if (!sesion) return SIN_PERMISO;
  const datos = esquemaPermisoExpediente.safeParse(formularioAObjeto(form, ["permisos"]));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const d = datos.data;
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase.from("case_file_grants").upsert(
    { case_file_id: d.expedienteId, user_id: d.usuarioId, permissions: d.permisos, granted_by: sesion.usuarioId, expires_at: venceEn(d.dias) },
    { onConflict: "case_file_id,user_id" },
  );
  if (error) return error.code === "42501" ? { mensaje: "No puedes asignarte permisos a ti mismo." } : mensajeDeError(error);
  revalidatePath(rutaExpediente(d.expedienteId));
  return { ok: true, mensaje: "Permisos del expediente actualizados." };
}

export async function accionAsignarPermisoArchivo(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionAdmin();
  if (!sesion) return SIN_PERMISO;
  const datos = esquemaPermisoArchivo.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const d = datos.data;
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase
    .from("document_grants")
    .insert({ document_id: d.documentoId, user_id: d.usuarioId, granted_by: sesion.usuarioId, expires_at: venceEn(d.dias) });
  if (error) return error.code === "23505" ? { mensaje: "Esa persona ya tiene acceso a este archivo." } : mensajeDeError(error);
  revalidatePath(rutaExpediente(d.expedienteId));
  return { ok: true, mensaje: "Acceso al archivo concedido." };
}

export async function accionRetirarPermiso(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionAdmin())) return SIN_PERMISO;
  const datos = esquemaRetirarPermiso.safeParse(formularioAObjeto(form));
  if (!datos.success) return ERROR_GENERICO;
  const d = datos.data;
  const supabase = await clienteSupabaseServidor();
  const consulta = d.documentoId
    ? supabase.from("document_grants").delete().eq("document_id", d.documentoId).eq("user_id", d.usuarioId)
    : supabase.from("case_file_grants").delete().eq("case_file_id", d.expedienteId).eq("user_id", d.usuarioId);
  const { error } = await consulta;
  if (error) return mensajeDeError(error);
  revalidatePath(rutaExpediente(d.expedienteId));
  return { ok: true, mensaje: "Permiso retirado." };
}

// ---------------------------------------------------------------- ajustes (administración)

export async function accionGuardarAjustes(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionAdmin())) return SIN_PERMISO;
  const datos = esquemaAjustes.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase
    .from("app_settings")
    .update({
      retencion_documentos_dias: datos.data.retencionDias,
      vigencia_url_firmada_segundos: datos.data.vigenciaSegundos,
      enlace_vigencia_max_dias: datos.data.enlaceVigenciaMaxDias,
      retencion_enlaces_dias: datos.data.retencionEnlacesDias,
      retencion_auditoria_dias: datos.data.retencionAuditoriaDias,
    })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return error ? mensajeDeError(error) : SIN_PERMISO;
  revalidatePath("/admin/ajustes");
  return { ok: true, mensaje: "Ajustes guardados. La retención de documentos nueva se aplica a los que se generen desde ahora; la de enlaces y auditoría, en la próxima purga." };
}

export async function accionGuardarAviso(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await sesionAdmin())) return SIN_PERMISO;
  const datos = esquemaAviso.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const d = datos.data;
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase
    .from("privacy_notice_settings")
    .update({
      responsable: d.responsable,
      finalidades: d.finalidades,
      datos_tratados: d.datosTratados,
      conservacion: d.conservacion,
      derechos: d.derechos,
      contacto: d.contacto,
    })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return error ? mensajeDeError(error) : SIN_PERMISO;
  revalidatePath("/admin/ajustes");
  return { ok: true, mensaje: "Aviso de privacidad guardado. Los campos vacíos se muestran como pendientes en los PDF." };
}
