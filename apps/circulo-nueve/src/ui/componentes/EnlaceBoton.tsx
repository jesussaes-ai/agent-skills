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
}

/** Único enlace de la app: obliga a pasar `descripcion`. */
export function EnlaceBoton({ href, descripcion, children, className = "", prefetch }: Props) {
  return (
    <Explicacion descripcion={descripcion}>
      {(disparador) => (
        <Link
          href={href}
          prefetch={prefetch}
          {...disparador}
          className={`rounded-md px-2 py-1 font-medium text-marino-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-marino-800 ${className}`}
        >
          {children}
        </Link>
      )}
    </Explicacion>
  );
}
