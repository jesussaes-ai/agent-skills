"use client";

import { useId, type SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string;
  name: string;
  opciones: readonly (readonly [string, string])[];
  error?: string;
}

export function Selector({ etiqueta, opciones, error, ...props }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <select
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="rounded-lg border border-slate-300 px-3 py-2 text-base"
      >
        {opciones.map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

export function Casilla({ etiqueta, name, defaultChecked, disabled, value }: { etiqueta: string; name: string; defaultChecked?: boolean; disabled?: boolean; value?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} disabled={disabled} className="mt-1 h-5 w-5" />
      <label htmlFor={id} className={`text-sm ${disabled ? "text-slate-400" : "text-slate-700"}`}>
        {etiqueta}
      </label>
    </div>
  );
}
