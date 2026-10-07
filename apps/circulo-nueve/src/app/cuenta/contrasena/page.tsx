import type { Metadata } from "next";
import { rutaInternaSegura } from "@/modulos/auth/config";
import { exigirSesion } from "@/modulos/auth/sesion";
import { FormularioContrasena } from "@/ui/auth/Formularios";
import { Seccion } from "@/ui/componentes/Seccion";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contraseña · Círculo Nueve" };

export default async function PaginaContrasena({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const sesion = await exigirSesion("/cuenta/contrasena");
  const siguiente = params.next ? rutaInternaSegura(params.next) : undefined;
  return (
    <div className="mx-auto max-w-md">
      <Seccion titulo="Elige tu contraseña" ayuda="cuenta">
        {sesion.acceso.debeCambiar && (
          <p role="note" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950" data-testid="aviso-cambio-obligatorio">
            La administración te dio una contraseña provisional. Elige una nueva, distinta, para poder usar la app.
          </p>
        )}
        <FormularioContrasena siguiente={siguiente} />
      </Seccion>
    </div>
  );
}
