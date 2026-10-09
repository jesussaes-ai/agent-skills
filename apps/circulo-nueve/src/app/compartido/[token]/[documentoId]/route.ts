import { NextResponse, type NextRequest } from "next/server";
import { leerConfigSupabase } from "@/modulos/auth/config";
import { clienteSupabaseAdmin } from "@/modulos/auth/supabase-servidor";
import { usarEnlace } from "@/modulos/compartir/consultas";
import { consumirLimite, ipDe, ipRecortada, mensajeEspera } from "@/modulos/seguridad/limite-frecuencia";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CABECERAS = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" };

const texto = (estado: number, mensaje: string, extra: Record<string, string> = {}) =>
  new NextResponse(mensaje, { status: estado, headers: { ...CABECERAS, ...extra } });

/**
 * Descarga pública de un PDF compartido. Valida el enlace (vigencia, revocación,
 * máximo de descargas), cuenta el acceso, lo audita y redirige a una URL firmada
 * de vida corta. Un enlace vencido o revocado responde 410.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string; documentoId: string }> }) {
  const { token, documentoId } = await params;
  if (!leerConfigSupabase().configurado) return texto(404, "Este enlace no existe.");

  const ip = ipDe(request.headers);
  const limite = await consumirLimite("enlacePublico", ip);
  if (!limite.permitido) {
    return texto(429, mensajeEspera(limite.reintentarEnSegundos), { "retry-after": String(limite.reintentarEnSegundos) });
  }
  if (!UUID.test(documentoId)) return texto(404, "Este enlace no existe.");

  const resultado = await usarEnlace(token, documentoId, ipRecortada(ip));
  if (resultado.estado === "no_existe" || resultado.estado === "documento_no_disponible") {
    return texto(404, "Este enlace no existe o el documento ya no está disponible.");
  }
  if (resultado.estado !== "ok") {
    return texto(410, "Este enlace ya no está disponible: venció, se revocó o se agotaron sus descargas.");
  }
  const documento = resultado.documentos[0];
  if (!documento) return texto(404, "El documento ya no está disponible.");

  const admin = clienteSupabaseAdmin();
  const { data: ajustes } = await admin.from("app_settings").select("vigencia_url_firmada_segundos").single();
  const { data: firmada, error } = await admin.storage
    .from("expedientes")
    .createSignedUrl(documento.ruta, ajustes?.vigencia_url_firmada_segundos ?? 60, { download: documento.nombre });
  if (error || !firmada) return texto(404, "El documento ya no está disponible.");

  return NextResponse.redirect(firmada.signedUrl, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
