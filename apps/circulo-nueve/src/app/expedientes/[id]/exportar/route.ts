import { NextResponse, type NextRequest } from "next/server";
import { leerConfigSupabase, origenPublico } from "@/modulos/auth/config";
import { obtenerSesion } from "@/modulos/auth/sesion";
import { clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";

export const dynamic = "force-dynamic";

/** Exporta el expediente en JSON (sin archivos binarios). Requiere abrir/descargar y queda auditado. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const noEncontrado = new NextResponse("No existe o no tienes permiso para exportar este expediente.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
  if (!leerConfigSupabase().configurado) return noEncontrado;
  if (!(await obtenerSesion())) {
    return NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(`/expedientes/${id}`)}`, origenPublico(request.headers)));
  }

  const supabase = await clienteSupabaseServidor();
  const { error: errorAuditoria } = await supabase.rpc("registrar_acceso", {
    p_accion: "exportar",
    p_recurso_tipo: "case_files",
    p_recurso_id: id,
    p_expediente: id,
  });
  if (errorAuditoria) return noEncontrado;

  const [expediente, perfil, consentimientos, lecturas, documentos] = await Promise.all([
    supabase.from("case_files").select("id, display_label, status, es_demo, created_at, updated_at").eq("id", id).single(),
    supabase.from("birth_profiles").select("birth_name, preferred_name, birth_date, birth_time, birth_time_precision, birth_place, tz_id, tz_source, confirmed_at, updated_at").eq("case_file_id", id).maybeSingle(),
    supabase.from("consents").select("tipo, otorgado, version_texto, otorgado_at").eq("case_file_id", id).order("secuencia"),
    supabase.from("readings").select("id, sistema, motor, motor_version, reglas_version, resultado_calculado, created_at").eq("case_file_id", id).order("created_at"),
    supabase.from("documents").select("id, nombre, tipo, sha256, tamano_bytes, retener_hasta, created_at").eq("case_file_id", id).order("created_at"),
  ]);

  const cuerpo = {
    formato: "circulo-nueve/expediente",
    version: 1,
    exportado: new Date().toISOString(),
    nota: "Los archivos PDF no se incluyen; se descargan desde el expediente.",
    expediente: expediente.data,
    perfil: perfil.data,
    consentimientos: consentimientos.data ?? [],
    lecturas: lecturas.data ?? [],
    documentos: documentos.data ?? [],
  };
  return new NextResponse(JSON.stringify(cuerpo, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="expediente-${id}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
