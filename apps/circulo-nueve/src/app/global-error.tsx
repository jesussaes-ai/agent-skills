"use client";

import "./globals.css";
import { Boton } from "@/ui/componentes/Boton";

/** Último recurso si falla la estructura principal: página mínima con la paleta de marca. */
export default function ErrorGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <main className="mx-auto max-w-lg px-4 py-16">
          <h1 className="mb-4 text-2xl font-semibold text-slate-900">Círculo Nueve no está disponible</h1>
          <p role="alert" className="mb-6 text-slate-700">
            Ocurrió un error inesperado. Tus datos no se modificaron. Intenta de nuevo en unos segundos.
          </p>
          <Boton descripcion="Vuelve a cargar la aplicación." onClick={() => reset()}>
            Intentar de nuevo
          </Boton>
        </main>
      </body>
    </html>
  );
}
