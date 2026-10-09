"use client";

import { useActionState, useId } from "react";
import {
  accionCambiarEstado,
  accionCambiarRol,
  accionCrearCuenta,
  accionEnlaceRecuperacion,
  accionPaquetesPermisos,
  accionRestablecerContrasena,
} from "@/modulos/auth/acciones";
import { NOMBRES_PAQUETES, PAQUETES_PERMISOS, ROLES_ASIGNABLES, type EstadoFormulario, type PaquetePermisos } from "@/modulos/auth/esquemas";
import { Boton } from "@/ui/componentes/Boton";
import { Casilla } from "@/ui/expedientes/Selector";
import { BotonEnviar, Campo, CampoContrasena, ESTADO_INICIAL, MensajeFormulario } from "./Campos";

export interface FilaUsuario {
  id: string;
  nombre: string;
  usuario: string;
  estado: string;
  roles: string[];
  paquetes: PaquetePermisos[];
  mfaActivo: boolean;
  debeCambiar: boolean;
  esPropia: boolean;
}

export const NOMBRE_ROL: Record<string, string> = { admin: "Administración", consultor: "Asistente", cliente: "Cliente" };

const NOTA_ROL: Record<string, string> = {
  consultor: "Asistente: solo hace lo que marques abajo. Sus expedientes quedan separados de los del resto del equipo.",
  cliente: "Cliente: solo verá, en lectura, el expediente que vincules a su cuenta (lecturas y PDF).",
  admin: "Administración: control total de expedientes, usuarios y configuración.",
};

function SecretoUnaVez({ etiqueta, valor, explicacion, testId }: { etiqueta: string; valor?: string; explicacion: string; testId: string }) {
  const id = useId();
  if (!valor) return null;
  return (
    <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
      <label className="block font-medium" htmlFor={id}>
        {etiqueta}
      </label>
      <input id={id} readOnly value={valor} data-testid={testId} className="w-full rounded border border-amber-300 bg-white px-2 py-1 font-mono text-sm" />
      <p className="text-xs">Solo se muestra ahora. Entrégala en persona o por un canal privado; no la publiques.</p>
      <Boton variante="secundario" className="text-sm" descripcion={explicacion} onClick={() => void navigator.clipboard?.writeText(valor)}>
        Copiar
      </Boton>
    </div>
  );
}

function ResultadoSecreto({ estado }: { estado: EstadoFormulario }) {
  return (
    <>
      <SecretoUnaVez etiqueta="Contraseña inicial generada" valor={estado.contrasena} testId="contrasena-generada" explicacion="Copia la contraseña al portapapeles para entregarla a la persona." />
      <SecretoUnaVez etiqueta="Enlace de un solo uso" valor={estado.enlace} testId="enlace-generado" explicacion="Copia el enlace al portapapeles. Sirve una vez y caduca en 1 hora." />
    </>
  );
}

function CasillasPaquetes({ marcados = [] }: { marcados?: PaquetePermisos[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Qué puede hacer (solo asistentes)</legend>
      {NOMBRES_PAQUETES.map((p) => (
        <Casilla key={p} etiqueta={PAQUETES_PERMISOS[p].texto} name="paquetes" value={p} defaultChecked={marcados.includes(p)} />
      ))}
    </fieldset>
  );
}

export function FormularioCrearCuenta() {
  const [estado, accion] = useActionState(accionCrearCuenta, ESTADO_INICIAL);
  const idRol = useId();
  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <MensajeFormulario estado={estado} />
      </div>
      <Campo etiqueta="Nombre" name="nombre" required defaultValue={estado.valores?.nombre} error={estado.errores?.nombre} />
      <Campo
        etiqueta="Usuario"
        name="usuario"
        required
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={estado.valores?.usuario}
        nota="Con esto entrará. Letras sin acento, números, punto, guion o guion bajo."
        error={estado.errores?.usuario}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={idRol} className="text-sm font-medium text-slate-700">
          Tipo de cuenta
        </label>
        <select id={idRol} name="rol" defaultValue={estado.valores?.rol || "consultor"} className="rounded-lg border border-slate-300 px-3 py-2 text-base">
          {ROLES_ASIGNABLES.map((r) => (
            <option key={r} value={r}>
              {NOMBRE_ROL[r]}
            </option>
          ))}
        </select>
        <ul className="space-y-1 text-xs text-slate-500">
          {ROLES_ASIGNABLES.map((r) => (
            <li key={r}>{NOTA_ROL[r]}</li>
          ))}
        </ul>
      </div>
      <CampoContrasena
        etiqueta="Contraseña inicial (opcional)"
        name="contrasena"
        autoComplete="new-password"
        nota="Déjala vacía y se generará una segura. Al menos 10 caracteres, con letras y números."
        error={estado.errores?.contrasena}
      />
      <div className="sm:col-span-2 space-y-3">
        <Casilla etiqueta="Pedirle que elija su propia contraseña al entrar por primera vez (recomendado)" name="forzarCambio" defaultChecked />
        <CasillasPaquetes marcados={["expedientes_propios"]} />
      </div>
      <div className="sm:col-span-2">
        <BotonEnviar descripcion="Crea la cuenta con el usuario y la contraseña inicial. No se envía ningún correo: tú le entregas los datos.">
          Crear cuenta
        </BotonEnviar>
      </div>
      <div className="sm:col-span-2">
        <ResultadoSecreto estado={estado} />
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
            <BotonEnviar variante="secundario" className="text-sm" descripcion={`${ayuda} Cuenta: ${fila.usuario}.`}>
              {texto}
            </BotonEnviar>
          </form>
        ))}
      </div>
      <MensajeFormulario estado={estado} />
    </div>
  );
}

function ControlRestablecer({ fila }: { fila: FilaUsuario }) {
  const [estado, accion] = useActionState(accionRestablecerContrasena, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-2 rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="usuarioId" value={fila.id} />
      <CampoContrasena
        etiqueta="Contraseña nueva (opcional)"
        name="contrasena"
        autoComplete="new-password"
        nota="Vacía: se genera una."
        error={estado.errores?.contrasena}
      />
      <Casilla etiqueta="Pedir que la cambie al entrar" name="forzarCambio" defaultChecked />
      <BotonEnviar variante="secundario" className="text-sm" descripcion={`Pone una contraseña nueva a ${fila.usuario} y cierra el paso con la anterior. Queda en la auditoría.`}>
        Restablecer contraseña
      </BotonEnviar>
      <MensajeFormulario estado={estado} />
      <ResultadoSecreto estado={estado} />
    </form>
  );
}

function ControlPaquetes({ fila }: { fila: FilaUsuario }) {
  const [estado, accion] = useActionState(accionPaquetesPermisos, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-2 rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="usuarioId" value={fila.id} />
      <CasillasPaquetes marcados={fila.paquetes} />
      <BotonEnviar variante="secundario" className="text-sm" descripcion={`Guarda lo que ${fila.usuario} puede hacer. Lo no marcado queda prohibido.`}>
        Guardar permisos
      </BotonEnviar>
      <MensajeFormulario estado={estado} />
    </form>
  );
}

function ControlRecuperacion({ fila }: { fila: FilaUsuario }) {
  const [estado, accion] = useActionState(accionEnlaceRecuperacion, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-1">
      <input type="hidden" name="usuarioId" value={fila.id} />
      <BotonEnviar variante="sutil" className="px-0 text-sm" descripcion={`Alternativa: genera un enlace de un solo uso para que ${fila.usuario} elija una contraseña nueva por su cuenta. Queda en la auditoría.`}>
        Enlace de recuperación
      </BotonEnviar>
      <MensajeFormulario estado={estado} />
      <ResultadoSecreto estado={estado} />
    </form>
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
                descripcion={`${tiene ? "Retira" : "Asigna"} el tipo de cuenta «${NOMBRE_ROL[rol]}» a ${fila.usuario}.`}
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
        <li key={f.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_minmax(0,28rem)]" data-testid={`usuario-${f.usuario}`}>
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              {f.nombre} {f.esPropia && <span className="text-sm font-normal text-slate-500">(tu cuenta)</span>}
            </p>
            <p className="font-mono text-sm text-slate-600">{f.usuario}</p>
            <p className="text-sm">
              Estado: <strong data-testid="estado-cuenta">{f.estado}</strong> · Tipo: {f.roles.map((r) => NOMBRE_ROL[r] ?? r).join(", ") || "ninguno"}
            </p>
            <p className="text-xs text-slate-500">
              Dos pasos: {f.mfaActivo ? "activada" : "no activada"}
              {f.debeCambiar && " · Pendiente de elegir su contraseña"}
            </p>
            {f.roles.includes("consultor") && (
              <p className="text-xs text-slate-500">
                Puede: {f.paquetes.map((p) => PAQUETES_PERMISOS[p].texto.toLowerCase()).join("; ") || "nada todavía"}
              </p>
            )}
          </div>
          {f.esPropia ? (
            <p className="text-sm text-slate-500">No puedes cambiar tu propio estado ni tus roles. Tu contraseña se cambia en «Mi cuenta».</p>
          ) : (
            <div className="space-y-3">
              <ControlRoles fila={f} />
              <ControlEstado fila={f} />
              {f.roles.includes("consultor") && <ControlPaquetes fila={f} />}
              <ControlRestablecer fila={f} />
              <ControlRecuperacion fila={f} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
