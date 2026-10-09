"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { agruparZonas, etiquetaZona, filtrarZonas, type GrupoZonas } from "@/modulos/calculo/zonas";
import { Boton } from "./Boton";

interface Props {
  etiqueta: string;
  /** Nombre del campo oculto que se envía con el formulario. */
  name?: string;
  valor?: string;
  onCambiar?: (zona: string) => void;
  nota?: string;
  /** Texto de la opción vacía; si se omite, no se ofrece. */
  textoAutomatica?: string;
  claseCampo?: string;
}

const AUTOMATICA = "";

/**
 * Combo con buscador (patrón ARIA «combobox» con «listbox») con todas las zonas
 * IANA del navegador, agrupadas por región, México primero y el desfase UTC actual.
 */
export function SelectorZonaHoraria({ etiqueta, name, valor = "", onCambiar, nota, textoAutomatica, claseCampo = "" }: Props) {
  const id = useId();
  const idLista = `${id}-lista`;
  const idNota = `${id}-nota`;
  const [seleccion, setSeleccion] = useState(valor);
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => setSeleccion(valor), [valor]);

  const grupos: GrupoZonas[] = useMemo(() => (abierto ? agruparZonas() : []), [abierto]);
  const visibles = useMemo(() => filtrarZonas(grupos, consulta), [grupos, consulta]);
  const opciones = useMemo(() => {
    const planas = visibles.flatMap((g) => g.zonas.map((z) => z.id));
    return textoAutomatica !== undefined && !consulta.trim() ? [AUTOMATICA, ...planas] : planas;
  }, [visibles, textoAutomatica, consulta]);

  const etiquetaSeleccion = seleccion ? etiquetaZona(seleccion) : (textoAutomatica ?? "");

  useEffect(() => {
    if (!abierto) return;
    lista.current?.querySelector(`[data-indice="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activo, abierto]);

  function elegir(zona: string) {
    setSeleccion(zona);
    onCambiar?.(zona);
    setConsulta("");
    setAbierto(false);
  }

  function abrir() {
    const i = opciones.indexOf(seleccion);
    setActivo(i >= 0 ? i : 0);
    setAbierto(true);
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) return abrir();
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setActivo((a) => Math.min(Math.max(a + paso, 0), Math.max(opciones.length - 1, 0)));
    } else if (e.key === "Enter" && abierto) {
      e.preventDefault();
      if (opciones[activo] !== undefined) elegir(opciones[activo]);
    } else if (e.key === "Escape" && abierto) {
      e.preventDefault();
      setConsulta("");
      setAbierto(false);
    }
  }

  const idOpcion = (i: number) => `${id}-op-${i}`;
  let indice = textoAutomatica !== undefined && !consulta.trim() ? 1 : 0;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      {name && <input type="hidden" name={name} value={seleccion} />}
      <div className="relative">
        <input
          ref={entrada}
          id={id}
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={abierto && opciones.length ? idOpcion(activo) : undefined}
          aria-describedby={nota ? idNota : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={abierto ? "Busca ciudad, país o desfase" : undefined}
          value={abierto ? consulta : etiquetaSeleccion}
          onChange={(e) => {
            setConsulta(e.target.value);
            setActivo(0);
            if (!abierto) setAbierto(true);
          }}
          onFocus={abrir}
          onClick={() => !abierto && abrir()}
          onBlur={() => {
            setConsulta("");
            setAbierto(false);
          }}
          onKeyDown={teclas}
          className={`w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-11 text-base ${claseCampo}`}
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
          <Boton
            variante="sutil"
            className="rounded-md px-2 py-1.5 no-underline"
            tabIndex={-1}
            aria-label={abierto ? "Cerrar la lista de zonas" : "Ver todas las zonas horarias"}
            descripcion="Abre la lista completa de zonas horarias, agrupadas por región y con México primero."
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (abierto ? setAbierto(false) : (entrada.current?.focus(), abrir()))}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d={abierto ? "M5 12l5-5 5 5" : "M5 8l5 5 5-5"} />
            </svg>
          </Boton>
        </div>
        {abierto && (
          <ul
            ref={lista}
            id={idLista}
            role="listbox"
            aria-label={etiqueta}
            className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg"
          >
            {textoAutomatica !== undefined && !consulta.trim() && (
              <li
                id={idOpcion(0)}
                data-indice={0}
                role="option"
                aria-selected={seleccion === AUTOMATICA}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(AUTOMATICA)}
                className={`cursor-pointer px-3 py-2 ${activo === 0 ? "bg-marino-50" : ""} ${seleccion === AUTOMATICA ? "font-semibold" : ""}`}
              >
                {textoAutomatica}
              </li>
            )}
            {visibles.map((g, n) => (
              <li key={g.region} role="presentation">
                <p id={`${id}-region-${n}`} className="sticky top-0 bg-oro-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-oro-800">
                  {g.region}
                </p>
                <ul role="group" aria-labelledby={`${id}-region-${n}`}>
                  {g.zonas.map((z) => {
                    const i = indice++;
                    return (
                      <li
                        key={z.id}
                        id={idOpcion(i)}
                        data-indice={i}
                        role="option"
                        aria-selected={seleccion === z.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => elegir(z.id)}
                        onMouseEnter={() => setActivo(i)}
                        className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 ${activo === i ? "bg-marino-50" : ""} ${seleccion === z.id ? "font-semibold" : ""}`}
                      >
                        <span>
                          {z.ciudad} <span className="text-xs text-slate-500">{z.id}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-slate-600">{z.desfase}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {!opciones.length && <li role="option" aria-disabled="true" aria-selected={false} className="px-3 py-2 text-slate-600">Ninguna zona coincide con «{consulta}».</li>}
          </ul>
        )}
      </div>
      {nota && (
        <span id={idNota} className="text-xs text-slate-500">
          {nota}
        </span>
      )}
    </div>
  );
}
