"use client";

import { useLayoutEffect, useState } from "react";
import { Boton } from "./Boton";
import { CLAVE_TEMA } from "./tema";

type Tema = "claro" | "oscuro";

function temaVisible(): Tema {
  const elegido = document.documentElement.dataset.tema;
  if (elegido === "claro" || elegido === "oscuro") return elegido;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

/** Botón 🌙/☀️ de la cabecera: alterna el tema con un toque y lo recuerda en el equipo. */
export function BotonTema() {
  const [tema, setTema] = useState<Tema | null>(null);

  // La CSP con nonce no deja usar un script en línea: el tema guardado se aplica al montar el botón,
  // que está en la cabecera de todas las pantallas.
  useLayoutEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_TEMA);
      if (guardado === "claro" || guardado === "oscuro") document.documentElement.dataset.tema = guardado;
    } catch {
      // Sin almacenamiento: se sigue el tema del sistema.
    }
    setTema(temaVisible());
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiarSistema = () => setTema(temaVisible());
    consulta.addEventListener("change", alCambiarSistema);
    return () => consulta.removeEventListener("change", alCambiarSistema);
  }, []);

  const cambiar = () => {
    const siguiente: Tema = temaVisible() === "oscuro" ? "claro" : "oscuro";
    document.documentElement.dataset.tema = siguiente;
    try {
      localStorage.setItem(CLAVE_TEMA, siguiente);
    } catch {
      // Sin almacenamiento (navegación privada): el tema dura hasta cerrar la pestaña.
    }
    setTema(siguiente);
  };

  const oscuro = tema === "oscuro";
  const etiqueta = oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  return (
    <Boton
      variante="icono"
      // Fondo propio con contraste: el emoji 🌙 es amarillo y sobre blanco no se distinguiría.
      className="!h-9 !w-9 text-base"
      style={{ background: "#0f1b33", borderColor: "#d4a94f" }}
      aria-label={etiqueta}
      data-testid="boton-tema"
      descripcion={`Cambia entre tema claro y oscuro (ahora: ${oscuro ? "oscuro" : "claro"}). Se recuerda en este equipo; si nunca lo pulsas, sigue el tema de tu sistema.`}
      onClick={cambiar}
    >
      <span aria-hidden="true">{oscuro ? "☀️" : "🌙"}</span>
    </Boton>
  );
}
