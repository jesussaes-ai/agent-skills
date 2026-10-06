import type { Metadata } from "next";
import { exigirSesion } from "@/modulos/auth/sesion";
import { FormularioContrasena } from "@/ui/auth/Formularios";
import { Seccion } from "@/ui/componentes/Seccion";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contraseña · Círculo Nueve" };

export default async function PaginaContrasena() {
  await exigirSesion("/cuenta/contrasena");
  return (
    <div className="mx-auto max-w-md">
      <Seccion titulo="Elige tu contraseña" ayuda="cuenta">
        <FormularioContrasena />
      </Seccion>
    </div>
  );
}
