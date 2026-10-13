"use client";

import { useActionState } from "react";
import { accionAsignarPermisoExpediente, accionRetirarPermiso } from "@/modulos/expedientes/acciones";
import type { Asignacion, Persona } from "@/modulos/expedientes/consultas";
import { NOMBRE_PERMISO, PERMISOS_EXPEDIENTE, type PermisoExpediente } from "@/modulos/expedientes/esquemas";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "@/ui/auth/Campos";
import { Casilla, Selector } from "./Selector";

export function PermisosExpediente({ id, asignaciones, personas }: { id: string; asignaciones: Asignacion[]; personas: Persona[] }) {
  const [estado, accion] = useActionState(accionAsignarPermisoExpediente, ESTADO_INICIAL);
  const [estadoRetirar, retirar] = useActionState(accionRetirarPermiso, ESTADO_INICIAL);
  return (
    <div className="space-y-4">
      {asignaciones.length ? (
        <ul className="space-y-2 text-sm">
          {asignaciones.map((a) => (
            <li key={a.usuarioId} className="flex flex-wrap items-center gap-2" data-testid="asignacion">
              <strong>{a.nombre}</strong>: {a.permisos.map((p) => NOMBRE_PERMISO[p as PermisoExpediente] ?? p).join(", ")}
              {a.vence ? ` · vence ${new Date(a.vence).toLocaleDateString("es-MX")}` : " · sin vencimiento"}
              <form action={retirar}>
                <input type="hidden" name="expedienteId" value={id} />
                <input type="hidden" name="usuarioId" value={a.usuarioId} />
                <BotonEnviar variante="sutil" className="text-sm" descripcion={`Retira a ${a.nombre} los permisos sobre este expediente.`}>
                  Retirar
                </BotonEnviar>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">Nadie más tiene permisos asignados en este expediente.</p>
      )}
      <MensajeFormulario estado={estadoRetirar} />
      <form action={accion} className="space-y-3" noValidate>
        <input type="hidden" name="expedienteId" value={id} />
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Selector etiqueta="Persona" name="usuarioId" opciones={personas.map((p) => [p.id, p.nombre] as const)} />
          <Campo etiqueta="Vence en (días)" name="dias" type="number" min={1} max={3650} nota="Vacío: sin vencimiento." />
        </div>
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="mb-1 text-sm font-medium text-slate-700">Permisos</legend>
          {PERMISOS_EXPEDIENTE.map((p) => (
            <Casilla key={p} etiqueta={NOMBRE_PERMISO[p]} name="permisos" value={p} defaultChecked={p === "listar" || p === "abrir_descargar"} />
          ))}
        </fieldset>
        <MensajeFormulario estado={estado} />
        <BotonEnviar variante="secundario" descripcion="Asigna (o reemplaza) los permisos de esa persona sobre este expediente. Queda en la auditoría.">
          Asignar permisos
        </BotonEnviar>
      </form>
    </div>
  );
}
