"use client";

import { Boton } from "./Boton";

/** Primer elemento enfocable: lleva el foco al contenido principal (WCAG 2.4.1). */
export function SaltoContenido() {
  return (
    <div className="absolute left-2 top-2 z-50 -translate-y-24 transition-transform focus-within:translate-y-0">
      <Boton
        variante="secundario"
        className="shadow-md"
        descripcion="Salta el menú y lleva el foco directo al contenido de esta página."
        onClick={() => {
          const principal = document.getElementById("contenido");
          principal?.focus();
          principal?.scrollIntoView({ block: "start" });
        }}
      >
        Saltar al contenido
      </Boton>
    </div>
  );
}
