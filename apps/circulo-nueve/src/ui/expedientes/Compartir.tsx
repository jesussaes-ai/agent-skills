"use client";

import { useActionState, useState } from "react";
import { accionCrearEnlace, accionRevocarEnlace } from "@/modulos/compartir/acciones";
import type { EnlaceCompartido } from "@/modulos/compartir/consultas";
import { NOMBRE_ESTADO_ENLACE, estadoEnlace, opcionesVigencia } from "@/modulos/compartir/estado";
import type { Documento } from "@/modulos/expedientes/consultas";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "@/ui/auth/Campos";
import { Boton } from "@/ui/componentes/Boton";
import { Etiqueta } from "@/ui/componentes/Seccion";
import { Selector } from "./Selector";
import { EstadoVacio } from "@/ui/componentes/EstadoVacio";

const fecha = (iso: string) => new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

function EnlaceNuevo({ enlace }: { enlace: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="mt-3 rounded-lg border border-oro-300 bg-oro-50 p-3">
      <label htmlFor="enlace-nuevo" className="text-sm font-medium text-slate-800">
        Enlace para compartir (se muestra una sola vez)
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          id="enlace-nuevo"
          readOnly
          value={enlace}
          data-testid="enlace-nuevo"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Boton
          variante="secundario"
          className="text-sm"
          descripcion="Copia el enlace al portapapeles para enviarlo por el medio que prefieras."
          onClick={async () => {
            await navigator.clipboard?.writeText(enlace).catch(() => undefined);
            setCopiado(true);
          }}
        >
          {copiado ? "Copiado" : "Copiar enlace"}
        </Boton>
      </div>
      <p className="mt-2 text-xs text-slate-700" role="status">
        {copiado ? "Enlace copiado. " : ""}Quien lo tenga podrá descargar el PDF hasta que venza o lo revoques.
      </p>
    </div>
  );
}

function FormularioEnlace({ id, documentos, maxDias }: { id: string; documentos: Documento[]; maxDias: number }) {
  const [estado, accion] = useActionState(accionCrearEnlace, ESTADO_INICIAL);
  const vigencias = opcionesVigencia(maxDias);
  const porDefecto = vigencias.find((v) => v.horas === 72) ?? vigencias[vigencias.length - 1];
  return (
    <div>
      <form action={accion} className="grid gap-4 sm:grid-cols-2" noValidate>
        <input type="hidden" name="expedienteId" value={id} />
        <Selector
          etiqueta="Qué compartir"
          name="documentoId"
          defaultValue={documentos[0]?.id ?? ""}
          error={estado.errores?.documentoId}
          opciones={[...documentos.map((d) => [d.id, `PDF: ${d.nombre}`] as const), ["", "Todos los PDF del expediente"] as const]}
        />
        <Selector
          etiqueta="Vence en"
          name="vigenciaHoras"
          defaultValue={String(porDefecto?.horas ?? 24)}
          error={estado.errores?.vigenciaHoras}
          opciones={vigencias.map((v) => [String(v.horas), v.texto] as const)}
        />
        <Campo
          etiqueta="Máximo de descargas (opcional)"
          name="maxAccesos"
          type="number"
          min={1}
          max={1000}
          inputMode="numeric"
          error={estado.errores?.maxAccesos}
          nota="Vacío = sin límite mientras esté vigente."
        />
        <Campo
          etiqueta="Nota para quien lo recibe (opcional)"
          name="nota"
          maxLength={120}
          error={estado.errores?.nota}
          nota="No escribas datos personales: la nota se muestra en la página del enlace."
        />
        <div className="space-y-3 sm:col-span-2">
          <MensajeFormulario estado={estado} />
          <BotonEnviar descripcion="Crea un enlace que vence en el plazo elegido. Puedes revocarlo cuando quieras; cada descarga queda registrada.">
            Crear enlace
          </BotonEnviar>
        </div>
      </form>
      {estado.ok && estado.enlace && <EnlaceNuevo key={estado.enlace} enlace={estado.enlace} />}
    </div>
  );
}

function RevocarEnlace({ id, enlaceId }: { id: string; enlaceId: string }) {
  const [estado, accion] = useActionState(accionRevocarEnlace, ESTADO_INICIAL);
  return (
    <form action={accion}>
      <input type="hidden" name="expedienteId" value={id} />
      <input type="hidden" name="enlaceId" value={enlaceId} />
      <BotonEnviar variante="sutil" className="text-sm text-red-800" descripcion="Desactiva el enlace de inmediato. No se puede deshacer: si hace falta, crea uno nuevo.">
        Revocar
      </BotonEnviar>
      <MensajeFormulario estado={estado} />
    </form>
  );
}

interface Props {
  id: string;
  documentos: Documento[];
  enlaces: EnlaceCompartido[];
  maxDias: number;
}

export function EnlacesCompartidos({ id, documentos, enlaces, maxDias }: Props) {
  const nombreDocumento = new Map(documentos.map((d) => [d.id, d.nombre]));
  return (
    <div className="space-y-6">
      {documentos.length ? (
        <FormularioEnlace id={id} documentos={documentos} maxDias={maxDias} />
      ) : (
        <EstadoVacio titulo="Nada que compartir todavía">Genera primero un PDF desde una lectura guardada; después podrás compartirlo con un enlace que vence.</EstadoVacio>
      )}
      <div>
        <h3 className="mb-2 font-semibold text-slate-900">Enlaces creados</h3>
        {enlaces.length ? (
          <ul className="divide-y divide-slate-200" data-testid="enlaces">
            {enlaces.map((e) => {
              const situacion = estadoEnlace(e);
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid="enlace">
                  <div className="text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      {e.alcance === "documento" ? (nombreDocumento.get(e.documentoId ?? "") ?? "PDF") : "Todos los PDF del expediente"}
                      <Etiqueta tono={situacion === "vigente" ? "violeta" : "gris"}>{NOMBRE_ESTADO_ENLACE[situacion]}</Etiqueta>
                    </p>
                    <p className="text-slate-700">
                      {situacion === "revocado" && e.revocadoEl ? `Revocado el ${fecha(e.revocadoEl)}` : `Vence el ${fecha(e.venceEl)}`} · descargas: {e.accesos}
                      {e.maxAccesos !== null ? ` de ${e.maxAccesos}` : ""}
                      {e.ultimoAcceso ? ` · última: ${fecha(e.ultimoAcceso)}` : ""}
                    </p>
                    {e.nota && <p className="text-slate-600">Nota: {e.nota}</p>}
                  </div>
                  {situacion !== "revocado" && <RevocarEnlace id={id} enlaceId={e.id} />}
                </li>
              );
            })}
          </ul>
        ) : (
          <EstadoVacio titulo="Todavía no hay enlaces">Los que crees aparecerán aquí con su vigencia, sus descargas y la opción de revocarlos.</EstadoVacio>
        )}
      </div>
    </div>
  );
}
