"use client";

import { useId, type InputHTMLAttributes } from "react";
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
        <span id={idNota} className="text-xs text-slate-500">
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
