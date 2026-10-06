import type { Metadata } from "next";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Seccion } from "@/ui/componentes/Seccion";

export const metadata: Metadata = { title: "Sin permiso · Círculo Nueve" };

export default function SinPermiso() {
  return (
    <div className="mx-auto max-w-md">
      <Seccion titulo="No tienes permiso" ayuda="administracion-usuarios">
        <p className="mb-4 text-slate-700">
          Tu cuenta no tiene acceso a esta sección. Si crees que es un error, pídelo a la administración.
        </p>
        <EnlaceBoton href="/cuenta" className="px-0" descripcion="Vuelve a tu cuenta.">
          Ir a mi cuenta
        </EnlaceBoton>
      </Seccion>
    </div>
  );
}
