"use client";

import { useId, useState } from "react";
import { ETIQUETA_ESTADO, enlaceAyuda, obtenerSeccionAyuda } from "@/content/ayuda";
import { Boton } from "./Boton";
import { EnlaceBoton } from "./EnlaceBoton";

export function AyudaContextual({ seccion }: { seccion: string }) {
  const ayuda = obtenerSeccionAyuda(seccion);
  const [abierta, setAbierta] = useState(false);
  const panelId = useId();

  return (
    <div className="contents">
      <Boton
        variante="icono"
        aria-label={`Ayuda: ${ayuda.titulo}`}
        aria-expanded={abierta}
        aria-controls={panelId}
        descripcion={`${abierta ? "Ocultar" : "Mostrar"} la ayuda de «${ayuda.titulo}»: de qué trata, qué datos usa y cómo se usa.`}
        onClick={() => setAbierta((v) => !v)}
      >
        ?
      </Boton>
      <div
        id={panelId}
        hidden={!abierta}
        className="basis-full rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-slate-800"
      >
        <p className="mb-2 font-semibold">
          {ayuda.titulo} · <span className="font-normal">{ETIQUETA_ESTADO[ayuda.estado]}</span>
        </p>
        <p className="mb-3">{ayuda.deQueTrata}</p>
        <p className="font-semibold">Qué datos usa</p>
        <ul className="mb-3 list-disc pl-5">
          {ayuda.datosQueUsa.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="font-semibold">Cómo se usa</p>
        <ul className="mb-3 list-disc pl-5">
          {ayuda.comoSeUsa.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <EnlaceBoton href={enlaceAyuda(ayuda.id)} descripcion="Abre esta sección en el Centro de ayuda." className="px-0">
          Ver en el Centro de ayuda
        </EnlaceBoton>
      </div>
    </div>
  );
}
