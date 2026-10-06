"use client";

import { useActionState } from "react";
import { accionCambiarEstado, accionCambiarRol, accionInvitar } from "@/modulos/auth/acciones";
import { ROLES_ASIGNABLES } from "@/modulos/auth/esquemas";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "./Campos";

export interface FilaUsuario {
  id: string;
  nombre: string;
  correo: string;
  estado: string;
  roles: string[];
  esPropia: boolean;
}

const NOMBRE_ROL: Record<string, string> = { admin: "Administración", consultor: "Consultor/a", cliente: "Cliente" };

export function FormularioInvitar() {
  const [estado, accion] = useActionState(accionInvitar, ESTADO_INICIAL);
  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <MensajeFormulario estado={estado} />
      </div>
      <Campo etiqueta="Nombre" name="nombre" required error={estado.errores?.nombre} />
      <Campo etiqueta="Correo" name="correo" type="email" required error={estado.errores?.correo} />
      <div className="flex flex-col gap-1">
        <label htmlFor="rol-invitacion" className="text-sm font-medium text-slate-700">
          Rol inicial
        </label>
        <select id="rol-invitacion" name="rol" defaultValue="consultor" className="rounded-lg border border-slate-300 px-3 py-2 text-base">
          {ROLES_ASIGNABLES.map((r) => (
            <option key={r} value={r}>
              {NOMBRE_ROL[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <BotonEnviar descripcion="Crea la cuenta con el rol elegido y envía un correo de invitación de un solo uso para que la persona elija su contraseña.">
          Enviar invitación
        </BotonEnviar>
      </div>
    </form>
  );
}

function ControlEstado({ fila }: { fila: FilaUsuario }) {
  const [estado, accion] = useActionState(accionCambiarEstado, ESTADO_INICIAL);
  const opciones =
    fila.estado === "activo"
      ? ([
          ["suspendido", "Suspender", "Bloquea el acceso temporalmente; los datos se conservan."],
          ["revocado", "Revocar", "Retira el acceso de forma indefinida; los datos se conservan."],
        ] as const)
      : ([["activo", "Reactivar", "Devuelve el acceso a la cuenta."]] as const);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {opciones.map(([valor, texto, ayuda]) => (
          <form key={valor} action={accion}>
            <input type="hidden" name="usuarioId" value={fila.id} />
            <input type="hidden" name="estado" value={valor} />
            <BotonEnviar variante="secundario" className="text-sm" descripcion={`${ayuda} Cuenta: ${fila.nombre}.`}>
              {texto}
            </BotonEnviar>
          </form>
        ))}
      </div>
      <MensajeFormulario estado={estado} />
    </div>
  );
}

function ControlRoles({ fila }: { fila: FilaUsuario }) {
  const [estado, accion] = useActionState(accionCambiarRol, ESTADO_INICIAL);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {ROLES_ASIGNABLES.map((rol) => {
          const tiene = fila.roles.includes(rol);
          return (
            <form key={rol} action={accion}>
              <input type="hidden" name="usuarioId" value={fila.id} />
              <input type="hidden" name="rol" value={rol} />
              <input type="hidden" name="operacion" value={tiene ? "retirar" : "asignar"} />
              <BotonEnviar
                variante={tiene ? "primario" : "secundario"}
                className="text-sm"
                aria-pressed={tiene}
                descripcion={`${tiene ? "Retira" : "Asigna"} el rol «${NOMBRE_ROL[rol]}» a ${fila.nombre}.`}
              >
                {NOMBRE_ROL[rol]}
              </BotonEnviar>
            </form>
          );
        })}
      </div>
      <MensajeFormulario estado={estado} />
    </div>
  );
}

export function TablaUsuarios({ filas }: { filas: FilaUsuario[] }) {
  if (!filas.length) return <p className="text-slate-600">Todavía no hay cuentas.</p>;
  return (
    <ul className="divide-y divide-slate-200">
      {filas.map((f) => (
        <li key={f.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto]" data-testid={`usuario-${f.correo}`}>
          <div>
            <p className="font-semibold text-slate-900">
              {f.nombre} {f.esPropia && <span className="text-sm font-normal text-slate-500">(tu cuenta)</span>}
            </p>
            <p className="text-sm text-slate-600">{f.correo}</p>
            <p className="text-sm">
              Estado: <strong data-testid="estado-cuenta">{f.estado}</strong> · Roles: {f.roles.map((r) => NOMBRE_ROL[r] ?? r).join(", ") || "ninguno"}
            </p>
          </div>
          {f.esPropia ? (
            <p className="text-sm text-slate-500">No puedes cambiar tu propio estado ni tus roles.</p>
          ) : (
            <div className="space-y-2">
              <ControlRoles fila={f} />
              <ControlEstado fila={f} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
