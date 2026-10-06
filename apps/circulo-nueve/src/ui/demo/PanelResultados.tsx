"use client";

import { useState } from "react";
import type { ErrorNumerologia, Indicador, ResultadoNumerologia } from "@/modulos/calculo/numerologia";
import { Boton } from "@/ui/componentes/Boton";
import { Etiqueta, Seccion } from "@/ui/componentes/Seccion";
import type { Perfil } from "./tipos";

interface Props {
  perfil: Perfil;
  resultado: ResultadoNumerologia | ErrorNumerologia;
  onEditar: () => void;
  onBorrar: () => void;
}

function TarjetaIndicador({ indicador }: { indicador: Indicador }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{indicador.nombre}</p>
          <p className="text-sm text-slate-600">{indicador.descripcion}</p>
        </div>
        <p className="text-3xl font-bold text-marino-800" aria-label={`Valor ${indicador.valor}`}>
          {indicador.valor}
        </p>
      </div>
      {indicador.esMaestro && (
        <p className="mt-2">
          <Etiqueta>Número maestro</Etiqueta>
        </p>
      )}
      <div className="mt-3">
        <Boton
          variante="sutil"
          className="px-0"
          aria-expanded={abierta}
          descripcion={`${abierta ? "Oculta" : "Muestra"} cada operación usada para obtener ${indicador.nombre.toLowerCase()}.`}
          onClick={() => setAbierta((v) => !v)}
        >
          {abierta ? "Ocultar pasos" : "Ver pasos"}
        </Boton>
      </div>
      {abierta && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {indicador.pasos.map((p, i) => (
            <li key={i}>
              <span className="font-medium">{p.descripcion}:</span> <code className="break-words">{p.operacion}</code>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

export function PanelResultados({ perfil, resultado, onEditar, onBorrar }: Props) {
  const [verDatos, setVerDatos] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">
          Resultados{perfil.nombrePreferido ? ` de ${perfil.nombrePreferido}` : ""}
        </h2>
        {perfil.esDemo && <Etiqueta tono="ambar">Datos ficticios de demostración</Etiqueta>}
      </div>
      <div className="flex flex-wrap gap-3">
        <Boton variante="secundario" descripcion="Vuelve al formulario para corregir datos o cambiar las reglas." onClick={onEditar}>
          Editar perfil
        </Boton>
        <Boton variante="secundario" descripcion="Borra el perfil, los permisos y los resultados de esta sesión y vuelve al inicio." onClick={onBorrar}>
          Borrar datos de la sesión
        </Boton>
      </div>

      <Seccion titulo="Numerología" ayuda="numerologia" etiqueta={<Etiqueta>Calculada</Etiqueta>}>
        {!resultado.ok ? (
          <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">No se pudo calcular:</p>
            <ul className="list-disc pl-5">
              {resultado.errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="grid gap-3 sm:grid-cols-2">
              {resultado.indicadores.map((i) => (
                <TarjetaIndicador key={i.clave} indicador={i} />
              ))}
            </ul>
            {resultado.advertencias.length > 0 && (
              <ul className="list-disc rounded-lg bg-amber-50 py-3 pl-8 pr-3 text-sm text-amber-950">
                {resultado.advertencias.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <Boton
                variante="sutil"
                className="px-0"
                aria-expanded={verDatos}
                aria-controls="datos-calculo"
                descripcion="Muestra el motor, la versión, las reglas y las entradas normalizadas para poder reproducir el cálculo."
                onClick={() => setVerDatos((v) => !v)}
              >
                {verDatos ? "Ocultar datos del cálculo" : "Ver datos del cálculo (reproducibilidad)"}
              </Boton>
              <dl id="datos-calculo" hidden={!verDatos} className="mt-2 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
                <dt className="font-medium">Tradición</dt>
                <dd>{resultado.tradicion}</dd>
                <dt className="font-medium">Motor</dt>
                <dd>
                  {resultado.motor} v{resultado.motorVersion}
                </dd>
                <dt className="font-medium">Reglas</dt>
                <dd>
                  {resultado.reglasVersion} · maestros {resultado.reglas.numerosMaestros ? "sí" : "no"} · Y{" "}
                  {resultado.reglas.y} · ñ {resultado.reglas.enye} · {resultado.reglas.metodoCaminoDeVida} ·{" "}
                  {resultado.reglas.metodoNombre}
                </dd>
                {resultado.entradas.nombreNormalizado && (
                  <>
                    <dt className="font-medium">Nombre normalizado</dt>
                    <dd>{resultado.entradas.nombreNormalizado}</dd>
                  </>
                )}
                {resultado.cambios.length > 0 && (
                  <>
                    <dt className="font-medium">Cambios aplicados</dt>
                    <dd>{resultado.cambios.map((c) => `«${c.original}» → «${c.resultado}» (${c.regla})`).join("; ")}</dd>
                  </>
                )}
              </dl>
            </div>
            <p className="text-sm text-slate-600">
              <Etiqueta tono="gris">Interpretación pendiente</Etiqueta> Las interpretaciones se basarán en los libros
              que aporte el propietario, con citas. Aquí solo se muestran datos calculados.
            </p>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Carta natal" ayuda="carta-natal" etiqueta={<Etiqueta tono="gris">Pendiente</Etiqueta>}>
        <p className="text-slate-700">
          Aún no se calcula. Falta elegir y validar el motor de efemérides y la resolución de zona horaria histórica.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">
          <li>Fecha: {perfil.fecha || "no indicada"}</li>
          <li>
            Hora: {perfil.precisionHora === "desconocida" ? "desconocida (la carta se haría sin casas ni ascendente)" : `${perfil.hora || "no indicada"} (${perfil.precisionHora})`}
          </li>
          <li>Lugar: {perfil.lugar || "no indicado"}</li>
          <li>Zona horaria: {perfil.zonaHoraria || "no indicada (no se adivina)"}</li>
        </ul>
      </Seccion>

      <Seccion titulo="Cábala" ayuda="cabala" etiqueta={<Etiqueta tono="gris">Pendiente</Etiqueta>}>
        <p className="text-slate-700">
          Aún no se calcula. Primero hay que confirmar la tradición y la tabla de gematría a partir de los libros del
          propietario. Los nombres no se transliteran sin aprobación.
        </p>
      </Seccion>
    </div>
  );
}
