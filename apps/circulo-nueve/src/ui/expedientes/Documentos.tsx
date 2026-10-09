"use client";

import { useActionState } from "react";
import { accionAsignarPermisoArchivo, accionBorrarDocumento, accionRetirarPermiso } from "@/modulos/expedientes/acciones";
import type { Asignacion, Documento, Persona } from "@/modulos/expedientes/consultas";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "@/ui/auth/Campos";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Selector } from "./Selector";
import { EstadoVacio } from "@/ui/componentes/EstadoVacio";

function BorrarDocumento({ id, documentoId }: { id: string; documentoId: string }) {
  const [estado, accion] = useActionState(accionBorrarDocumento, ESTADO_INICIAL);
  return (
    <form action={accion}>
      <input type="hidden" name="expedienteId" value={id} />
      <input type="hidden" name="documentoId" value={documentoId} />
      <BotonEnviar variante="sutil" className="text-sm text-red-800" descripcion="Borra el documento del expediente y su archivo del almacenamiento privado.">
        Borrar
      </BotonEnviar>
      <MensajeFormulario estado={estado} />
    </form>
  );
}

function PermisoArchivo({ id, documento, personas, asignaciones }: { id: string; documento: Documento; personas: Persona[]; asignaciones: Asignacion[] }) {
  const [estado, accion] = useActionState(accionAsignarPermisoArchivo, ESTADO_INICIAL);
  const [estadoRetirar, retirar] = useActionState(accionRetirarPermiso, ESTADO_INICIAL);
  const propias = asignaciones.filter((a) => a.documentoId === documento.id);
  return (
    <div className="mt-2 rounded-lg bg-slate-50 p-3">
      <p className="mb-2 text-sm font-medium text-slate-800">Acceso solo a este archivo</p>
      {propias.length > 0 && (
        <ul className="mb-2 space-y-1 text-sm">
          {propias.map((a) => (
            <li key={a.usuarioId} className="flex flex-wrap items-center gap-2">
              {a.nombre} {a.vence ? `(vence ${new Date(a.vence).toLocaleDateString("es-MX")})` : "(sin vencimiento)"}
              <form action={retirar}>
                <input type="hidden" name="expedienteId" value={id} />
                <input type="hidden" name="documentoId" value={documento.id} />
                <input type="hidden" name="usuarioId" value={a.usuarioId} />
                <BotonEnviar variante="sutil" className="text-sm" descripcion={`Retira a ${a.nombre} el acceso a este archivo.`}>
                  Retirar
                </BotonEnviar>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={accion} className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end" noValidate>
        <input type="hidden" name="expedienteId" value={id} />
        <input type="hidden" name="documentoId" value={documento.id} />
        <Selector etiqueta="Persona" name="usuarioId" opciones={personas.map((p) => [p.id, p.nombre] as const)} />
        <Campo etiqueta="Vence en (días)" name="dias" type="number" min={1} max={3650} defaultValue="7" />
        <BotonEnviar variante="secundario" className="text-sm" descripcion="Permite a esa persona abrir y descargar solo este archivo, sin ver el resto del expediente.">
          Dar acceso
        </BotonEnviar>
      </form>
      <MensajeFormulario estado={estado} />
      <MensajeFormulario estado={estadoRetirar} />
    </div>
  );
}

interface Props {
  id: string;
  documentos: Documento[];
  puedeBorrar: boolean;
  administracion: { personas: Persona[]; asignacionesArchivo: Asignacion[] } | null;
  usuarioId: string;
}

export function ListaDocumentos({ id, documentos, puedeBorrar, administracion, usuarioId }: Props) {
  if (!documentos.length) {
    return (
      <EstadoVacio titulo="Todavía no hay documentos">
        Genera un PDF desde una lectura guardada en el «Historial de lecturas»; aparecerá aquí, guardado en privado.
      </EstadoVacio>
    );
  }
  return (
    <ul className="divide-y divide-slate-200">
      {documentos.map((d) => (
        <li key={d.id} className="py-3" data-testid="documento">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">{d.nombre}</p>
              <p className="text-xs text-slate-600">
                {new Date(d.creado).toLocaleString("es-MX")}
                {d.tamanoBytes ? ` · ${Math.round(d.tamanoBytes / 1024)} KB` : ""}
                {d.retenerHasta ? ` · se conserva hasta ${d.retenerHasta}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EnlaceBoton
                href={`/expedientes/${id}/documentos/${d.id}`}
                prefetch={false}
                descripcion="Comprueba tu permiso en el servidor, registra la descarga en la auditoría y abre un enlace temporal que caduca en segundos."
              >
                Descargar
              </EnlaceBoton>
              {puedeBorrar && <BorrarDocumento id={id} documentoId={d.id} />}
            </div>
          </div>
          {administracion && (
            <PermisoArchivo
              id={id}
              documento={d}
              personas={administracion.personas.filter((p) => p.id !== usuarioId)}
              asignaciones={administracion.asignacionesArchivo}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
