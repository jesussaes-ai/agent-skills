import { NextResponse } from "next/server";
import { llaveDe } from "@/modulos/proveedores/config";
import { PLANTILLAS } from "@/modulos/proveedores/catalogo";
import { aPublico } from "@/modulos/proveedores/privacidad";
import { proveedoresActivos } from "@/modulos/proveedores/repositorio";

export const dynamic = "force-dynamic";

/** Proveedores que el asistente puede ofrecer: sin endpoint, sin nombre de secreto y sin llave. */
export async function GET() {
  const activos = await proveedoresActivos();
  const usables = activos.filter((p) => !PLANTILLAS[p.tipo].requiereLlave || llaveDe(p));
  return NextResponse.json({ proveedores: usables.map(aPublico) }, { headers: { "cache-control": "no-store" } });
}
