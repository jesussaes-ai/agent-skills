"use client";

import { useActionState, useState, useTransition } from "react";
import { accionConfirmarInscripcionMfa, accionIniciarInscripcionMfa, type InscripcionMfa as Datos } from "@/modulos/auth/acciones";
import { Boton } from "@/ui/componentes/Boton";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "./Campos";

export function InscripcionMfa({ siguiente }: { siguiente: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, iniciar] = useTransition();
  const [estado, accion] = useActionState(accionConfirmarInscripcionMfa, ESTADO_INICIAL);

  if (!datos?.factorId) {
    return (
      <div className="space-y-3">
        {datos?.mensaje && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{datos.mensaje}</p>}
        <Boton
          disabled={cargando}
          descripcion="Genera un código QR y una clave secreta para registrar Círculo Nueve en tu aplicación de autenticación."
          onClick={() => iniciar(async () => setDatos(await accionIniciarInscripcionMfa()))}
        >
          {cargando ? "Preparando…" : "Configurar verificación en dos pasos"}
        </Boton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>Abre tu aplicación de autenticación y escanea el código QR, o escribe la clave secreta.</li>
        <li>Escribe el código de 6 dígitos que muestra la aplicación.</li>
      </ol>
      <img
        src={datos.qr}
        alt="Código QR para registrar Círculo Nueve en tu aplicación de autenticación"
        width={180}
        height={180}
        className="rounded-lg border border-slate-200 bg-white p-2"
      />
      <p className="text-sm text-slate-700">
        Clave secreta: <code data-testid="secreto-totp" className="break-all rounded bg-slate-100 px-1">{datos.secreto}</code>
      </p>
      <form action={accion} className="space-y-4" noValidate>
        <MensajeFormulario estado={estado} />
        <input type="hidden" name="factorId" value={datos.factorId} />
        <input type="hidden" name="next" value={siguiente} />
        <Campo etiqueta="Código de 6 dígitos" name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required error={estado.errores?.codigo} />
        <BotonEnviar descripcion="Comprueba el código y activa la verificación en dos pasos en tu cuenta.">Activar</BotonEnviar>
      </form>
    </div>
  );
}
