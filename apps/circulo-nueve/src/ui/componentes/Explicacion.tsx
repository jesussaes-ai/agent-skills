"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";

export interface PropsDisparador {
  "aria-describedby": string;
  onMouseEnter: () => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
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

  // Centrada bajo el control, la ventana se saldría de la pantalla junto a los bordes (p. ej. en el menú del celular).
  const ventana = useRef<HTMLSpanElement>(null);
  const [desplazamiento, setDesplazamiento] = useState(0);
  useLayoutEffect(() => {
    const el = ventana.current;
    if (!abierta || !el) return setDesplazamiento(0);
    const margen = 8;
    const { left, right } = el.getBoundingClientRect();
    const izquierda = left - desplazamiento;
    const derecha = right - desplazamiento;
    const ancho = document.documentElement.clientWidth;
    setDesplazamiento(izquierda < margen ? margen - izquierda : derecha > ancho - margen ? ancho - margen - derecha : 0);
  }, [abierta]);

  return (
    <span className={`relative inline-flex ${className}`} onMouseLeave={cerrar}>
      {children({
        "aria-describedby": id,
        onMouseEnter: abrir,
        // Solo el foco de teclado: tras un clic con ratón el botón también recibe foco.
        onFocus: (e) => {
          if (e.currentTarget.matches(":focus-visible")) abrir();
        },
        onBlur: cerrar,
        onPointerDown: (e) => {
          // Con ratón, al pulsar se cierra: la acción puede mostrar contenido nuevo debajo.
          if (e.pointerType !== "touch") return cerrar();
          limpiar();
          setAbierta(true);
          temporizador.current = setTimeout(() => setAbierta(false), DURACION_TOQUE_MS);
        },
      })}
      <span
        id={id}
        ref={ventana}
        role="tooltip"
        hidden={!abierta}
        style={desplazamiento ? { marginLeft: desplazamiento } : undefined}
        className="absolute left-1/2 top-full z-50 mt-2 w-max max-w-[16rem] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-sm font-normal leading-snug text-white shadow-lg"
      >
        {descripcion}
      </span>
    </span>
  );
}
