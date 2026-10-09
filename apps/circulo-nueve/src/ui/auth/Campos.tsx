"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import type { EstadoFormulario } from "@/modulos/auth/esquemas";
import { Boton, type PropsBoton } from "@/ui/componentes/Boton";

interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  name: string;
  error?: string;
  nota?: string;
}

export function Campo({ etiqueta, error, nota, className = "", ...props }: PropsCampo) {
  const id = useId();
  const idNota = `${id}-nota`;
  const idError = `${id}-error`;
  const describe = [nota ? idNota : null, error ? idError : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe}
        className={`rounded-lg border px-3 py-2 text-base ${error ? "border-red-600" : "border-slate-300"} ${className}`}
      />
      {nota && (
        <span id={idNota} className="text-xs text-slate-600">
          {nota}
        </span>
      )}
      {error && (
        <span id={idError} className="text-sm text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

function Ojo({ tachado }: { tachado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {tachado && <path d="M4 4l16 16" />}
    </svg>
  );
}

/** Campo de contraseña con botón «ojito» para mostrarla u ocultarla. */
export function CampoContrasena({ etiqueta, error, nota, className = "", ...props }: Omit<PropsCampo, "type">) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const idNota = `${id}-nota`;
  const idError = `${id}-error`;
  const describe = [nota ? idNota : null, error ? idError : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          {...props}
          type={visible ? "text" : "password"}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={error ? true : undefined}
          aria-describedby={describe}
          className={`w-full rounded-lg border py-2 pl-3 pr-12 text-base ${error ? "border-red-600" : "border-slate-300"} ${className}`}
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
          <Boton
            variante="sutil"
            className="rounded-md px-2 py-1.5 no-underline"
            aria-pressed={visible}
            aria-label={visible ? `Ocultar ${etiqueta.toLowerCase()}` : `Mostrar ${etiqueta.toLowerCase()}`}
            descripcion={visible ? "Oculta lo escrito con puntos." : "Muestra lo escrito para comprobarlo. Hazlo solo si nadie está mirando tu pantalla."}
            onClick={() => setVisible((v) => !v)}
          >
            <Ojo tachado={visible} />
          </Boton>
        </div>
      </div>
      {nota && (
        <span id={idNota} className="text-xs text-slate-600">
          {nota}
        </span>
      )}
      {error && (
        <span id={idError} className="text-sm text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

export function BotonEnviar({ children, ...props }: Omit<PropsBoton, "type">) {
  const { pending } = useFormStatus();
  return (
    <Boton type="submit" disabled={pending || props.disabled} aria-busy={pending || undefined} {...props}>
      {pending ? "Procesando…" : children}
    </Boton>
  );
}

export function MensajeFormulario({ estado }: { estado: EstadoFormulario }) {
  if (!estado.mensaje) return null;
  return (
    <p
      role={estado.ok ? "status" : "alert"}
      className={`rounded-lg p-3 text-sm ${estado.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}
    >
      {estado.mensaje}
    </p>
  );
}

export const ESTADO_INICIAL: EstadoFormulario = {};
