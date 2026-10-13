import { NextResponse, type NextRequest } from "next/server";
import { leerConfigSupabase, origenPublico } from "@/modulos/auth/config";
import { obtenerSesion } from "@/modulos/auth/sesion";
import { clienteSupabaseAdmin, clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";

export const dynamic = "force-dynamic";

/**
 * Imagen de una figura de la biblioteca. La autorización la decide la base
 * (`ruta_figura_autorizada`: mismo nivel de acceso que el fragmento, o
 * administración de fuentes); después se redirige a una URL firmada corta.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const noEncontrada = () => new NextResponse("No existe o no tienes acceso a esta figura.", { status: 404, headers: { "cache-control": "no-store" } });
  if (!leerConfigSupabase().configurado || !/^[0-9a-f-]{36}$/.test(id)) return noEncontrada();
  if (!(await obtenerSesion())) {
    return NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent("/biblioteca/preguntar")}`, origenPublico(request.headers)));
  }
  const supabase = await clienteSupabaseServidor();
  const { data: ruta } = await supabase.rpc("ruta_figura_autorizada", { p_figura: id });
  if (!ruta) return noEncontrada();
  const { data: ajustes } = await supabase.from("app_settings").select("vigencia_url_firmada_segundos").single();
  const { data: firmada } = await clienteSupabaseAdmin()
    .storage.from("biblioteca-derivados")
    .createSignedUrl(ruta as string, ajustes?.vigencia_url_firmada_segundos ?? 60);
  if (!firmada) return noEncontrada();
  return NextResponse.redirect(firmada.signedUrl, { status: 303, headers: { "cache-control": "no-store" } });
}
