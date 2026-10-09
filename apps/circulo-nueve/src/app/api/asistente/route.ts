import { NextResponse, type NextRequest } from "next/server";
import { SECCIONES_AYUDA } from "@/content/ayuda";
import { obtenerSesion } from "@/modulos/auth/sesion";
import { esquemaPreguntaAsistente } from "@/modulos/proveedores/esquemas";
import { dependenciasServidor } from "@/modulos/proveedores/repositorio";
import { responderAyudaConProveedor } from "@/modulos/proveedores/servicio";
import { consumirLimite, ipDe } from "@/modulos/seguridad/limite-frecuencia";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "cache-control": "no-store" };

function error(estado: number, codigo: string, mensaje: string) {
  return NextResponse.json({ ok: false, error: { codigo, mensaje } }, { status: estado, headers: SIN_CACHE });
}

/** Pregunta al asistente de ayuda con un proveedor LLM. Nunca registra la pregunta. */
export async function POST(request: NextRequest) {
  const origen = request.headers.get("origin");
  if (origen && origen !== request.nextUrl.origin && origen !== process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "")) {
    return error(403, "origen", "Solicitud de otro sitio.");
  }
  const limite = await consumirLimite("asistente", ipDe(request.headers));
  if (!limite.permitido) {
    return error(429, "limite_cliente", `Demasiadas preguntas seguidas. Espera ${limite.reintentarEnSegundos} s.`);
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return error(400, "solicitud", "Solicitud inválida.");
  }
  const leido = esquemaPreguntaAsistente.safeParse(cuerpo);
  if (!leido.success) return error(400, "solicitud", "La pregunta debe tener entre 1 y 300 caracteres y elegir un proveedor aceptado.");

  const sesion = await obtenerSesion().catch(() => null);
  const resultado = await responderAyudaConProveedor(
    { ...leido.data, usuarioId: sesion?.usuarioId ?? null },
    SECCIONES_AYUDA,
    dependenciasServidor(),
  );
  if (!resultado.ok) {
    const estado = resultado.error.codigo === "sin_respuesta" ? 503 : resultado.error.codigo === "proveedor_no_disponible" ? 404 : 422;
    return NextResponse.json({ ok: false, error: resultado.error }, { status: estado, headers: SIN_CACHE });
  }
  return NextResponse.json(resultado, { headers: SIN_CACHE });
}
