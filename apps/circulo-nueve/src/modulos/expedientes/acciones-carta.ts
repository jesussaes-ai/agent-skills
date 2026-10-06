"use server";

import { revalidatePath } from "next/cache";
import { calcularCartaNatal, crearConfig, esZonaValida, lugarManual } from "@/modulos/calculo/astrologia";
import type { EstadoFormulario } from "@/modulos/auth/esquemas";
import { obtenerSesion } from "@/modulos/auth/sesion";
import { clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { formularioAObjeto } from "./esquemas";
import { esquemaGuardarCarta } from "./esquemas-carta";
import { huellaCarta } from "./huella-carta";
import { lugarPorGeonameId } from "./lugares-servidor";

const SIN_PERMISO: EstadoFormulario = { mensaje: "No tienes permiso para hacer esto en este expediente." };
const ERROR_GENERICO: EstadoFormulario = { mensaje: "No se pudo completar la operación. Inténtalo de nuevo." };

/**
 * Guarda una carta natal en el historial. La fecha, la hora y la zona salen del
 * perfil guardado (no del navegador), el lugar se resuelve en el servidor y la
 * carta se recalcula aquí. La base exige el consentimiento «guardar_historial».
 */
export async function accionGuardarCarta(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sesion = await obtenerSesion();
  if (!sesion?.acceso.activo) return SIN_PERMISO;
  const datos = esquemaGuardarCarta.safeParse(formularioAObjeto(form));
  if (!datos.success) return ERROR_GENERICO;
  const d = datos.data;
  const supabase = await clienteSupabaseServidor();

  const [{ data: puede }, { data: perfil }] = await Promise.all([
    supabase.rpc("has_case_perm", { case_id: d.expedienteId, p: "modificar" }),
    supabase.from("birth_profiles").select("birth_date, birth_time, birth_time_precision, tz_id").eq("case_file_id", d.expedienteId).maybeSingle(),
  ]);
  if (!puede) return SIN_PERMISO;
  if (!perfil?.birth_date) return { mensaje: "Guarda primero la fecha de nacimiento en el perfil del expediente." };

  let lugar;
  if (d.lugarTipo === "geonames") {
    lugar = await lugarPorGeonameId(d.geonameId);
    if (!lugar) return { mensaje: "Ese lugar no está en el catálogo GeoNames de la app." };
  } else {
    if (!esZonaValida(d.zonaLugar)) return { mensaje: `La zona horaria «${d.zonaLugar}» no existe en la base IANA.` };
    lugar = lugarManual(d.nombreLugar, d.latitud, d.longitud, d.zonaLugar);
  }

  const resultado = calcularCartaNatal(
    {
      fecha: perfil.birth_date,
      hora: perfil.birth_time ? String(perfil.birth_time).slice(0, 5) : undefined,
      precisionHora: perfil.birth_time_precision,
      lugar,
      zonaHoraria: perfil.tz_id || undefined,
      ocurrencia: d.ocurrencia || undefined,
    },
    crearConfig(d.config),
  );
  if (!resultado.ok) return { mensaje: resultado.errores.join(" ") };

  const { error } = await supabase.from("readings").insert({
    case_file_id: d.expedienteId,
    sistema: "carta_natal",
    motor: resultado.motor,
    motor_version: resultado.motorVersion,
    reglas_version: resultado.reglasVersion,
    entradas_hash: huellaCarta(resultado),
    resultado_calculado: resultado,
    created_by: sesion.usuarioId,
  });
  if (error?.code === "CN001") {
    return { mensaje: "Falta el consentimiento correspondiente en este expediente. Actívalo en «Consentimientos» y vuelve a intentarlo." };
  }
  if (error) return error.code === "42501" ? SIN_PERMISO : ERROR_GENERICO;
  revalidatePath(`/expedientes/${d.expedienteId}`);
  return { ok: true, mensaje: "Carta natal guardada en el historial, recalculada en el servidor." };
}
