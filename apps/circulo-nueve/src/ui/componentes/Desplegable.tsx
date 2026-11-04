"use client";

import type { ReactNode } from "react";
import { Explicacion } from "./Explicacion";

/** Sección que se abre y se cierra (`<details>`), con ventana explicativa en su título. */
export function Desplegable({
  titulo,
  descripcion,
  children,
  abierto,
  className = "",
}: {
  titulo: ReactNode;
  descripcion: string;
  children: ReactNode;
  abierto?: boolean;
  className?: string;
}) {
  return (
    <details open={abierto} className={`rounded-lg border border-slate-200 p-3 ${className}`}>
      {/* El <summary> debe ser hijo directo de <details>: si no, el navegador muestra «Detalles». */}
      <summary className="cursor-pointer text-sm font-medium text-slate-800">
        <Explicacion descripcion={descripcion}>
          {(p) => (
            <span {...p} tabIndex={-1}>
              {titulo}
            </span>
          )}
        </Explicacion>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}
