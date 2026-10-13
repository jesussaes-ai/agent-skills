"use client";

import type { ButtonHTMLAttributes } from "react";
import { Explicacion } from "./Explicacion";

export type VarianteBoton = "primario" | "secundario" | "sutil" | "icono";

const ESTILOS: Record<VarianteBoton, string> = {
  primario: "bg-marino-800 text-white hover:bg-marino-700 disabled:bg-marino-300 px-4 py-2",
  secundario: "border border-marino-300 bg-white text-marino-800 hover:bg-marino-50 disabled:opacity-50 px-4 py-2",
  sutil: "text-marino-800 underline-offset-4 hover:underline px-2 py-1",
  icono:
    "h-8 w-8 justify-center rounded-full border border-marino-300 bg-white text-marino-800 hover:bg-marino-50 text-sm font-bold",
};

export interface PropsBoton extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-describedby"> {
  /** Explicación de qué hace el botón; se muestra como ventana explicativa. */
  descripcion: string;
  variante?: VarianteBoton;
}

/** Único botón de la app: obliga a pasar `descripcion`. */
export function Boton({ descripcion, variante = "primario", className = "", type = "button", ...props }: PropsBoton) {
  return (
    <Explicacion descripcion={descripcion}>
      {(disparador) => (
        <button
          type={type}
          {...props}
          {...disparador}
          className={`inline-flex items-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marino-800 disabled:cursor-not-allowed ${ESTILOS[variante]} ${className}`}
        />
      )}
    </Explicacion>
  );
}
