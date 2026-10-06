"use client";

import { useMemo, useState } from "react";
import {
  CONFIG_POR_DEFECTO,
  NOMBRES_AYANAMSA,
  NOMBRES_SISTEMA_CASAS,
  calcularCartaNatal,
  type ClasePrecision,
  type ConfigAstrologia,
  type LugarNacimiento,
  type ResultadoCarta,
} from "@/modulos/calculo/astrologia";
import { Boton } from "@/ui/componentes/Boton";
import { Etiqueta, Seccion } from "@/ui/componentes/Seccion";
import type { Perfil } from "@/ui/demo/tipos";
import { AjustesCarta } from "./AjustesCarta";
import { BuscadorLugar } from "./BuscadorLugar";
import { RuedaCarta } from "./RuedaCarta";
import { GLOSARIO, Termino } from "./Termino";

/** Lugar de la persona ficticia de la demo (GeoNames 3530597). */
const LUGAR_DEMO: LugarNacimiento = {
  nombre: "Mexico City, México (lugar de la demostración)",
  latitud: 19.42847,
  longitud: -99.12766,
  zonaHoraria: "America/Mexico_City",
  incertidumbreGrados: 0.15,
  fuente: { tipo: "geonames", geonameId: 3530597, atribucion: "Datos de lugares: GeoNames (geonames.org), licencia CC BY 4.0." },
};

const ETIQUETA_PRECISION: Record<ClasePrecision, { texto: string; tono: "violeta" | "ambar" | "gris" }> = {
  minuto: { texto: "al minuto", tono: "violeta" },
  grado: { texto: "≈ grado", tono: "gris" },
  rango: { texto: "rango", tono: "ambar" },
};

const PRECISION_HORA = { exacta: "exacta", aproximada: "aproximada", desconocida: "desconocida" } as const;

function Resultados({ r }: { r: ResultadoCarta }) {
  const [verDatos, setVerDatos] = useState(false);
  const cuerpos = r.posiciones.filter((p) => p.clave !== "asc" && p.clave !== "mc");
  const angulos = r.posiciones.filter((p) => p.clave === "asc" || p.clave === "mc");
  const nombre = (clave: string) => r.posiciones.find((p) => p.clave === clave)?.nombre ?? clave;

  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        Hora local {r.entradas.hora ?? "desconocida (referencia 12:00)"} ({PRECISION_HORA[r.entradas.precisionHora]}
        {r.entradas.precisionHora === "aproximada" ? ` ±${r.entradas.margenMinutos} min` : ""}) en {r.tiempo.zonaHoraria} →{" "}
        <strong>
          {r.tiempo.utc.replace("T", " ").replace("Z", "")} UT ({r.tiempo.desfaseTexto})
        </strong>
        . Zodiaco {r.config.zodiaco}
        {r.config.zodiaco === "sideral" ? ` (${NOMBRES_AYANAMSA[r.config.ayanamsa]})` : ""}
        {r.casas ? ` · casas ${NOMBRES_SISTEMA_CASAS[r.casas.sistemaUsado]}` : " · sin casas"}.
      </p>

      {r.advertencias.length > 0 && (
        <ul aria-label="Avisos sobre la precisión" className="list-disc rounded-lg bg-amber-50 py-3 pl-8 pr-3 text-sm text-amber-950">
          {r.advertencias.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <RuedaCarta resultado={r} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-2 text-left font-semibold text-slate-900">Posiciones calculadas</caption>
            <thead className="text-slate-600">
              <tr>
                <th scope="col" className="py-1 pr-3">Punto</th>
                <th scope="col" className="py-1 pr-3">
                  <Termino explicacion={GLOSARIO.longitud}>Posición</Termino>
                </th>
                <th scope="col" className="py-1 pr-3">
                  <Termino explicacion={GLOSARIO.precision}>Precisión</Termino>
                </th>
                {r.casas && (
                  <th scope="col" className="py-1 pr-3">
                    <Termino explicacion={GLOSARIO.casa}>Casa</Termino>
                  </th>
                )}
                <th scope="col" className="py-1">
                  <Termino explicacion={GLOSARIO.movimiento}>Mov.</Termino>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...angulos, ...cuerpos].map((p) => (
                <tr key={p.clave} className="border-t border-slate-100">
                  <th scope="row" className="py-1.5 pr-3 font-medium text-slate-900">
                    <span aria-hidden className="mr-1 inline-block w-5 text-marino-800">
                      {p.simbolo}
                    </span>
                    {p.clave === "asc" ? (
                      <Termino explicacion={GLOSARIO.ascendente}>{p.nombre}</Termino>
                    ) : p.clave === "mc" ? (
                      <Termino explicacion={GLOSARIO.medioCielo}>{p.nombre}</Termino>
                    ) : (
                      p.nombre
                    )}
                  </th>
                  <td className="py-1.5 pr-3">{p.texto}</td>
                  <td className="py-1.5 pr-3">
                    <Etiqueta tono={ETIQUETA_PRECISION[p.precision].tono}>{ETIQUETA_PRECISION[p.precision].texto}</Etiqueta>
                  </td>
                  {r.casas && (
                    <td className="py-1.5 pr-3">
                      {p.casasPosibles && p.casasPosibles.length > 1 ? p.casasPosibles.join(" o ") : (p.casa ?? "—")}
                    </td>
                  )}
                  <td className="py-1.5">
                    {p.retrogrado === undefined ? "—" : p.retrogradoIncierto ? "estacionario" : p.retrogrado ? "℞" : "directo"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {r.casas && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-2 text-left font-semibold text-slate-900">
              Cúspides de las casas · {NOMBRES_SISTEMA_CASAS[r.casas.sistemaUsado]}
              {r.casas.sistemaUsado !== r.casas.sistemaSolicitado ? ` (en lugar de ${NOMBRES_SISTEMA_CASAS[r.casas.sistemaSolicitado]})` : ""}
            </caption>
            <tbody className="grid gap-x-6 sm:grid-cols-2">
              {r.casas.cuspides.map((c) => (
                <tr key={c.casa} className="flex justify-between border-t border-slate-100 py-1">
                  <th scope="row" className="font-medium text-slate-900">
                    Casa {c.casa}
                  </th>
                  <td>{c.texto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left font-semibold text-slate-900">Aspectos ({r.aspectos.length})</caption>
          <thead className="text-slate-600">
            <tr>
              <th scope="col" className="py-1 pr-3">Puntos</th>
              <th scope="col" className="py-1 pr-3">Aspecto</th>
              <th scope="col" className="py-1 pr-3">
                <Termino explicacion={GLOSARIO.orbe}>Orbe</Termino>
              </th>
              <th scope="col" className="py-1">
                <Termino explicacion={GLOSARIO.aplicativo}>Fase</Termino>
              </th>
            </tr>
          </thead>
          <tbody>
            {r.aspectos.map((a) => (
              <tr key={`${a.a}-${a.b}-${a.aspecto}`} className="border-t border-slate-100">
                <td className="py-1.5 pr-3">
                  {nombre(a.a)} – {nombre(a.b)}
                </td>
                <td className="py-1.5 pr-3">
                  {a.nombre} ({a.angulo}°)
                  {a.incierto && (
                    <span className="ml-2">
                      <Termino explicacion={GLOSARIO.incierto}>
                        <Etiqueta tono="ambar">incierto</Etiqueta>
                      </Termino>
                    </span>
                  )}
                </td>
                {/* Orbe al grado: no se atribuye más precisión que la de los datos. */}
                <td className="py-1.5 pr-3">
                  {a.incierto ? "≈" : ""}
                  {a.orbe < 1 ? "<1" : Math.round(a.orbe)}° de ±{a.orbeMaximo}°
                </td>
                <td className="py-1.5">{a.fase ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <Boton
          variante="sutil"
          className="px-0"
          aria-expanded={verDatos}
          aria-controls="datos-carta"
          descripcion="Muestra el motor, las efemérides, la zona horaria y cada paso del cálculo para poder reproducirlo."
          onClick={() => setVerDatos((v) => !v)}
        >
          {verDatos ? "Ocultar datos del cálculo" : "Ver datos del cálculo (reproducibilidad)"}
        </Boton>
        <dl id="datos-carta" hidden={!verDatos} className="mt-2 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="font-medium">Motor</dt>
          <dd>
            {r.motor} v{r.motorVersion} · reglas {r.reglasVersion}
          </dd>
          <dt className="font-medium">Efemérides</dt>
          <dd>{r.efemerides}</dd>
          {r.pasos.map((p) => (
            <div key={p.descripcion} className="contents">
              <dt className="font-medium">{p.descripcion}</dt>
              <dd className="break-words">{p.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-sm text-slate-600">
        <Etiqueta tono="gris">Interpretación pendiente</Etiqueta> {r.interpretaciones.motivo}
      </p>
    </div>
  );
}

export function SeccionCartaNatal({ perfil }: { perfil: Perfil }) {
  const [lugar, setLugar] = useState<LugarNacimiento | null>(null);
  const [config, setConfig] = useState<ConfigAstrologia>(CONFIG_POR_DEFECTO);
  const [ocurrencia, setOcurrencia] = useState<"primera" | "segunda" | undefined>();
  const [verAjustes, setVerAjustes] = useState(false);

  const resultado = useMemo(() => {
    if (!perfil.fecha) return null;
    return calcularCartaNatal(
      {
        fecha: perfil.fecha,
        hora: perfil.hora || undefined,
        precisionHora: perfil.precisionHora,
        lugar: lugar ?? undefined,
        zonaHoraria: perfil.zonaHoraria.trim() || undefined,
        ocurrencia,
      },
      config,
    );
  }, [perfil, lugar, config, ocurrencia]);

  return (
    <Seccion
      titulo="Carta natal"
      ayuda="carta-natal"
      etiqueta={resultado?.ok ? <Etiqueta>Calculada</Etiqueta> : <Etiqueta tono="gris">Faltan datos</Etiqueta>}
    >
      <div className="space-y-5">
        {perfil.esDemo && !lugar && (
          <Boton
            variante="secundario"
            descripcion="Usa la Ciudad de México (coordenadas de GeoNames) como lugar de la persona ficticia."
            onClick={() => setLugar(LUGAR_DEMO)}
          >
            Usar el lugar de la demostración
          </Boton>
        )}
        <BuscadorLugar consultaInicial={perfil.esDemo ? "" : perfil.lugar} lugar={lugar} onElegir={setLugar} />

        <div className="rounded-xl border border-slate-200 p-4">
          <Boton
            variante="sutil"
            className="px-0"
            aria-expanded={verAjustes}
            descripcion="Muestra u oculta el zodiaco, la ayanamsa, el sistema de casas, el nodo y los orbes de los aspectos."
            onClick={() => setVerAjustes((v) => !v)}
          >
            {verAjustes ? "Ocultar ajustes de cálculo" : "Ajustes de cálculo (zodiaco, casas, aspectos)"}
          </Boton>
          {verAjustes && (
            <div className="mt-3">
              <AjustesCarta config={config} onCambiar={setConfig} />
            </div>
          )}
        </div>

        {!resultado ? (
          <p className="text-slate-700">Falta la fecha de nacimiento. Vuelve al perfil para indicarla.</p>
        ) : !resultado.ok ? (
          <div role="alert" className="space-y-3 rounded-lg bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">No se pudo calcular la carta:</p>
            <ul className="list-disc pl-5">
              {resultado.errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            {resultado.opcionesHoraRepetida && (
              <div className="flex flex-wrap gap-3">
                {resultado.opcionesHoraRepetida.map((o) => (
                  <Boton
                    key={o.ocurrencia}
                    variante="secundario"
                    descripcion={`Usa la ${o.ocurrencia} vez que el reloj marcó esa hora (${o.desfaseTexto}).`}
                    onClick={() => setOcurrencia(o.ocurrencia)}
                  >
                    {o.ocurrencia === "primera" ? "Primera" : "Segunda"} ocurrencia ({o.desfaseTexto})
                  </Boton>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Resultados r={resultado} />
        )}
      </div>
    </Seccion>
  );
}
