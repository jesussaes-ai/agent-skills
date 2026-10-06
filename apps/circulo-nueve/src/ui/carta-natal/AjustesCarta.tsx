"use client";

import type { ReactNode } from "react";
import {
  ASPECTOS,
  CONFIG_POR_DEFECTO,
  NOMBRES_AYANAMSA,
  NOMBRES_SISTEMA_CASAS,
  SISTEMAS_RESPALDO,
  type ClaveAyanamsa,
  type ConfigAstrologia,
  type SistemaCasas,
  type SistemaRespaldoPolar,
  type TipoNodo,
  type Zodiaco,
} from "@/modulos/calculo/astrologia";
import { AyudaContextual } from "@/ui/componentes/AyudaContextual";
import { Boton } from "@/ui/componentes/Boton";

const claseCampo = "rounded-lg border border-slate-300 px-3 py-2 text-base";

function Campo({ etiqueta, nota, children }: { etiqueta: string; nota?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {etiqueta}
      {children}
      {nota && <span className="text-xs font-normal text-slate-500">{nota}</span>}
    </label>
  );
}

interface Props {
  config: ConfigAstrologia;
  onCambiar: (c: ConfigAstrologia) => void;
}

export function AjustesCarta({ config, onCambiar }: Props) {
  const set = <K extends keyof ConfigAstrologia>(k: K, v: ConfigAstrologia[K]) => onCambiar({ ...config, [k]: v });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold text-slate-900">Ajustes de cálculo</h3>
        <AyudaContextual seccion="carta-natal-ajustes" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Zodiaco" nota="Tropical: referido al equinoccio. Sideral: referido a las estrellas, restando una ayanamsa.">
          <select className={claseCampo} value={config.zodiaco} onChange={(e) => set("zodiaco", e.target.value as Zodiaco)}>
            <option value="tropical">Tropical</option>
            <option value="sideral">Sideral</option>
          </select>
        </Campo>
        {config.zodiaco === "sideral" && (
          <Campo etiqueta="Ayanamsa" nota="Valores de Swiss Ephemeris en J2000 más la precesión IAU 2006.">
            <select className={claseCampo} value={config.ayanamsa} onChange={(e) => set("ayanamsa", e.target.value as ClaveAyanamsa)}>
              {Object.entries(NOMBRES_AYANAMSA).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Sistema de casas">
          <select className={claseCampo} value={config.sistemaCasas} onChange={(e) => set("sistemaCasas", e.target.value as SistemaCasas)}>
            {Object.entries(NOMBRES_SISTEMA_CASAS).map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Respaldo en latitudes polares" nota="Se usa si Placidus, Koch, Regiomontano o Campano no están definidos (más allá de ~66,5°).">
          <select
            className={claseCampo}
            value={config.respaldoPolar}
            onChange={(e) => set("respaldoPolar", e.target.value as SistemaRespaldoPolar)}
          >
            {SISTEMAS_RESPALDO.map((k) => (
              <option key={k} value={k}>
                {NOMBRES_SISTEMA_CASAS[k]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Nodo lunar">
          <select className={claseCampo} value={config.nodo} onChange={(e) => set("nodo", e.target.value as TipoNodo)}>
            <option value="verdadero">Verdadero (osculador)</option>
            <option value="medio">Medio</option>
          </select>
        </Campo>
        <Campo etiqueta="Margen de una hora aproximada" nota="Cuánto puede desviarse la hora que marcaste como aproximada.">
          <select
            className={claseCampo}
            value={config.margenAproximadaMin}
            onChange={(e) => set("margenAproximadaMin", Number(e.target.value))}
          >
            {[5, 10, 15, 30, 60, 120].map((m) => (
              <option key={m} value={m}>
                ±{m} min
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-900">Aspectos y orbes (grados)</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {config.aspectos.map((a, i) => {
            const def = ASPECTOS[a.clave];
            const cambiar = (cambio: Partial<typeof a>) =>
              set(
                "aspectos",
                config.aspectos.map((x, j) => (j === i ? { ...x, ...cambio } : x)),
              );
            return (
              <li key={a.clave} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <label className="flex flex-1 items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" checked={a.activo} onChange={(e) => cambiar({ activo: e.target.checked })} />
                  {def.nombre} ({def.angulo}°){def.mayor ? "" : " · menor"}
                </label>
                <label className="flex items-center gap-1">
                  <span className="sr-only">Orbe de {def.nombre}</span>±
                  <input
                    type="number"
                    min={0}
                    max={12}
                    step={0.5}
                    className="w-16 rounded border border-slate-300 px-2 py-1"
                    value={a.orbe}
                    disabled={!a.activo}
                    onChange={(e) => cambiar({ orbe: Math.min(12, Math.max(0, Number(e.target.value) || 0)) })}
                  />
                  °
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <Boton
        variante="sutil"
        className="px-0"
        descripcion="Vuelve a los valores por defecto: tropical, Placidus con respaldo Porfirio, nodo verdadero y orbes estándar."
        onClick={() => onCambiar(CONFIG_POR_DEFECTO)}
      >
        Restablecer ajustes
      </Boton>
    </div>
  );
}
