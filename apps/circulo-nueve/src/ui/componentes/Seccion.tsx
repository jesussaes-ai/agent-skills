import type { ReactNode } from "react";
import { AyudaContextual } from "./AyudaContextual";

interface Props {
  titulo: string;
  /** id de la sección en src/content/ayuda/secciones.json */
  ayuda: string;
  children: ReactNode;
  etiqueta?: ReactNode;
}

export function Seccion({ titulo, ayuda, children, etiqueta }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-900">{titulo}</h2>
        {etiqueta}
        <AyudaContextual seccion={ayuda} />
      </div>
      {children}
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
