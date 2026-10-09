import type { Metadata } from "next";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Seccion } from "@/ui/componentes/Seccion";

export const metadata: Metadata = { title: "Página no encontrada · Círculo Nueve" };

export default function NoEncontrada() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Página no encontrada</h1>
      <Seccion titulo="No encontramos lo que buscas" ayuda="errores">
        <p className="mb-4 text-slate-700">
          La dirección no existe o no tienes permiso para verla. Por privacidad, ambos casos se muestran igual.
        </p>
        <div className="flex flex-wrap gap-3">
          <EnlaceBoton href="/" className="px-0" descripcion="Vuelve a la página de inicio.">
            Ir al inicio
          </EnlaceBoton>
          <EnlaceBoton href="/ayuda" descripcion="Abre el Centro de ayuda.">
            Centro de ayuda
          </EnlaceBoton>
        </div>
      </Seccion>
    </div>
  );
}
