"use client";

import type { FormEvent, ReactNode } from "react";
import { Boton } from "@/ui/componentes/Boton";
import { Etiqueta, Seccion } from "@/ui/componentes/Seccion";
import { PERFIL_FICTICIO, PERFIL_VACIO, type Perfil, type PrecisionHora, type ReglasDemo } from "./tipos";

interface Props {
  perfil: Perfil;
  reglas: ReglasDemo;
  puedeUsarDatos: boolean;
  onCambiar: (p: Perfil) => void;
  onCambiarReglas: (r: ReglasDemo) => void;
  onAtras: () => void;
  onCalcular: () => void;
}

const claseCampo = "rounded-lg border border-slate-300 px-3 py-2 text-base disabled:bg-slate-100";

function Campo({ etiqueta, nota, children }: { etiqueta: string; nota?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {etiqueta}
      {children}
      {nota && <span className="text-xs font-normal text-slate-500">{nota}</span>}
    </label>
  );
}

export function FormularioPerfil({ perfil, reglas, puedeUsarDatos, onCambiar, onCambiarReglas, onAtras, onCalcular }: Props) {
  const set = <K extends keyof Perfil>(k: K, v: Perfil[K]) => onCambiar({ ...perfil, [k]: v, esDemo: false });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    onCalcular();
  };
  const sinDatos = !perfil.nombreNacimiento.trim() && !perfil.fecha;

  return (
    <Seccion
      titulo="Perfil de nacimiento"
      ayuda="perfil"
      etiqueta={perfil.esDemo ? <Etiqueta tono="ambar">Datos ficticios de demostración</Etiqueta> : undefined}
    >
      {!puedeUsarDatos && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          No diste permiso para usar tus datos en la sesión. Puedes probar con la persona ficticia o volver y activar
          el permiso.
        </p>
      )}
      <div className="mb-5 flex flex-wrap gap-3">
        <Boton
          variante="secundario"
          descripcion="Rellena el formulario con una persona inventada para probar la app."
          onClick={() => onCambiar(PERFIL_FICTICIO)}
        >
          Cargar persona ficticia
        </Boton>
        <Boton variante="sutil" descripcion="Vacía todos los campos del formulario." onClick={() => onCambiar(PERFIL_VACIO)}>
          Vaciar formulario
        </Boton>
      </div>

      <form onSubmit={enviar} className="space-y-6">
        <fieldset disabled={!puedeUsarDatos && !perfil.esDemo} className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-semibold text-slate-900">Datos</legend>
          <Campo etiqueta="Nombre completo de nacimiento" nota="Tal como aparece en el acta. Se usa en numerología.">
            <input className={claseCampo} value={perfil.nombreNacimiento} maxLength={120} autoComplete="off" onChange={(e) => set("nombreNacimiento", e.target.value)} />
          </Campo>
          <Campo etiqueta="Nombre actual o preferido (opcional)">
            <input className={claseCampo} value={perfil.nombrePreferido} maxLength={80} autoComplete="off" onChange={(e) => set("nombrePreferido", e.target.value)} />
          </Campo>
          <Campo etiqueta="Fecha de nacimiento">
            <input type="date" className={claseCampo} value={perfil.fecha} onChange={(e) => set("fecha", e.target.value)} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Hora local">
              <input
                type="time"
                className={claseCampo}
                value={perfil.hora}
                disabled={perfil.precisionHora === "desconocida"}
                onChange={(e) => set("hora", e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Precisión de la hora">
              <select
                className={claseCampo}
                value={perfil.precisionHora}
                onChange={(e) => {
                  const precisionHora = e.target.value as PrecisionHora;
                  onCambiar({ ...perfil, precisionHora, hora: precisionHora === "desconocida" ? "" : perfil.hora, esDemo: false });
                }}
              >
                <option value="exacta">Exacta</option>
                <option value="aproximada">Aproximada</option>
                <option value="desconocida">Desconocida</option>
              </select>
            </Campo>
          </div>
          <Campo etiqueta="Lugar de nacimiento" nota="Ciudad y país. En la carta natal se busca en el catálogo GeoNames para obtener coordenadas y zona horaria.">
            <input className={claseCampo} value={perfil.lugar} maxLength={120} onChange={(e) => set("lugar", e.target.value)} />
          </Campo>
          <Campo etiqueta="Zona horaria (si la conoces)" nota="Ej.: America/Mexico_City. Si la dejas vacía no se adivina.">
            <input className={claseCampo} value={perfil.zonaHoraria} maxLength={60} onChange={(e) => set("zonaHoraria", e.target.value)} />
          </Campo>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-semibold text-slate-900">Reglas de numerología</legend>
          <label className="flex items-center gap-3 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={reglas.numerosMaestros}
              onChange={(e) => onCambiarReglas({ ...reglas, numerosMaestros: e.target.checked })}
            />
            Conservar números maestros (11, 22, 33)
          </label>
          <Campo etiqueta="Letra Y">
            <select className={claseCampo} value={reglas.y} onChange={(e) => onCambiarReglas({ ...reglas, y: e.target.value as ReglasDemo["y"] })}>
              <option value="consonante">Siempre consonante</option>
              <option value="vocal">Siempre vocal</option>
            </select>
          </Campo>
          <Campo etiqueta="Letra Ñ">
            <select className={claseCampo} value={reglas.enye} onChange={(e) => onCambiarReglas({ ...reglas, enye: e.target.value as ReglasDemo["enye"] })}>
              <option value="como-n">Contar como N</option>
              <option value="rechazar">No admitir (avisar)</option>
            </select>
          </Campo>
          <Campo etiqueta="Camino de vida">
            <select
              className={claseCampo}
              value={reglas.metodoCaminoDeVida}
              onChange={(e) => onCambiarReglas({ ...reglas, metodoCaminoDeVida: e.target.value as ReglasDemo["metodoCaminoDeVida"] })}
            >
              <option value="por-componentes">Reducir día, mes y año por separado</option>
              <option value="suma-de-digitos">Sumar todos los dígitos</option>
            </select>
          </Campo>
          <Campo etiqueta="Nombre">
            <select
              className={claseCampo}
              value={reglas.metodoNombre}
              onChange={(e) => onCambiarReglas({ ...reglas, metodoNombre: e.target.value as ReglasDemo["metodoNombre"] })}
            >
              <option value="total">Sumar todas las letras</option>
              <option value="por-palabra">Reducir cada palabra y luego sumar</option>
            </select>
          </Campo>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <Boton variante="secundario" descripcion="Vuelve al aviso y a los permisos." onClick={onAtras}>
            Atrás
          </Boton>
          <Boton
            type="submit"
            disabled={sinDatos}
            descripcion={sinDatos ? "Escribe al menos el nombre o la fecha de nacimiento." : "Calcula la numerología con las reglas elegidas y muestra el panel de resultados."}
          >
            Calcular
          </Boton>
        </div>
      </form>
    </Seccion>
  );
}
