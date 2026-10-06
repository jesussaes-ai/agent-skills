"use client";

import { Boton } from "@/ui/componentes/Boton";
import { Etiqueta, Seccion } from "@/ui/componentes/Seccion";
import type { Consentimientos } from "./tipos";

interface Props {
  valor: Consentimientos;
  onCambiar: (c: Consentimientos) => void;
  onAtras: () => void;
  onContinuar: () => void;
}

const NO_DISPONIBLES = [
  ["Guardar mi perfil", "Requiere cuentas y base de datos (etapa posterior)."],
  ["Guardar mi historial de lecturas", "Requiere cuentas y base de datos (etapa posterior)."],
  ["Enviar datos a un servicio de IA externo", "No hay proveedor configurado; el asistente funciona en modo demo."],
] as const;

export function Consentimiento({ valor, onCambiar, onAtras, onContinuar }: Props) {
  return (
    <Seccion titulo="Aviso de privacidad y consentimiento" ayuda="consentimiento">
      <div className="space-y-4 text-slate-700">
        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <p className="mb-1 font-semibold">Aviso de privacidad</p>
          <p>
            <Etiqueta tono="ambar">Pendiente</Etiqueta> El responsable completará el aviso (identidad y contacto,
            finalidades, datos tratados, conservación y derechos). Hasta entonces la app solo funciona como
            demostración, sin guardar ni enviar datos.
          </p>
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={valor.avisoLeido}
            onChange={(e) => onCambiar({ ...valor, avisoLeido: e.target.checked })}
          />
          <span>Leí el aviso y entiendo que esto es una demostración.</span>
        </label>

        <fieldset className="space-y-3">
          <legend className="mb-1 font-semibold">Permisos (cada uno por separado)</legend>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={valor.usarEnSesion}
              onChange={(e) => onCambiar({ ...valor, usarEnSesion: e.target.checked })}
            />
            <span>
              Usar los datos que escriba <strong>solo en esta sesión</strong> para calcular mi lectura.
            </span>
          </label>
          {NO_DISPONIBLES.map(([texto, motivo]) => (
            <label key={texto} className="flex items-start gap-3 text-slate-400">
              <input type="checkbox" className="mt-1 h-5 w-5" disabled checked={false} readOnly />
              <span>
                {texto} — <em>{motivo}</em>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Boton variante="secundario" descripcion="Vuelve a la bienvenida." onClick={onAtras}>
          Atrás
        </Boton>
        <Boton
          disabled={!valor.avisoLeido}
          descripcion={
            valor.avisoLeido
              ? "Pasa al formulario de perfil."
              : "Primero marca que leíste el aviso para poder continuar."
          }
          onClick={onContinuar}
        >
          Continuar
        </Boton>
      </div>
    </Seccion>
  );
}
