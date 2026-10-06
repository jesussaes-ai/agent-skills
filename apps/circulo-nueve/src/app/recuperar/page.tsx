import type { Metadata } from "next";
import { leerConfigSupabase } from "@/modulos/auth/config";
import { AvisoSinSupabase } from "@/ui/auth/AvisoSinSupabase";
import { FormularioRecuperar } from "@/ui/auth/Formularios";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Seccion } from "@/ui/componentes/Seccion";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recuperar contraseña · Círculo Nueve" };

export default function PaginaRecuperar() {
  return (
    <div className="mx-auto max-w-md">
      <Seccion titulo="Recuperar la contraseña" ayuda="acceso">
        {!leerConfigSupabase().configurado ? (
          <AvisoSinSupabase />
        ) : (
          <div className="space-y-4">
            <FormularioRecuperar />
            <EnlaceBoton href="/entrar" className="px-0" descripcion="Vuelve a la página para entrar.">
              Volver a entrar
            </EnlaceBoton>
          </div>
        )}
      </Seccion>
    </div>
  );
}
