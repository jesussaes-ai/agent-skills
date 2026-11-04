import type { Metadata } from "next";
import { ETIQUETA_ESTADO, SECCIONES_AYUDA, VERSION_AYUDA } from "@/content/ayuda";
import { AsistenteAyuda } from "@/ui/asistente/AsistenteAyuda";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Desplegable } from "@/ui/componentes/Desplegable";
import guiaBotones from "@/content/ayuda/guia-botones.json";
import { Etiqueta } from "@/ui/componentes/Seccion";

export const metadata: Metadata = { title: "Centro de ayuda · Círculo Nueve" };

export default function CentroDeAyuda() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Centro de ayuda</h1>
        <p className="mt-2 text-slate-700">
          Qué hace cada sección, qué datos usa y cómo se usa. Contenido versión {VERSION_AYUDA}.
        </p>
      </div>

      <nav aria-label="Secciones de ayuda" className="tarjeta-cristal p-4">
        <ul className="flex flex-wrap gap-x-2 gap-y-1">
          {SECCIONES_AYUDA.map((s) => (
            <li key={s.id}>
              <EnlaceBoton href={`#${s.id}`} descripcion={s.resumen}>
                {s.titulo}
              </EnlaceBoton>
            </li>
          ))}
        </ul>
      </nav>

      <AsistenteAyuda />

      <section id="guia-botones" aria-labelledby="titulo-guia" className="tarjeta-cristal scroll-mt-6 p-5 sm:p-6">
        <h2 id="titulo-guia" className="text-xl font-semibold text-slate-900">Guía de todos los botones</h2>
        <p className="mb-4 mt-1 text-sm text-slate-700">
          Lo que hace cada botón, agrupado por pantalla. Es la misma explicación que aparece al pasar el ratón por encima o al tocarlo en el teléfono.
        </p>
        <div className="space-y-2">
          {guiaBotones.map((g) => (
            <Desplegable key={g.pantalla} titulo={`${g.pantalla} (${g.botones.length})`} descripcion={`Muestra qué hace cada botón de la pantalla «${g.pantalla}».`}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 [overflow-wrap:anywhere]">
                {g.botones.map((b) => (
                  <li key={`${b.nombre}|${b.descripcion}`}>
                    <strong className="text-slate-900">{b.nombre}:</strong> {b.descripcion}
                  </li>
                ))}
              </ul>
            </Desplegable>
          ))}
        </div>
      </section>

      {SECCIONES_AYUDA.map((s) => (
        <article key={s.id} id={s.id} className="tarjeta-cristal scroll-mt-6 p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900">{s.titulo}</h2>
            <Etiqueta tono={s.estado === "pendiente" ? "gris" : s.estado === "demo" ? "ambar" : "violeta"}>
              {ETIQUETA_ESTADO[s.estado]}
            </Etiqueta>
          </div>
          <p className="mb-4 text-slate-700">{s.deQueTrata}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold text-slate-900">Qué datos usa</h3>
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {s.datosQueUsa.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Cómo se usa</h3>
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {s.comoSeUsa.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
