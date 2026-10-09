"use client";

import { Boton } from "@/ui/componentes/Boton";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Seccion } from "@/ui/componentes/Seccion";

/** Error inesperado en una página: no muestra detalles técnicos, solo una referencia. */
export default function ErrorDePagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Algo salió mal</h1>
      <Seccion titulo="No se pudo mostrar esta página" ayuda="errores">
        <p role="alert" className="mb-4 text-slate-700">
          Ocurrió un error inesperado. Tus datos no se modificaron. Puedes intentarlo de nuevo en unos segundos.
        </p>
        {error.digest && <p className="mb-4 text-xs text-slate-600">Referencia para soporte: {error.digest}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Boton descripcion="Vuelve a cargar esta sección sin salir de la página." onClick={() => reset()}>
            Intentar de nuevo
          </Boton>
          <EnlaceBoton href="/" descripcion="Vuelve a la página de inicio.">
            Ir al inicio
          </EnlaceBoton>
        </div>
      </Seccion>
    </div>
  );
}
