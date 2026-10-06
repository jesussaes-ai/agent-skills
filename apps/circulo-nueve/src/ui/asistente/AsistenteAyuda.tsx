"use client";

import { useMemo, useState, type FormEvent } from "react";
import { SECCIONES_AYUDA } from "@/content/ayuda";
import { NOMBRE_CAMPO, crearAsistenteDemo, type RespuestaAsistente } from "@/modulos/conversacion";
import { Boton } from "@/ui/componentes/Boton";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Seccion, Etiqueta } from "@/ui/componentes/Seccion";

const SUGERENCIAS = ["¿Cómo se cuenta la ñ?", "¿Qué falta del proyecto?", "¿Se guardan mis datos?"];

export function AsistenteAyuda() {
  const asistente = useMemo(() => crearAsistenteDemo(SECCIONES_AYUDA), []);
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState<RespuestaAsistente | null>(null);

  const preguntar = async (texto: string) => {
    if (!texto.trim()) return;
    setPregunta(texto);
    setRespuesta(await asistente.responder(texto));
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    void preguntar(pregunta);
  };

  return (
    <Seccion titulo="Pregunta sobre la app" ayuda="asistente" etiqueta={<Etiqueta tono="ambar">Demo sin IA</Etiqueta>}>
      <form onSubmit={enviar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Tu pregunta
          <input
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            maxLength={300}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
            placeholder="Por ejemplo: ¿qué son los números maestros?"
          />
        </label>
        <Boton type="submit" descripcion="Busca la respuesta en el Centro de ayuda y muestra los fragmentos con su cita.">
          Preguntar
        </Boton>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGERENCIAS.map((s) => (
          <Boton key={s} variante="secundario" className="text-sm" descripcion={`Pregunta: «${s}»`} onClick={() => void preguntar(s)}>
            {s}
          </Boton>
        ))}
      </div>

      {respuesta && (
        <div aria-live="polite" className="mt-5 space-y-3">
          <p className="text-xs text-slate-500">{respuesta.aviso}</p>
          {respuesta.afirmaciones.map((a, i) => (
            <div key={i} className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-800">{a.tipo === "extracto" && a.citas.length ? `«${a.texto}»` : a.texto}</p>
              {a.citas.map((c) => (
                <p key={c.fragmentoId} className="mt-1 text-sm text-slate-600">
                  Fuente: Centro de ayuda —{" "}
                  <EnlaceBoton
                    href={c.enlace}
                    className="px-0"
                    descripcion={`Abre la sección «${c.tituloSeccion}» del Centro de ayuda.`}
                  >
                    {c.tituloSeccion}
                  </EnlaceBoton>{" "}
                  ({NOMBRE_CAMPO[c.campo]})
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </Seccion>
  );
}
