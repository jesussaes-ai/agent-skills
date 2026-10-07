import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { leerConfigSupabase, rutaInternaSegura } from "@/modulos/auth/config";
import { obtenerSesion } from "@/modulos/auth/sesion";
import { AvisoSinSupabase } from "@/ui/auth/AvisoSinSupabase";
import { FormularioEntrar } from "@/ui/auth/Formularios";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Seccion } from "@/ui/componentes/Seccion";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar · Círculo Nueve" };

export default async function PaginaEntrar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const siguiente = rutaInternaSegura(params.next);
  if (await obtenerSesion()) redirect(siguiente);

  return (
    <div className="mx-auto max-w-md">
      <Seccion titulo="Entrar" ayuda="acceso">
        {!leerConfigSupabase().configurado ? (
          <AvisoSinSupabase />
        ) : (
          <div className="space-y-4">
            {params.error === "enlace" && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
                El enlace no es válido o ya se usó. Pide uno nuevo.
              </p>
            )}
            <FormularioEntrar siguiente={siguiente} />
            <EnlaceBoton href="/recuperar" className="px-0" descripcion="Qué hacer si no recuerdas tu contraseña: la restablece la administración.">
              ¿Olvidaste tu contraseña?
            </EnlaceBoton>
          </div>
        )}
      </Seccion>
    </div>
  );
}
