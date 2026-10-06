import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { rutaInternaSegura } from "@/modulos/auth/config";
import { exigirSesion } from "@/modulos/auth/sesion";
import { InscripcionMfa } from "@/ui/auth/InscripcionMfa";
import { Seccion } from "@/ui/componentes/Seccion";

export const metadata: Metadata = { title: "Verificación en dos pasos · Círculo Nueve" };

export default async function PaginaVerificacion({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const siguiente = rutaInternaSegura(params.next, "/cuenta");
  const sesion = await exigirSesion("/cuenta/verificacion");
  if (sesion.tieneFactorVerificado) redirect(siguiente);

  return (
    <div className="mx-auto max-w-md">
      <Seccion titulo="Configura la verificación en dos pasos" ayuda="verificacion-dos-pasos">
        {params.obligatoria && (
          <p role="note" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            Para administrar es obligatoria: sin ella no se conceden permisos de administración.
          </p>
        )}
        <InscripcionMfa siguiente={siguiente} />
      </Seccion>
    </div>
  );
}
