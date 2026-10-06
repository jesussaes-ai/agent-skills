"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface PropsDisparador {
  "aria-describedby": string;
  onMouseEnter: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onPointerDown: (e: { pointerType: string }) => void;
}

interface Props {
  /** Texto que explica qué hace el control. Obligatorio y no vacío. */
  descripcion: string;
  children: (props: PropsDisparador) => ReactNode;
  className?: string;
}

const DURACION_TOQUE_MS = 2500;

/**
 * Ventana explicativa accesible: se abre con el ratón, con el foco del teclado
 * y al tocar en pantallas táctiles; se cierra con Escape, al salir o al perder
 * el foco. El texto se asocia al control con aria-describedby.
 */
export function Explicacion({ descripcion, children, className = "" }: Props) {
  if (!descripcion.trim()) {
    throw new Error("Explicacion: la descripción es obligatoria.");
  }
  const id = useId();
  const [abierta, setAbierta] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  };
  const abrir = useCallback(() => setAbierta(true), []);
  const cerrar = useCallback(() => {
    limpiar();
    setAbierta(false);
  }, []);

  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [abierta, cerrar]);

  useEffect(() => limpiar, []);

  return (
    <span className={`relative inline-flex ${className}`} onMouseLeave={cerrar}>
      {children({
        "aria-describedby": id,
        onMouseEnter: abrir,
        onFocus: abrir,
        onBlur: cerrar,
        onPointerDown: (e) => {
          if (e.pointerType !== "touch") return;
          limpiar();
          setAbierta(true);
          temporizador.current = setTimeout(() => setAbierta(false), DURACION_TOQUE_MS);
        },
      })}
      <span
        id={id}
        role="tooltip"
        hidden={!abierta}
        className="absolute left-1/2 top-full z-50 mt-2 w-max max-w-[16rem] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-sm font-normal leading-snug text-white shadow-lg"
      >
        {descripcion}
      </span>
    </span>
  );
}
