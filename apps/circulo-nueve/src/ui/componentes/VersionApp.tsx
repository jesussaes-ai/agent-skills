"use client";

import { useEffect, useState } from "react";
import { compararVersiones, hayActualizacion } from "@/modulos/version/version";
import { Boton } from "./Boton";
import { EnlaceBoton } from "./EnlaceBoton";

const ESPERA_MINIMA_MS = 30_000;
const CADA_MS = 30 * 60_000;

/**
 * Versión visible arriba en todas las pantallas y aviso de versión nueva.
 * Comprueba al abrir, al volver a la app y cada 30 min. Nunca recarga sola:
 * propone «⬆️ Actualizar a la vX» para no perder lo que se esté escribiendo.
 */
export function VersionApp({ despliegue, numero }: { despliegue: string; numero: string }) {
  const [nueva, setNueva] = useState<string | null>(null);
  const [avisoOculto, setAvisoOculto] = useState(false);

  useEffect(() => {
    // La app no usa service worker: si el navegador conserva uno de antes, se da de baja.
    navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    let ultima = 0;
    const revisar = async () => {
      if (document.visibilityState !== "visible" || Date.now() - ultima < ESPERA_MINIMA_MS) return;
      ultima = Date.now();
      try {
        const r = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { version?: string; numero?: string };
        if (hayActualizacion({ local: despliegue, remota: d.version })) {
          // Un despliegue nuevo con el mismo número también se ofrece (correcciones sin cambio de versión).
          setNueva(d.numero && compararVersiones(d.numero, numero) >= 0 ? d.numero : numero);
        }
      } catch {
        // Sin internet: se sigue con la versión actual, sin mostrar error.
      }
    };
    const alMostrar = (e: PageTransitionEvent) => {
      if (e.persisted) ultima = 0;
      void revisar();
    };
    const alVolver = () => void revisar();
    void revisar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    window.addEventListener("pageshow", alMostrar);
    const temporizador = setInterval(() => {
      ultima = 0;
      void revisar();
    }, CADA_MS);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      window.removeEventListener("pageshow", alMostrar);
      clearInterval(temporizador);
    };
  }, [despliegue, numero]);

  const actualizar = () => window.location.reload();

  return (
    <>
      <EnlaceBoton
        href="/linea-del-tiempo"
        descripcion={
          nueva
            ? `Estás usando la v${numero} y hay una más nueva (v${nueva}). Pulsa para ver la línea del tiempo de versiones.`
            : `Estás usando la v${numero}, la última publicada. Pulsa para ver la línea del tiempo de versiones.`
        }
        className="rounded-full border border-marino-200 bg-white px-2.5 py-0.5 text-xs tabular-nums no-underline hover:underline"
      >
        <span data-testid="version-app">v{numero}</span>
      </EnlaceBoton>
      {nueva && (
        <Boton
          variante="primario"
          className="px-3 py-1 text-sm"
          data-testid="boton-actualizar"
          descripcion={`Recarga Círculo Nueve con la v${nueva}. Guarda antes lo que estés escribiendo en esta pantalla.`}
          onClick={actualizar}
        >
          ⬆️ Actualizar a la v{nueva}
        </Boton>
      )}
      {nueva && !avisoOculto && (
        <div
          role="status"
          data-testid="aviso-version"
          className="fixed inset-x-0 bottom-0 z-[60] border-t-2 border-oro-400 bg-marino-900 px-4 py-3 text-white shadow-lg"
        >
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>Hay una versión nueva: v{nueva}</strong> (tienes la v{numero}). Guarda lo que estés escribiendo y actualiza.
            </p>
            <div className="flex gap-2">
              <Boton variante="secundario" descripcion={`Recarga la página con la v${nueva}.`} onClick={actualizar}>
                Actualizar
              </Boton>
              <Boton
                variante="sutil"
                className="text-white"
                descripcion="Oculta este aviso. El botón «⬆️ Actualizar» de arriba se queda para cuando quieras."
                onClick={() => setAvisoOculto(true)}
              >
                Más tarde
              </Boton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
