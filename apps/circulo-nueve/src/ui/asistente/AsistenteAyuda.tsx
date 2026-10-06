"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { SECCIONES_AYUDA } from "@/content/ayuda";
import { NOMBRE_CAMPO, crearAsistenteDemo, type RespuestaAsistente } from "@/modulos/conversacion";
import { textoConsentimiento } from "@/modulos/proveedores/privacidad";
import type { ProveedorPublico } from "@/modulos/proveedores/tipos";
import { Boton } from "@/ui/componentes/Boton";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Seccion, Etiqueta } from "@/ui/componentes/Seccion";
import { ControlesVoz } from "@/ui/voz/ControlesVoz";
import { DictadoVoz } from "@/ui/voz/DictadoVoz";

const SUGERENCIAS = ["¿Cómo se cuenta la ñ?", "¿Qué falta del proyecto?", "¿Se guardan mis datos?"];
const DEMO = "demo";

interface RespuestaServidor {
  ok: boolean;
  respuesta?: RespuestaAsistente;
  huboRespaldo?: boolean;
  error?: { codigo: string; mensaje: string };
}

function politica(p: ProveedorPublico): string {
  const si = (v: boolean | null | undefined, texto: string) => (v === false ? `no ${texto}` : v === true ? texto : `${texto}: sin dato`);
  return `${si(p.politicaDatos.entrena, "entrena")}, ${p.politicaDatos.exigirZdr ? "retención cero exigida" : si(p.politicaDatos.retiene, "retiene")}`;
}

export function AsistenteAyuda() {
  const demo = useMemo(() => crearAsistenteDemo(SECCIONES_AYUDA), []);
  const [proveedores, setProveedores] = useState<ProveedorPublico[]>([]);
  const [modo, setModo] = useState(DEMO);
  const [aceptados, setAceptados] = useState<Set<string>>(new Set());
  const [aceptaRespaldo, setAceptaRespaldo] = useState(false);
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState<RespuestaAsistente | null>(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const idModo = useId();
  const idModoNota = useId();

  useEffect(() => {
    let vigente = true;
    fetch("/api/asistente/proveedores", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { proveedores: [] }))
      .then((d: { proveedores?: ProveedorPublico[] }) => vigente && setProveedores(d.proveedores ?? []))
      .catch(() => vigente && setProveedores([]));
    return () => {
      vigente = false;
    };
  }, []);

  const elegido = proveedores.find((p) => p.id === modo);
  const otros = proveedores.filter((p) => p.id !== modo);
  const aceptado = elegido ? aceptados.has(elegido.id) : true;

  const preguntar = async (texto: string) => {
    if (!texto.trim() || enviando) return;
    setPregunta(texto);
    setNota("");
    if (!elegido) {
      setRespuesta(await demo.responder(texto));
      return;
    }
    if (!aceptado) {
      setNota("Acepta el aviso de envío para usar este proveedor, o vuelve al modo demo.");
      return;
    }
    setEnviando(true);
    try {
      const consentidos = [elegido.id, ...(aceptaRespaldo ? otros.map((p) => p.id) : [])];
      const r = await fetch("/api/asistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pregunta: texto, proveedorId: elegido.id, consentidos }),
      });
      const datos = (await r.json().catch(() => ({ ok: false }))) as RespuestaServidor;
      if (datos.ok && datos.respuesta) {
        setRespuesta(datos.respuesta);
        if (datos.huboRespaldo) setNota("El proveedor elegido no respondió; contestó un modelo de respaldo que aceptaste.");
      } else {
        setRespuesta(await demo.responder(texto));
        setNota(`${datos.error?.mensaje ?? "El proveedor no respondió."} Se muestra la búsqueda demo, hecha en tu navegador.`);
      }
    } catch {
      setRespuesta(await demo.responder(texto));
      setNota("No se pudo contactar al servidor. Se muestra la búsqueda demo, hecha en tu navegador.");
    } finally {
      setEnviando(false);
    }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    void preguntar(pregunta);
  };

  const textoVoz = respuesta?.afirmaciones.map((a) => a.texto).join(" ") ?? "";
  const etiqueta = elegido ? (
    <Etiqueta tono={elegido.politicaDatos.permiteDatosReales ? "violeta" : "ambar"}>
      IA · {elegido.politicaDatos.permiteDatosReales ? "apta para datos reales" : "solo demo"}
    </Etiqueta>
  ) : (
    <Etiqueta tono="ambar">Demo sin IA</Etiqueta>
  );

  return (
    <Seccion titulo="Pregunta sobre la app" ayuda="asistente" etiqueta={etiqueta}>
      <div className="mb-4 flex flex-col gap-1">
        <label htmlFor={idModo} className="text-sm font-medium text-slate-700">
          Cómo responder
        </label>
        <select
          id={idModo}
          value={modo}
          onChange={(e) => {
            setModo(e.target.value);
            setNota("");
          }}
          aria-describedby={idModoNota}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
        >
          <option value={DEMO}>Demo sin IA (búsqueda en tu navegador, nada se envía)</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {p.modelo} ({p.politicaDatos.permiteDatosReales ? "apto para datos reales" : "solo demo"})
            </option>
          ))}
        </select>
        <span id={idModoNota} className="text-xs text-slate-500">
          {proveedores.length
            ? "Los proveedores de IA los configura la administración. Antes de enviar verás quién recibe tu pregunta."
            : "No hay proveedores de IA activos: el asistente funciona en modo demo."}
        </span>
      </div>

      {elegido && (
        <div role="note" className="mb-4 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p>
            <strong>Antes de enviar.</strong> {textoConsentimiento(elegido)}
          </p>
          <p>
            Política de datos: {elegido.politicaDatos.descripcion} ({politica(elegido)}).
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={aceptado}
              onChange={(e) =>
                setAceptados((prev) => {
                  const nuevo = new Set(prev);
                  if (e.target.checked) nuevo.add(elegido.id);
                  else nuevo.delete(elegido.id);
                  return nuevo;
                })
              }
            />
            Acepto enviar mi pregunta a {elegido.nombre} en esta sesión.
          </label>
          {otros.length > 0 && (
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={aceptaRespaldo} onChange={(e) => setAceptaRespaldo(e.target.checked)} />
              Si no responde, acepto usar como respaldo: {otros.map((p) => `${p.nombre} (${p.destinatarios})`).join("; ")}.
            </label>
          )}
        </div>
      )}

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
        <Boton
          type="submit"
          disabled={enviando || (Boolean(elegido) && !aceptado)}
          aria-busy={enviando || undefined}
          descripcion={
            elegido
              ? aceptado
                ? `Envía tu pregunta y fragmentos del Centro de ayuda a ${elegido.nombre} y muestra la respuesta con sus citas.`
                : "Primero acepta el aviso de envío, o elige «Demo sin IA»."
              : "Busca la respuesta en el Centro de ayuda y muestra los fragmentos con su cita."
          }
        >
          {enviando ? "Preguntando…" : "Preguntar"}
        </Boton>
      </form>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <DictadoVoz alTexto={setPregunta} />
        {SUGERENCIAS.map((s) => (
          <Boton
            key={s}
            variante="secundario"
            className="text-sm"
            disabled={enviando || (Boolean(elegido) && !aceptado)}
            descripcion={`Pregunta: «${s}»`}
            onClick={() => void preguntar(s)}
          >
            {s}
          </Boton>
        ))}
      </div>

      {nota && (
        <p role="status" className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-800">
          {nota}
        </p>
      )}

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
          <ControlesVoz texto={textoVoz} />
        </div>
      )}
    </Seccion>
  );
}
