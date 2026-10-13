"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { leerConfigSupabase } from "@/modulos/auth/config";
import { erroresDe, type EstadoFormulario } from "@/modulos/auth/esquemas";
import { obtenerSesion } from "@/modulos/auth/sesion";
import { clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { formularioAObjeto } from "@/modulos/expedientes/esquemas";
import { consumirLimite, mensajeEspera } from "@/modulos/seguridad/limite-frecuencia";
import { esquemaCrearEnlace, esquemaRevocarEnlace } from "./esquemas";
import { generarToken } from "./token";

const SIN_PERMISO: EstadoFormulario = { mensaje: "No tienes permiso para compartir este expediente." };
const ERROR_GENERICO: EstadoFormulario = { mensaje: "No se pudo completar la operación. Inténtalo de nuevo." };

/** Crea un enlace que vence. El token se devuelve una sola vez; en la base solo queda su hash. */
export async function accionCrearEnlace(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await obtenerSesion();
  if (!sesion?.acceso.activo) return SIN_PERMISO;
  const datos = esquemaCrearEnlace.safeParse(formularioAObjeto(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const d = datos.data;

  const limite = await consumirLimite("crearEnlace", sesion.usuarioId);
  if (!limite.permitido) return { mensaje: mensajeEspera(limite.reintentarEnSegundos) };

  const supabase = await clienteSupabaseServidor();
  const [{ data: puedeCompartir }, { data: ajustes }] = await Promise.all([
    supabase.rpc("has_case_perm", { case_id: d.expedienteId, p: "compartir" }),
    supabase.from("app_settings").select("enlace_vigencia_max_dias").single(),
  ]);
  if (!puedeCompartir) return SIN_PERMISO;
  const maxDias = ajustes?.enlace_vigencia_max_dias ?? 7;
  if (d.vigenciaHoras > maxDias * 24) {
    return { errores: { vigenciaHoras: `La vigencia máxima permitida es de ${maxDias} día${maxDias === 1 ? "" : "s"}.` } };
  }

  const { token, hash } = generarToken();
  // Sin «returning»: la política de lectura usa has_case_perm. El id se genera aquí.
  const { error } = await supabase.from("share_links").insert({
    id: randomUUID(),
    case_file_id: d.expedienteId,
    document_id: d.documentoId,
    token_hash: hash,
    alcance: d.documentoId ? "documento" : "expediente",
    expires_at: new Date(Date.now() + d.vigenciaHoras * 3_600_000).toISOString(),
    max_accesos: d.maxAccesos,
    nota: d.nota,
    created_by: sesion.usuarioId,
  });
  if (error) return error.code === "42501" ? SIN_PERMISO : ERROR_GENERICO;

  revalidatePath(`/expedientes/${d.expedienteId}`);
  return {
    ok: true,
    mensaje: "Enlace creado. Cópialo ahora: por seguridad no se vuelve a mostrar.",
    enlace: `${leerConfigSupabase().urlSitio}/compartido/${token}`,
  };
}

export async function accionRevocarEnlace(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await obtenerSesion();
  if (!sesion?.acceso.activo) return SIN_PERMISO;
  const datos = esquemaRevocarEnlace.safeParse(formularioAObjeto(form));
  if (!datos.success) return ERROR_GENERICO;
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", datos.data.enlaceId)
    .eq("case_file_id", datos.data.expedienteId)
    .is("revoked_at", null)
    .select("id");
  if (error || !data?.length) return error?.code === "42501" || !data?.length ? SIN_PERMISO : ERROR_GENERICO;
  revalidatePath(`/expedientes/${datos.data.expedienteId}`);
  return { ok: true, mensaje: "Enlace revocado: deja de funcionar de inmediato." };
}
