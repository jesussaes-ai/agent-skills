"use client";

import { useActionState, useRef, useState } from "react";
import { accionPreguntarBiblioteca, type RespuestaBiblioteca } from "@/modulos/biblioteca/acciones";
import { formatearLocalizador } from "@/modulos/biblioteca/respuesta";
import type { FragmentoRecuperado } from "@/modulos/biblioteca/tipos";
import { BotonEnviar } from "@/ui/auth/Campos";
import { Boton } from "@/ui/componentes/Boton";
import { Etiqueta } from "@/ui/componentes/Seccion";
import { Casilla } from "@/ui/expedientes/Selector";

const TIPO: Record<string, string> = { textual: "Cita textual", parafrasis: "Paráfrasis", sintesis: "Síntesis" };

function Pasaje({ fragmento }: { fragmento: FragmentoRecuperado }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <li className="text-sm text-slate-700">
      <span className="font-medium">{fragmento.titulo}</span>
      {fragmento.autor ? `, ${fragmento.autor}` : ""}
      {fragmento.edicion ? `, ${fragmento.edicion}` : ""} — {formatearLocalizador(fragmento.localizador) || fragmento.referencia}{" "}
      <Etiqueta tono={fragmento.grupo === "aportada" ? "violeta" : "gris"}>{fragmento.grupo === "aportada" ? "Aportada" : "Complementaria"}</Etiqueta>{" "}
      {fragmento.esDemo && <Etiqueta tono="ambar">DEMO</Etiqueta>}{" "}
      {fragmento.sospechoso && <Etiqueta tono="ambar">Posible instrucción incrustada</Etiqueta>}
      <Boton
        variante="sutil"
        className="text-sm"
        aria-expanded={abierto}
        descripcion={`${abierto ? "Oculta" : "Muestra"} el pasaje exacto de la fuente que sustenta esta parte de la respuesta.`}
        onClick={() => setAbierto((v) => !v)}
      >
        {abierto ? "Ocultar pasaje" : "Ver pasaje"}
      </Boton>
      {abierto && <blockquote className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{fragmento.texto}</blockquote>}
    </li>
  );
}

export function BotBiblioteca({ proveedor }: { proveedor: string | null }) {
  const [respuesta, accion] = useActionState(accionPreguntarBiblioteca, { estado: "ok" } as RespuestaBiblioteca);
  const formulario = useRef<HTMLFormElement>(null);
  // Controlado: React vacía los campos no controlados tras cada acción, y la
  // autorización para incluir complementarias reenvía la misma pregunta.
  const [pregunta, setPregunta] = useState("");
  const porId = new Map((respuesta.fragmentos ?? []).map((f) => [f.chunkId, f]));
  const p = respuesta.proporcion;

  return (
    <div className="space-y-5">
      <form ref={formulario} action={accion} className="space-y-3" noValidate>
        <label htmlFor="pregunta-biblioteca" className="text-sm font-medium text-slate-700">
          Tu pregunta
        </label>
        <textarea
          id="pregunta-biblioteca"
          name="pregunta"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          placeholder="Por ejemplo: ¿qué dice el manual sobre los números maestros?"
        />
        {respuesta.errores?.pregunta && <p className="text-sm text-red-700">{respuesta.errores.pregunta}</p>}
        <Casilla etiqueta="Incluir también fuentes complementarias" name="incluirComplementarias" />
        {proveedor ? (
          <Casilla etiqueta={`Enviar la pregunta y los fragmentos recuperados a ${proveedor} para redactar la respuesta`} name="enviarALlm" />
        ) : (
          <p className="text-xs text-slate-500">Sin proveedor de IA configurado: el bot responde con citas literales de las fuentes y nada sale del servidor.</p>
        )}
        <BotonEnviar descripcion="Busca en la biblioteca (texto y significado) solo entre las fuentes que puedes consultar y responde con citas verificables.">
          Preguntar a la biblioteca
        </BotonEnviar>
      </form>

      <div aria-live="polite" className="space-y-4">
        {respuesta.estado === "error" && respuesta.mensaje && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{respuesta.mensaje}</p>
        )}
        {(respuesta.estado === "sin_aportadas" || respuesta.estado === "sin_resultados") && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950" data-testid="sin-respaldo">
            <p>{respuesta.mensaje}</p>
            {respuesta.estado === "sin_aportadas" && (
              <Boton
                variante="secundario"
                className="mt-2"
                descripcion="Autorizas buscar también en las fuentes complementarias para esta pregunta."
                onClick={() => {
                  const f = formulario.current;
                  if (!f) return;
                  const casilla = f.querySelector<HTMLInputElement>('input[name="incluirComplementarias"]');
                  if (casilla) casilla.checked = true;
                  f.requestSubmit();
                }}
              >
                Buscar también en complementarias
              </Boton>
            )}
          </div>
        )}
        {respuesta.estado === "ok" && respuesta.afirmaciones && (
          <>
            <p className="text-xs text-slate-500">
              {respuesta.modo === "llm" ? `Respuesta redactada por ${respuesta.proveedor} y validada contra los fragmentos.` : "Modo extractivo: citas literales, sin IA."}
              {respuesta.incluyoComplementarias ? " Incluye fuentes complementarias (autorizado)." : " Solo fuentes aportadas."}
            </p>
            <ol className="space-y-3" data-testid="respuesta-biblioteca">
              {respuesta.afirmaciones.map((a, i) => (
                <li key={i} className="rounded-xl border border-slate-200 p-3">
                  <p className="mb-1">
                    {a.tipoCita ? <Etiqueta>{TIPO[a.tipoCita]}</Etiqueta> : <Etiqueta tono="ambar">Interpretación general (IA), sin respaldo en las fuentes</Etiqueta>}
                  </p>
                  <p className="text-slate-800">{a.tipoCita === "textual" ? `«${a.texto}»` : a.texto}</p>
                  {a.avisos.map((av) => (
                    <p key={av} className="text-xs text-amber-800">{av}</p>
                  ))}
                  <ul className="mt-2 space-y-1">
                    {a.chunkIds.map((id) => porId.get(id)).filter((f): f is FragmentoRecuperado => Boolean(f)).map((f) => (
                      <Pasaje key={f.chunkId} fragmento={f} />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            {p && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700" data-testid="proporcion">
                Fuentes aportadas: <strong>{p.proporcion === null ? "—" : `${Math.round(p.proporcion * 100)} %`}</strong> de {p.citadas} afirmación
                {p.citadas === 1 ? "" : "es"} citada{p.citadas === 1 ? "" : "s"} (objetivo {Math.round(p.objetivo * 100)} %){" "}
                {p.cumple === null ? "" : p.cumple ? <Etiqueta>Cumple</Etiqueta> : <Etiqueta tono="ambar">No cumple: faltan fuentes aportadas</Etiqueta>}
                {p.sinRespaldo > 0 && <span> · {p.sinRespaldo} sin respaldo (no cuentan)</span>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
