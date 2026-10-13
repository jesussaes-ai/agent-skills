import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { rutaInternaSegura } from "@/modulos/auth/config";
import { obtenerSesion } from "@/modulos/auth/sesion";
import { FormularioVerificar } from "@/ui/auth/Formularios";
import { Seccion } from "@/ui/componentes/Seccion";

export const metadata: Metadata = { title: "Verificación en dos pasos · Círculo Nueve" };

export default async function PaginaVerificar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const siguiente = rutaInternaSegura((await searchParams).next);
  const sesion = await obtenerSesion();
  if (!sesion) redirect(`/entrar?next=${encodeURIComponent(siguiente)}`);
  if (!sesion.tieneFactorVerificado) redirect(`/cuenta/verificacion?next=${encodeURIComponent(siguiente)}`);
  if (sesion.nivelActual === "aal2") redirect(siguiente);

  return (
    <div className="mx-auto max-w-md">
      <Seccion titulo="Verificación en dos pasos" ayuda="verificacion-dos-pasos">
        <FormularioVerificar siguiente={siguiente} />
      </Seccion>
    </div>
  );
}
