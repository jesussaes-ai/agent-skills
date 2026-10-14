"use client";

import { useEffect, useRef, useState } from "react";
import { decidirActualizacion } from "@/modulos/version/version";
import { Boton } from "./Boton";

const CLAVE_RECARGA = "circulo-nueve:recargada-para";
const ESPERA_MINIMA_MS = 30_000;
const CADA_MS = 5 * 60_000;

/**
 * Comprueba si se publicó otra versión cuando la app vuelve a primer plano
 * (en el celular y en la app instalada la página puede quedar abierta días).
 * Si no hay nada a medio escribir recarga sola; si lo hay, avisa con un botón.
 */
export function AvisoVersion({ version }: { version: string }) {
  const [nueva, setNueva] = useState(false);
  const editando = useRef(false);

  useEffect(() => {
    // La app no usa service worker: si el navegador conserva uno de antes, se da de baja.
    navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});

    const alEscribir = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("form")) editando.current = true;
    };
    let ultima = Date.now();
    const revisar = async () => {
      if (document.visibilityState !== "visible" || Date.now() - ultima < ESPERA_MINIMA_MS) return;
      ultima = Date.now();
      let remota: string | null = null;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (r.ok) remota = ((await r.json()) as { version?: string }).version ?? null;
      } catch {
        return;
      }
      const decision = decidirActualizacion({ local: version, remota, editando: editando.current, recargadaPara: sessionStorage.getItem(CLAVE_RECARGA) });
      if (decision === "recargar" && remota) {
        sessionStorage.setItem(CLAVE_RECARGA, remota);
        window.location.reload();
      } else if (decision === "avisar") {
        setNueva(true);
      }
    };
    const alMostrar = (e: PageTransitionEvent) => {
      if (e.persisted) ultima = 0;
      void revisar();
    };
    const alVolver = () => void revisar();
    document.addEventListener("input", alEscribir, true);
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    window.addEventListener("pageshow", alMostrar);
    const temporizador = setInterval(alVolver, CADA_MS);
    return () => {
      document.removeEventListener("input", alEscribir, true);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      window.removeEventListener("pageshow", alMostrar);
      clearInterval(temporizador);
    };
  }, [version]);

  if (!nueva) return null;
  return (
    <div
      role="status"
      data-testid="aviso-version"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-oro-400 bg-marino-900 px-4 py-3 text-white shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <strong>Hay una versión nueva de Círculo Nueve.</strong> Guarda lo que estés escribiendo y actualiza para ver los cambios.
        </p>
        <Boton
          variante="secundario"
          descripcion="Recarga la página con la versión más reciente. Lo que no hayas guardado en esta pantalla se pierde."
          onClick={() => window.location.reload()}
        >
          Actualizar ahora
        </Boton>
      </div>
    </div>
  );
}
