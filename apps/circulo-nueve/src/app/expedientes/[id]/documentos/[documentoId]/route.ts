import { NextResponse, type NextRequest } from "next/server";
import { leerConfigSupabase, origenPublico } from "@/modulos/auth/config";
import { obtenerSesion } from "@/modulos/auth/sesion";
import { clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { consumirLimite, mensajeEspera } from "@/modulos/seguridad/limite-frecuencia";

export const dynamic = "force-dynamic";

const NO_ENCONTRADO = () =>
  new NextResponse("No existe o no tienes permiso para abrir este documento.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

/**
 * Descarga de un documento del expediente. La autorización se comprueba en el
 * servidor (RLS de documents y de storage con la sesión de quien pide), se audita
 * y se redirige a una URL firmada de vida corta. No responde con el archivo directamente.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; documentoId: string }> }) {
  const { id, documentoId } = await params;
  if (!leerConfigSupabase().configurado) return NO_ENCONTRADO();
  const sesion = await obtenerSesion();
  if (!sesion) {
    const destino = `/expedientes/${id}`;
    return NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(destino)}`, origenPublico(request.headers)));
  }
  const limite = await consumirLimite("descargarDocumento", sesion.usuarioId);
  if (!limite.permitido) {
    return new NextResponse(mensajeEspera(limite.reintentarEnSegundos), {
      status: 429,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": String(limite.reintentarEnSegundos) },
    });
  }

  const supabase = await clienteSupabaseServidor();
  const { data: documento } = await supabase
    .from("documents")
    .select("id, case_file_id, storage_path, nombre")
    .eq("id", documentoId)
    .eq("case_file_id", id)
    .maybeSingle();
  if (!documento) return NO_ENCONTRADO();

  const { error: errorAuditoria } = await supabase.rpc("registrar_acceso", {
    p_accion: "descargar",
    p_recurso_tipo: "documents",
    p_recurso_id: documento.id,
    p_expediente: documento.case_file_id,
  });
  if (errorAuditoria) return NO_ENCONTRADO();

  const { data: ajustes } = await supabase.from("app_settings").select("vigencia_url_firmada_segundos").single();
  const { data: firmada, error } = await supabase.storage
    .from("expedientes")
    .createSignedUrl(documento.storage_path, ajustes?.vigencia_url_firmada_segundos ?? 60, {
      download: documento.nombre ?? "reporte.pdf",
    });
  if (error || !firmada) return NO_ENCONTRADO();

  return NextResponse.redirect(firmada.signedUrl, { status: 303, headers: { "cache-control": "no-store" } });
}
