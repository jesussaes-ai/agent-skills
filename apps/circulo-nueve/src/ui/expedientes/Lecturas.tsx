"use client";

import { useActionState, useState } from "react";
import { calcularNumerologia, crearConfig, type Indicador, type ResultadoNumerologia } from "@/modulos/calculo/numerologia";
import { accionBorrarLectura, accionGenerarPdf, accionGuardarLectura } from "@/modulos/expedientes/acciones";
import type { Lectura } from "@/modulos/expedientes/consultas";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "@/ui/auth/Campos";
import { Boton } from "@/ui/componentes/Boton";
import { Etiqueta } from "@/ui/componentes/Seccion";
import type { ResultadoCarta } from "@/modulos/calculo/astrologia";
import { CartaGuardada } from "@/ui/carta-natal/CartaExpediente";
import { Casilla, Selector } from "./Selector";

function Indicadores({ resultado }: { resultado: ResultadoNumerologia }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {resultado.indicadores.map((i: Indicador) => (
        <li key={i.clave} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-slate-900">{i.nombre}</span>
            <span className="text-2xl font-bold text-marino-800" data-testid={`valor-${i.clave}`}>
              {i.valor}
            </span>
          </div>
          {i.esMaestro && <Etiqueta>Número maestro</Etiqueta>}
          <Boton
            variante="sutil"
            className="px-0 text-sm"
            aria-expanded={abierto === i.clave}
            descripcion={`${abierto === i.clave ? "Oculta" : "Muestra"} las operaciones de ${i.nombre.toLowerCase()}.`}
            onClick={() => setAbierto(abierto === i.clave ? null : i.clave)}
          >
            {abierto === i.clave ? "Ocultar pasos" : "Ver pasos"}
          </Boton>
          {abierto === i.clave && (
            <ol className="list-decimal pl-5 text-xs text-slate-700">
              {i.pasos.map((p, n) => (
                <li key={n}>
                  {p.descripcion}: <code>{p.operacion}</code>
                </li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ul>
  );
}

interface PropsNueva {
  id: string;
  nombre: string;
  fecha: string;
  puedeGuardar: boolean;
  consentido: boolean;
}

/** Calcular es local y efímero; guardar recalcula en el servidor y lo añade al historial. */
export function NuevaLectura({ id, nombre, fecha, puedeGuardar, consentido }: PropsNueva) {
  const [estado, accion] = useActionState(accionGuardarLectura, ESTADO_INICIAL);
  const [efimera, setEfimera] = useState<ReturnType<typeof calcularNumerologia> | null>(null);

  const calcularSinGuardar = (form: HTMLFormElement) => {
    const f = new FormData(form);
    const config = crearConfig({
      numerosMaestros: f.get("numerosMaestros") === "on",
      y: f.get("y") as "consonante" | "vocal",
      enye: f.get("enye") as "como-n" | "rechazar",
      metodoCaminoDeVida: f.get("metodoCaminoDeVida") as "por-componentes" | "suma-de-digitos",
      metodoNombre: f.get("metodoNombre") as "total" | "por-palabra",
    });
    setEfimera(calcularNumerologia({ nombre: String(f.get("nombre") ?? ""), fecha: String(f.get("fecha") ?? "") }, config));
  };

  return (
    <div className="space-y-4">
      <form action={accion} className="space-y-4" noValidate>
        <input type="hidden" name="expedienteId" value={id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre para el cálculo" name="nombre" defaultValue={nombre} maxLength={120} nota="Por defecto, el nombre de nacimiento del perfil." />
          <Campo etiqueta="Fecha para el cálculo" name="fecha" type="date" defaultValue={fecha} />
          <Selector etiqueta="Letra Y" name="y" opciones={[["consonante", "Siempre consonante"], ["vocal", "Siempre vocal"]]} />
          <Selector etiqueta="Letra Ñ" name="enye" opciones={[["como-n", "Contar como N"], ["rechazar", "No admitir (avisar)"]]} />
          <Selector
            etiqueta="Camino de vida"
            name="metodoCaminoDeVida"
            opciones={[["por-componentes", "Reducir día, mes y año por separado"], ["suma-de-digitos", "Sumar todos los dígitos"]]}
          />
          <Selector etiqueta="Nombre" name="metodoNombre" opciones={[["total", "Sumar todas las letras"], ["por-palabra", "Reducir cada palabra y luego sumar"]]} />
        </div>
        <Casilla etiqueta="Conservar números maestros (11, 22, 33)" name="numerosMaestros" defaultChecked />
        {!consentido && puedeGuardar && (
          <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            Para guardar lecturas, activa «Guardar las lecturas y reportes en el historial» en Consentimientos. Mientras tanto
            puedes calcular sin guardar.
          </p>
        )}
        <MensajeFormulario estado={estado} />
        <div className="flex flex-wrap gap-3">
          <Boton
            variante="secundario"
            descripcion="Modo efímero: calcula en este navegador y muestra el resultado sin guardarlo en ninguna parte."
            onClick={(e) => calcularSinGuardar(e.currentTarget.form as HTMLFormElement)}
          >
            Calcular sin guardar
          </Boton>
          {puedeGuardar && (
            <BotonEnviar disabled={!consentido} descripcion="Recalcula en el servidor y guarda la lectura en el historial del expediente con su motor, versión y reglas.">
              Guardar lectura
            </BotonEnviar>
          )}
        </div>
      </form>
      {efimera && (
        <div aria-live="polite" className="rounded-xl border border-dashed border-marino-300 p-4" data-testid="lectura-efimera">
          <p className="mb-2 text-sm font-semibold text-slate-900">
            Resultado efímero <Etiqueta tono="gris">No guardado</Etiqueta>
          </p>
          {efimera.ok ? <Indicadores resultado={efimera} /> : <p role="alert" className="text-sm text-red-800">{efimera.errores.join(" ")}</p>}
        </div>
      )}
    </div>
  );
}

function AccionesLectura({ id, lecturaId, puedeBorrar, puedeDescargar }: { id: string; lecturaId: string; puedeBorrar: boolean; puedeDescargar: boolean }) {
  const [estadoPdf, generar] = useActionState(accionGenerarPdf, ESTADO_INICIAL);
  const [estadoBorrar, borrar] = useActionState(accionBorrarLectura, ESTADO_INICIAL);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {puedeDescargar && (
          <form action={generar}>
            <input type="hidden" name="expedienteId" value={id} />
            <input type="hidden" name="lecturaId" value={lecturaId} />
            <BotonEnviar variante="secundario" className="text-sm" descripcion="Genera el reporte PDF de esta lectura en el servidor y lo guarda de forma privada en «Documentos».">
              Generar PDF
            </BotonEnviar>
          </form>
        )}
        {puedeBorrar && (
          <form action={borrar}>
            <input type="hidden" name="expedienteId" value={id} />
            <input type="hidden" name="lecturaId" value={lecturaId} />
            <BotonEnviar variante="sutil" className="text-sm text-red-800" descripcion="Borra esta lectura del historial. Los PDF ya generados se conservan en «Documentos».">
              Borrar lectura
            </BotonEnviar>
          </form>
        )}
      </div>
      <MensajeFormulario estado={estadoPdf} />
      <MensajeFormulario estado={estadoBorrar} />
    </div>
  );
}

export function HistorialLecturas({ id, lecturas, puedeBorrar, puedeDescargar }: { id: string; lecturas: Lectura[]; puedeBorrar: boolean; puedeDescargar: boolean }) {
  if (!lecturas.length) return <p className="text-slate-600">Todavía no hay lecturas guardadas.</p>;
  return (
    <ol className="space-y-4">
      {lecturas.map((l) => (
        <li key={l.id} className="rounded-xl border border-slate-200 p-4" data-testid="lectura-guardada">
          <p className="mb-2 text-sm text-slate-600">
            {new Date(l.creada).toLocaleString("es-MX")} · {l.sistema === "carta_natal" ? "Carta natal" : "Numerología"} · motor {l.motor} v
            {l.motorVersion} · reglas {l.reglasVersion}
          </p>
          {l.sistema === "carta_natal" ? (
            <CartaGuardada r={l.resultado as ResultadoCarta} />
          ) : (
            <Indicadores resultado={l.resultado as ResultadoNumerologia} />
          )}
          <div className="mt-3">
            <AccionesLectura id={id} lecturaId={l.id} puedeBorrar={puedeBorrar} puedeDescargar={puedeDescargar} />
          </div>
        </li>
      ))}
    </ol>
  );
}
