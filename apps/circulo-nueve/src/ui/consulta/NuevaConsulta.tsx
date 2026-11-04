"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { LugarNacimiento, PrecisionHora } from "@/modulos/calculo/astrologia";
import { proponerTransliteracion } from "@/modulos/calculo/cabala";
import { calcularConsulta, fechaLocal, type ResultadoConsulta } from "@/modulos/consulta/integral";
import { analizarPlatica, type AnalisisPlatica } from "@/modulos/consulta/platica";
import { Boton } from "@/ui/componentes/Boton";
import { Desplegable } from "@/ui/componentes/Desplegable";
import { Emblema } from "@/ui/componentes/Marca";
import { Seccion } from "@/ui/componentes/Seccion";
import { BuscadorLugar } from "@/ui/carta-natal/BuscadorLugar";
import { ResultadosCarta } from "@/ui/carta-natal/SeccionCartaNatal";
import { DictadoVoz } from "@/ui/voz/DictadoVoz";
import { TecladoHebreo } from "./TecladoHebreo";

type Paso = "platica" | "datos" | "hebreo" | "resultados";

const PASOS: { id: Paso; nombre: string }[] = [
  { id: "platica", nombre: "Plática" },
  { id: "datos", nombre: "Datos" },
  { id: "hebreo", nombre: "Nombre en hebreo" },
  { id: "resultados", nombre: "Resultados y carta PDF" },
];

interface Datos {
  nombre: string;
  nombrePreferido: string;
  fecha: string;
  hora: string;
  precisionHora: PrecisionHora;
  lugarTexto: string;
  lugar: LugarNacimiento | null;
}

const VACIOS: Datos = { nombre: "", nombrePreferido: "", fecha: "", hora: "", precisionHora: "desconocida", lugarTexto: "", lugar: null };

const NOMBRE_CAMPO = { nombre: "Nombre", fecha: "Fecha de nacimiento", hora: "Hora de nacimiento", lugar: "Lugar de nacimiento" } as const;

const claseCampo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900";

const zonaDelEquipo = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

function CampoConEtiqueta({ etiqueta, nota, children }: { etiqueta: string; nota?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {etiqueta}
      {children}
      {nota && <span className="text-xs font-normal text-slate-600">{nota}</span>}
    </label>
  );
}

function Numero({ titulo, valor, nota }: { titulo: string; valor: number | string; nota?: string }) {
  return (
    <div className="rounded-xl border border-oro-300 bg-oro-50 p-3 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-oro-800">{titulo}</p>
      <p className="text-3xl font-bold text-marino-800">{valor}</p>
      {nota && <p className="text-xs text-slate-600">{nota}</p>}
    </div>
  );
}

export function NuevaConsulta() {
  const [paso, setPaso] = useState<Paso>("platica");
  const [platica, setPlatica] = useState("");
  const [analisis, setAnalisis] = useState<AnalisisPlatica | null>(null);
  const [datos, setDatos] = useState<Datos>(VACIOS);
  const [hebreo, setHebreo] = useState("");
  const [aprobado, setAprobado] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [descargando, setDescargando] = useState(false);
  const [mensajePdf, setMensajePdf] = useState("");

  const propuesta = useMemo(() => proponerTransliteracion(datos.nombre), [datos.nombre]);
  const indice = PASOS.findIndex((p) => p.id === paso);
  const set = <K extends keyof Datos>(k: K, v: Datos[K]) => setDatos((d) => ({ ...d, [k]: v }));

  const analizar = () => {
    const a = analizarPlatica(platica);
    setAnalisis(a);
    setDatos((d) => ({
      ...d,
      nombre: a.nombre ?? d.nombre,
      fecha: a.fecha ?? d.fecha,
      hora: a.hora ?? d.hora,
      precisionHora: a.hora || a.hallazgos.some((h) => h.campo === "hora") ? a.precisionHora : d.precisionHora,
      lugarTexto: a.lugar ?? d.lugarTexto,
    }));
    setPaso("datos");
  };

  const irAHebreo = () => {
    const faltan = [!datos.nombre.trim() && "el nombre completo", !datos.fecha && "la fecha de nacimiento"].filter(Boolean);
    if (faltan.length) return setErrores([`Falta ${faltan.join(" y ")}.`]);
    if (datos.precisionHora !== "desconocida" && !datos.hora) return setErrores(["Escribe la hora o marca «No sé la hora»."]);
    setErrores([]);
    if (!aprobado) setHebreo(propuesta.map((p) => p.hebreo).join(" "));
    setPaso("hebreo");
  };

  const calcular = (conHebreo: boolean) => {
    const r = calcularConsulta({
      nombre: datos.nombre,
      nombrePreferido: datos.nombrePreferido || undefined,
      fecha: datos.fecha,
      hora: datos.hora || undefined,
      precisionHora: datos.precisionHora,
      lugar: datos.lugar ?? undefined,
      hebreo: conHebreo ? hebreo : undefined,
      fechaConsulta: fechaLocal(zonaDelEquipo()),
    });
    if (!r.ok) {
      setErrores(r.errores);
      setPaso("datos");
      return;
    }
    setErrores([]);
    setResultado(r);
    setMensajePdf("");
    setPaso("resultados");
  };

  const descargarPdf = async () => {
    setDescargando(true);
    setMensajePdf("");
    try {
      const l = datos.lugar;
      const lugar =
        l?.fuente.tipo === "geonames"
          ? { tipo: "geonames", geonameId: l.fuente.geonameId }
          : l
            ? { tipo: "manual", nombre: l.nombre, latitud: l.latitud, longitud: l.longitud, zona: l.zonaHoraria ?? "UTC" }
            : undefined;
      const r = await fetch("/api/consulta/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombre: datos.nombre,
          nombrePreferido: datos.nombrePreferido || undefined,
          fecha: datos.fecha,
          hora: datos.precisionHora === "desconocida" ? undefined : datos.hora,
          precisionHora: datos.precisionHora,
          lugar,
          hebreo: resultado?.cabala ? hebreo : undefined,
          zonaUsuario: zonaDelEquipo(),
        }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { mensaje?: string };
        throw new Error(e.mensaje ?? "No se pudo generar la carta.");
      }
      const archivo = await r.blob();
      const nombreArchivo = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? "carta-circulo-nueve.pdf";
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreArchivo;
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMensajePdf(`Listo: se descargó ${nombreArchivo}.`);
    } catch (e) {
      setMensajePdf(e instanceof Error ? e.message : "No se pudo generar la carta.");
    } finally {
      setDescargando(false);
    }
  };

  const empezarDeNuevo = () => {
    setPlatica("");
    setAnalisis(null);
    setDatos(VACIOS);
    setHebreo("");
    setAprobado(false);
    setResultado(null);
    setErrores([]);
    setPaso("platica");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Nueva consulta</h1>
        <p className="mt-2 text-slate-700">
          Cuenta la plática o escribe los datos. Círculo Nueve detecta el nombre, la fecha, la hora y el lugar, tú los confirmas, y sale todo junto en una
          sola carta PDF: numerología, cábala y carta natal. Nada se guarda.
        </p>
      </div>

      <nav aria-label="Pasos de la consulta">
        <ol className="flex flex-wrap gap-2 text-sm">
          {PASOS.map((p, i) => (
            <li
              key={p.id}
              aria-current={i === indice ? "step" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${i === indice ? "bg-marino-800 text-white" : i < indice ? "bg-oro-100 text-oro-800" : "bg-slate-100 text-slate-600"}`}
            >
              {i === indice && <Emblema tamano={16} />}
              {i + 1}. {p.nombre}
            </li>
          ))}
        </ol>
      </nav>

      {errores.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {errores.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      {paso === "platica" && (
        <Seccion titulo="1. Cuéntame" ayuda="consulta-platica">
          <div className="space-y-3">
            <CampoConEtiqueta
              etiqueta="Plática con la persona"
              nota="Pega o dicta lo que platicaron. Por ejemplo: «Me llamo Ana María Núñez, nací el 15 de julio de 1990 como a las 8 de la mañana en Guadalajara»."
            >
              <textarea
                className={`${claseCampo} min-h-40`}
                value={platica}
                onChange={(e) => setPlatica(e.target.value)}
                placeholder="Escribe, pega o dicta aquí la plática…"
              />
            </CampoConEtiqueta>
            <DictadoVoz alTexto={(t) => setPlatica((p) => (p ? `${p} ${t}` : t))} />
            <div className="flex flex-wrap gap-2">
              <Boton
                descripcion="Busca en la plática el nombre completo, la fecha, la hora y el lugar de nacimiento. Después podrás corregirlos."
                disabled={!platica.trim()}
                onClick={analizar}
              >
                Analizar la plática
              </Boton>
              <Boton variante="secundario" descripcion="Salta la plática y escribe los datos a mano." onClick={() => setPaso("datos")}>
                Prefiero escribir los datos
              </Boton>
            </div>
          </div>
        </Seccion>
      )}

      {paso === "datos" && (
        <Seccion titulo="2. Confirma los datos" ayuda="consulta-datos">
          {analisis && (
            <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {analisis.hallazgos.length ? (
                <ul className="space-y-1">
                  {analisis.hallazgos.map((h) => (
                    <li key={h.campo}>
                      <strong>{NOMBRE_CAMPO[h.campo]}:</strong> {h.valor} <span className="text-slate-600">— lo encontré en «{h.fragmento}»</span>
                      {h.confianza === "media" && <span className="ml-1 text-amber-900">(revísalo)</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No encontré datos en la plática. Escríbelos abajo.</p>
              )}
              {analisis.faltan.length > 0 && <p className="mt-2">Faltan: {analisis.faltan.map((f) => NOMBRE_CAMPO[f].toLowerCase()).join(", ")}.</p>}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoConEtiqueta etiqueta="Nombre completo de nacimiento" nota="Tal como aparece en el acta de nacimiento.">
              <input className={claseCampo} value={datos.nombre} onChange={(e) => set("nombre", e.target.value)} autoComplete="off" />
            </CampoConEtiqueta>
            <CampoConEtiqueta etiqueta="Cómo quiere que le llamen (opcional)" nota="Aparece en la portada de la carta.">
              <input className={claseCampo} value={datos.nombrePreferido} onChange={(e) => set("nombrePreferido", e.target.value)} autoComplete="off" />
            </CampoConEtiqueta>
            <CampoConEtiqueta etiqueta="Fecha de nacimiento">
              <input type="date" className={claseCampo} value={datos.fecha} onChange={(e) => set("fecha", e.target.value)} />
            </CampoConEtiqueta>
            <div className="grid grid-cols-2 gap-3">
              <CampoConEtiqueta etiqueta="Hora">
                <input
                  type="time"
                  className={claseCampo}
                  value={datos.hora}
                  disabled={datos.precisionHora === "desconocida"}
                  onChange={(e) => {
                    const hora = e.target.value;
                    setDatos((d) => ({ ...d, hora, precisionHora: d.precisionHora === "desconocida" && hora ? "exacta" : d.precisionHora }));
                  }}
                />
              </CampoConEtiqueta>
              <CampoConEtiqueta etiqueta="Precisión">
                <select
                  className={claseCampo}
                  value={datos.precisionHora}
                  onChange={(e) => {
                    const p = e.target.value as PrecisionHora;
                    setDatos((d) => ({ ...d, precisionHora: p, hora: p === "desconocida" ? "" : d.hora }));
                  }}
                >
                  <option value="exacta">Exacta</option>
                  <option value="aproximada">Aproximada</option>
                  <option value="desconocida">No sé la hora</option>
                </select>
              </CampoConEtiqueta>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-1 text-sm font-medium text-slate-700">
              Lugar de nacimiento {datos.lugarTexto && !datos.lugar && <span className="font-normal text-slate-600">(en la plática: «{datos.lugarTexto}»; elígelo en la lista)</span>}
            </p>
            <BuscadorLugar key={datos.lugarTexto} consultaInicial={datos.lugarTexto} lugar={datos.lugar} buscarAlAbrir onElegir={(l) => set("lugar", l)} />
            <p className="mt-1 text-xs text-slate-600">Sin lugar se calculan la numerología y la cábala, pero no la carta natal.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Boton descripcion="Sigue al paso del nombre en letras hebreas, para la cábala." onClick={irAHebreo}>
              Continuar
            </Boton>
            <Boton variante="secundario" descripcion="Vuelve a la plática para corregirla o volver a analizarla." onClick={() => setPaso("platica")}>
              Atrás
            </Boton>
          </div>
        </Seccion>
      )}

      {paso === "hebreo" && (
        <Seccion titulo="3. El nombre en letras hebreas" ayuda="consulta-hebreo">
          <p className="mb-3 text-sm text-slate-700">
            La cábala trabaja con letras hebreas. Esta es la escritura propuesta para «{datos.nombre}». Revísala, corrígela con el teclado si hace falta y
            apruébala: sin tu aprobación no se calcula la cábala.
          </p>
          <p dir="rtl" lang="he" className="mb-3 rounded-xl border border-oro-300 bg-oro-50 p-4 text-center text-4xl text-marino-800" data-testid="hebreo">
            {hebreo || "—"}
          </p>
          <Desplegable titulo="Cómo se propuso cada palabra" descripcion="Muestra letra por letra cómo se pasó cada palabra del nombre al hebreo.">
            <ul className="space-y-2 text-sm text-slate-700">
              {propuesta.map((p) => (
                <li key={p.original}>
                  <strong>{p.original}</strong> → <span lang="he">{p.hebreo}</span>
                  <ul className="ml-4 list-disc text-xs text-slate-600">
                    {p.pasos.map((s, i) => (
                      <li key={i}>
                        {s.de} → <span lang="he">{s.a || "(muda)"}</span> · {s.regla}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Desplegable>
          <div className="mt-3">
            <CampoConEtiqueta etiqueta="Escritura en hebreo (editable)">
              <input
                dir="rtl"
                lang="he"
                className={`${claseCampo} text-2xl`}
                value={hebreo}
                onChange={(e) => {
                  setHebreo(e.target.value);
                  setAprobado(false);
                }}
              />
            </CampoConEtiqueta>
            <div className="mt-2">
              <TecladoHebreo
                onLetra={(l) => {
                  setHebreo((h) => h + l);
                  setAprobado(false);
                }}
                onBorrar={() => {
                  setHebreo((h) => Array.from(h).slice(0, -1).join(""));
                  setAprobado(false);
                }}
                onEspacio={() => setHebreo((h) => `${h} `)}
              />
            </div>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-slate-800">
            <input type="checkbox" className="mt-1" checked={aprobado} onChange={(e) => setAprobado(e.target.checked)} />
            Apruebo esta escritura del nombre en hebreo para calcular la cábala.
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Boton descripcion="Calcula numerología, ciclo personal, pináculos, cábala y carta natal con los datos confirmados." disabled={!aprobado || !hebreo.trim()} onClick={() => calcular(true)}>
              Calcular todo
            </Boton>
            <Boton variante="secundario" descripcion="Calcula todo menos la cábala, sin usar la escritura en hebreo." onClick={() => calcular(false)}>
              Seguir sin cábala
            </Boton>
            <Boton variante="sutil" descripcion="Vuelve a los datos de nacimiento." onClick={() => setPaso("datos")}>
              Atrás
            </Boton>
          </div>
        </Seccion>
      )}

      {paso === "resultados" && resultado && (
        <>
          <Seccion titulo="4. Resultados" ayuda="consulta-resultados">
            <div className="mb-4 flex flex-wrap gap-2">
              <Boton
                descripcion="Genera una sola carta PDF con todos los cálculos, sus pasos, la rueda de la carta natal y el aviso de privacidad al final. No se guarda en el servidor."
                disabled={descargando}
                onClick={descargarPdf}
                data-testid="descargar-carta"
              >
                {descargando ? "Generando la carta…" : "📄 Descargar la carta PDF"}
              </Boton>
              <Boton variante="secundario" descripcion="Vuelve a los datos para corregir algo y recalcular." onClick={() => setPaso("datos")}>
                Corregir datos
              </Boton>
              <Boton variante="sutil" descripcion="Borra todo lo de esta consulta y empieza otra." onClick={empezarDeNuevo}>
                Nueva consulta
              </Boton>
            </div>
            {mensajePdf && (
              <p role="status" className="mb-4 text-sm text-slate-700">
                {mensajePdf}
              </p>
            )}
            {resultado.omitidos.length > 0 && (
              <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                {resultado.omitidos.map((o) => (
                  <p key={o}>No se incluyó — {o}</p>
                ))}
              </div>
            )}
            <h3 className="mb-2 font-semibold text-slate-900">Numerología</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {resultado.numerologia.indicadores.map((i) => (
                <Numero key={i.clave} titulo={i.nombre} valor={i.valor} nota={i.esMaestro ? "Número maestro" : undefined} />
              ))}
            </div>
            {resultado.ciclo && (
              <>
                <h3 className="mb-2 mt-5 font-semibold text-slate-900">Hoy ({resultado.ciclo.entradas.fechaConsulta})</h3>
                <div className="grid grid-cols-3 gap-3">
                  <Numero titulo="Año personal" valor={resultado.ciclo.anioPersonal.valor} />
                  <Numero titulo="Mes personal" valor={resultado.ciclo.mesPersonal.valor} />
                  <Numero titulo="Día personal" valor={resultado.ciclo.diaPersonal.valor} />
                </div>
              </>
            )}
            {resultado.pinaculos && (
              <>
                <h3 className="mb-2 mt-5 font-semibold text-slate-900">Pináculos y desafíos</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-1 pr-3">Etapa</th>
                        <th className="py-1 pr-3">Edades</th>
                        <th className="py-1 pr-3">Pináculo</th>
                        <th className="py-1">Desafío</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.pinaculos.pinaculos.map((p, i) => (
                        <tr key={p.numero} className="border-b border-slate-100">
                          <td className="py-1 pr-3">{p.numero}</td>
                          <td className="py-1 pr-3">{p.edadFin === null ? `desde los ${p.edadInicio}` : `${p.edadInicio} a ${p.edadFin}`}</td>
                          <td className="py-1 pr-3 font-semibold">{p.valor}</td>
                          <td className="py-1 font-semibold">{resultado.pinaculos?.desafios[i]?.valor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {resultado.cabala && (
              <>
                <h3 className="mb-2 mt-5 font-semibold text-slate-900">Cábala</h3>
                <p dir="rtl" lang="he" className="text-center text-3xl text-marino-800">
                  {resultado.cabala.hebreo}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Numero titulo="Mispar Hejrají" valor={resultado.cabala.totales.hejraji} />
                  <Numero titulo="Mispar Gadol" valor={resultado.cabala.totales.gadol} />
                  <Numero titulo="Mispar Katán" valor={resultado.cabala.totales.katan} />
                  <Numero titulo="Reducción" valor={resultado.cabala.reduccion.valor} />
                </div>
                {resultado.cabala.correspondencias.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-slate-700">
                    {resultado.cabala.correspondencias.map((c) => (
                      <li key={c.origen}>
                        <strong>{c.origen}</strong> ({c.numero}) → sefirá {c.numeroSefira}, {c.sefira.nombre}: {c.sefira.significado} · pilar {c.sefira.pilar}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Seccion>
          {resultado.carta && (
            <Seccion titulo="Carta natal" ayuda="carta-natal">
              <ResultadosCarta r={resultado.carta} />
            </Seccion>
          )}
        </>
      )}
    </div>
  );
}
