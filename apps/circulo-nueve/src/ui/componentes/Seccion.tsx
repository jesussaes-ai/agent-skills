import type { ReactNode } from "react";
import { AyudaContextual } from "./AyudaContextual";
import { DibujoMotivo, motivoDeSeccion, type Motivo } from "./Motivos";

interface Props {
  titulo: string;
  /** id de la sección en src/content/ayuda/secciones.json */
  ayuda: string;
  children: ReactNode;
  etiqueta?: ReactNode;
  /** Motivo decorativo; por defecto se elige según la sección de ayuda. */
  motivo?: Motivo;
}

export function Seccion({ titulo, ayuda, children, etiqueta, motivo }: Props) {
  // Las cifras del cuadrado mágico se atenúan más para no confundirse con resultados reales.
  const dibujo = motivo ?? motivoDeSeccion(ayuda);
  return (
    <section className="tarjeta-cristal relative overflow-hidden p-5 sm:p-6">
      <DibujoMotivo
        motivo={dibujo}
        className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 text-oro-500 sm:h-48 sm:w-48 ${dibujo === "numeros" ? "opacity-[0.08]" : "opacity-[0.13]"}`}
      />
      <div className="relative mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-900">{titulo}</h2>
        {etiqueta}
        <AyudaContextual seccion={ayuda} />
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

export function Etiqueta({ children, tono = "violeta" }: { children: ReactNode; tono?: "violeta" | "ambar" | "gris" }) {
  const tonos = {
    violeta: "bg-oro-100 text-oro-800",
    ambar: "bg-amber-100 text-amber-900",
    gris: "bg-slate-100 text-slate-700",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tonos[tono]}`}>{children}</span>;
}
