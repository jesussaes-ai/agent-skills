import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { esZonaValida, lugarManual } from "@/modulos/calculo/astrologia";
import { leerConfigSupabase } from "@/modulos/auth/config";
import { clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { esquemaConsulta } from "@/modulos/consulta/esquemas";
import { calcularConsulta, fechaLocal, subtituloCarta } from "@/modulos/consulta/integral";
import { lugarPorGeonameId } from "@/modulos/expedientes/lugares-servidor";
import { consumirLimite, ipDe, mensajeEspera } from "@/modulos/seguridad/limite-frecuencia";
import { generarReportePdf, reporteIntegral, type AvisoPrivacidad } from "@/reportes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const error = (estado: number, mensaje: string) => NextResponse.json({ ok: false, mensaje }, { status: estado, headers: { "cache-control": "no-store" } });

/** Aviso de privacidad configurado por la persona propietaria; si no hay base o no se puede leer, queda pendiente. */
async function avisoPrivacidad(): Promise<AvisoPrivacidad> {
  if (!leerConfigSupabase().configurado) return {};
  try {
    const supabase = await clienteSupabaseServidor();
    const { data } = await supabase.from("privacy_notice_settings").select("responsable, finalidades, datos_tratados, conservacion, derechos, contacto").maybeSingle();
    if (!data) return {};
    return {
      responsable: data.responsable ?? undefined,
      finalidades: data.finalidades ?? undefined,
      datosTratados: data.datos_tratados ?? undefined,
      conservacion: data.conservacion ?? undefined,
      derechos: data.derechos ?? undefined,
      contacto: data.contacto ?? undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Genera la carta final en PDF de una «Nueva consulta». Recalcula todo en el servidor con los datos
 * confirmados (no confía en resultados del navegador) y no guarda nada: el PDF se entrega y se olvida.
 */
export async function POST(request: NextRequest) {
  const origen = request.headers.get("origin");
  if (origen && origen !== request.nextUrl.origin && origen !== process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "")) {
    return error(403, "Solicitud de otro sitio.");
  }
  const limite = await consumirLimite("generarPdf", ipDe(request.headers));
  if (!limite.permitido) return error(429, mensajeEspera(limite.reintentarEnSegundos));

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return error(400, "Solicitud inválida.");
  }
  const leido = esquemaConsulta.safeParse(cuerpo);
  if (!leido.success) return error(400, leido.error.issues[0]?.message ?? "Revisa los datos.");
  const d = leido.data;

  let lugar;
  if (d.lugar?.tipo === "geonames") {
    lugar = (await lugarPorGeonameId(d.lugar.geonameId)) ?? undefined;
    if (!lugar) return error(400, "No se encontró ese lugar en el catálogo.");
  } else if (d.lugar?.tipo === "manual") {
    if (!esZonaValida(d.lugar.zona)) return error(400, "La zona horaria del lugar no es válida.");
    lugar = lugarManual(d.lugar.nombre, d.lugar.latitud, d.lugar.longitud, d.lugar.zona);
  }

  const zona = d.zonaUsuario && esZonaValida(d.zonaUsuario) ? d.zonaUsuario : lugar?.zonaHoraria;
  const hoy = fechaLocal(zona);
  const r = calcularConsulta({
    nombre: d.nombre,
    nombrePreferido: d.nombrePreferido,
    fecha: d.fecha,
    hora: d.hora,
    precisionHora: d.precisionHora,
    lugar,
    hebreo: d.hebreo || undefined,
    fechaConsulta: hoy,
  });
  if (!r.ok) return error(400, r.errores.join(" "));

  const folio = `CN-${hoy.replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const pdf = await generarReportePdf({
    ...reporteIntegral(r),
    titulo: "Carta de Círculo Nueve",
    subtitulo: subtituloCarta(Boolean(r.cabala), Boolean(r.carta)),
    nombrePersona: d.nombrePreferido || d.nombre,
    folio,
    fechaElaboracion: hoy,
    demostracion: false,
    interpretaciones: [],
    fuentes: [],
    avisoPrivacidad: await avisoPrivacidad(),
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${folio}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
