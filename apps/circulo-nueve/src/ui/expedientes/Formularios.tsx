"use client";

import { SelectorZonaHoraria } from "@/ui/componentes/SelectorZonaHoraria";
import { useActionState } from "react";
import {
  accionBorrarExpediente,
  accionCrearExpediente,
  accionEditarExpediente,
  accionGuardarConsentimientos,
  accionGuardarPerfil,
  accionVincularCliente,
} from "@/modulos/expedientes/acciones";
import type { Consentimiento, DetalleExpediente, Persona } from "@/modulos/expedientes/consultas";
import { CONSENTIMIENTOS, CONSENTIMIENTOS_NO_DISPONIBLES } from "@/modulos/expedientes/esquemas";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "@/ui/auth/Campos";
import { Casilla, Selector } from "./Selector";

export function FormularioNuevoExpediente() {
  const [estado, accion] = useActionState(accionCrearExpediente, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      <MensajeFormulario estado={estado} />
      <Campo
        etiqueta="Nombre del expediente"
        name="etiqueta"
        required
        maxLength={120}
        error={estado.errores?.etiqueta}
        nota="Un nombre para reconocerlo, p. ej. el nombre preferido de la persona. Los datos de nacimiento van aparte, en el perfil."
      />
      <Casilla etiqueta="Contiene datos ficticios de demostración (se marcará en los PDF)" name="esDemo" />
      <BotonEnviar descripcion="Crea un expediente vacío, separado de los demás, del que serás responsable.">Crear expediente</BotonEnviar>
    </form>
  );
}

export function FormularioEditarExpediente({ id, etiqueta }: { id: string; etiqueta: string }) {
  const [estado, accion] = useActionState(accionEditarExpediente, ESTADO_INICIAL);
  return (
    <form action={accion} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
      <input type="hidden" name="expedienteId" value={id} />
      <div className="flex-1">
        <Campo etiqueta="Nombre del expediente" name="etiqueta" defaultValue={etiqueta} maxLength={120} error={estado.errores?.etiqueta} />
      </div>
      <BotonEnviar variante="secundario" descripcion="Guarda el nuevo nombre del expediente.">Renombrar</BotonEnviar>
      <div className="sm:basis-full">
        <MensajeFormulario estado={estado} />
      </div>
    </form>
  );
}

export function FormularioVincularCliente({ id, clienteId, personas }: { id: string; clienteId: string | null; personas: Persona[] }) {
  const [estado, accion] = useActionState(accionVincularCliente, ESTADO_INICIAL);
  const clientes = personas.filter((p) => p.roles.includes("cliente"));
  return (
    <form action={accion} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
      <input type="hidden" name="expedienteId" value={id} />
      <div className="flex-1">
        <Selector
          etiqueta="Cuenta cliente vinculada (podrá ver y descargar este expediente)"
          name="clienteId"
          defaultValue={clienteId ?? ""}
          opciones={[["", "Ninguna"], ...clientes.map((c) => [c.id, c.nombre] as const)]}
        />
      </div>
      <BotonEnviar variante="secundario" descripcion="Vincula o desvincula la cuenta de la persona cliente. Requiere permiso de compartir.">
        Guardar vínculo
      </BotonEnviar>
      <div className="sm:basis-full">
        <MensajeFormulario estado={estado} />
      </div>
    </form>
  );
}

export function FormularioConsentimientos({ id, vigentes, editable }: { id: string; vigentes: Record<string, Consentimiento | undefined>; editable: boolean }) {
  const [estado, accion] = useActionState(accionGuardarConsentimientos, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-3" noValidate>
      <input type="hidden" name="expedienteId" value={id} />
      {CONSENTIMIENTOS.map((c) => {
        const v = vigentes[c.tipo];
        return (
          <div key={c.tipo}>
            <Casilla etiqueta={c.texto} name={c.tipo} defaultChecked={v?.otorgado ?? false} disabled={!editable} />
            <p className="ml-8 text-xs text-slate-600">
              {v ? `${v.otorgado ? "Otorgado" : "Retirado"} el ${new Date(v.fecha).toLocaleString("es-MX")}` : "Nunca otorgado"}
            </p>
          </div>
        );
      })}
      {CONSENTIMIENTOS_NO_DISPONIBLES.map((c) => (
        <Casilla key={c.tipo} etiqueta={`${c.texto} — ${c.motivo}`} name={`no-${c.tipo}`} disabled />
      ))}
      <MensajeFormulario estado={estado} />
      {editable && (
        <BotonEnviar descripcion="Guarda los consentimientos. Cada cambio se registra con su fecha y se puede retirar después.">
          Guardar consentimientos
        </BotonEnviar>
      )}
    </form>
  );
}

export function FormularioPerfil({ id, perfil, editable, consentido }: { id: string; perfil: DetalleExpediente["perfil"]; editable: boolean; consentido: boolean }) {
  const [estado, accion] = useActionState(accionGuardarPerfil, ESTADO_INICIAL);
  const p = perfil;
  const bloqueado = !editable || !consentido;
  return (
    <form action={accion} className="space-y-4" noValidate>
      <input type="hidden" name="expedienteId" value={id} />
      {!consentido && editable && (
        <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Para guardar el perfil, primero activa «Guardar el perfil de nacimiento» en Consentimientos.
        </p>
      )}
      <fieldset disabled={bloqueado} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Datos de nacimiento</legend>
        <Campo etiqueta="Nombre completo de nacimiento" name="nombreNacimiento" defaultValue={p?.nombreNacimiento} maxLength={120} error={estado.errores?.nombreNacimiento} />
        <Campo etiqueta="Nombre preferido (opcional)" name="nombrePreferido" defaultValue={p?.nombrePreferido} maxLength={80} nota="Es el que se muestra en la portada del PDF." />
        <Campo etiqueta="Fecha de nacimiento" name="fecha" type="date" defaultValue={p?.fecha} error={estado.errores?.fecha} />
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Hora local" name="hora" type="time" defaultValue={p?.hora} error={estado.errores?.hora} />
          <Selector
            etiqueta="Precisión de la hora"
            name="precisionHora"
            defaultValue={p?.precisionHora ?? "desconocida"}
            opciones={[["exacta", "Exacta"], ["aproximada", "Aproximada"], ["desconocida", "Desconocida"]]}
          />
        </div>
        <Campo etiqueta="Lugar de nacimiento" name="lugar" defaultValue={p?.lugar} maxLength={120} />
        <SelectorZonaHoraria
          etiqueta="Zona horaria"
          name="zonaHoraria"
          valor={p?.zonaHoraria ?? ""}
          textoAutomatica={"Automática: la del lugar de nacimiento"}
          nota="Escribe para buscar entre todas las zonas. «Automática» usa la del lugar elegido al calcular la carta natal; nunca se adivina."
        />
      </fieldset>
      <MensajeFormulario estado={estado} />
      {!bloqueado && <BotonEnviar descripcion="Guarda el perfil de nacimiento de este expediente.">Guardar perfil</BotonEnviar>}
    </form>
  );
}

export function FormularioBorrarExpediente({ id }: { id: string }) {
  const [estado, accion] = useActionState(accionBorrarExpediente, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-3" noValidate>
      <input type="hidden" name="expedienteId" value={id} />
      <Campo
        etiqueta="Escribe BORRAR para confirmar"
        name="confirmacion"
        autoComplete="off"
        error={estado.errores?.confirmacion}
        nota="Se borran el perfil, los consentimientos, las lecturas, los documentos y sus archivos. No se puede deshacer."
      />
      <MensajeFormulario estado={estado} />
      <BotonEnviar variante="secundario" className="border-red-300 text-red-800 hover:bg-red-50" descripcion="Borra definitivamente el expediente y todos sus archivos. Queda registrado en la auditoría.">
        Borrar expediente
      </BotonEnviar>
    </form>
  );
}
