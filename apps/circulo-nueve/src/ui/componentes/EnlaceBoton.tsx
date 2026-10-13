"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Explicacion } from "./Explicacion";

interface Props {
  href: string;
  /** Explicación de adónde lleva el enlace; se muestra como ventana explicativa. */
  descripcion: string;
  children: ReactNode;
  className?: string;
  /** Desactívalo en rutas con efectos (descargas auditadas, exportaciones). */
  prefetch?: boolean;
  /** «principal»: con aspecto de botón destacado, para acciones que deben encontrarse a la primera. */
  variante?: "enlace" | "principal";
}

const ESTILOS = {
  enlace: "rounded-md px-2 py-1 text-marino-800 underline-offset-4 hover:underline",
  principal: "inline-flex items-center gap-2 rounded-lg bg-marino-800 px-4 py-2 text-white shadow-sm hover:bg-marino-700",
};

/** Único enlace de la app: obliga a pasar `descripcion`. */
export function EnlaceBoton({ href, descripcion, children, className = "", prefetch, variante = "enlace" }: Props) {
  return (
    <Explicacion descripcion={descripcion}>
      {(disparador) => (
        <Link
          href={href}
          prefetch={prefetch}
          {...disparador}
          className={`font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marino-800 ${ESTILOS[variante]} ${className}`}
        >
          {children}
        </Link>
      )}
    </Explicacion>
  );
}
