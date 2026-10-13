import type { ReactNode } from "react";
import { DibujoMotivo, type Motivo } from "./Motivos";

interface Props {
  titulo: string;
  children?: ReactNode;
  motivo?: Motivo;
  /** «error» se anuncia a lectores de pantalla como alerta. */
  tono?: "vacio" | "error";
}

/** Estado vacío o de error con el estilo de marca: dice qué pasa y qué hacer después. */
export function EstadoVacio({ titulo, children, motivo = "emblema", tono = "vacio" }: Props) {
  return (
    <div
      role={tono === "error" ? "alert" : undefined}
      className={`flex items-start gap-3 rounded-xl border border-dashed p-4 ${tono === "error" ? "border-red-300 bg-red-50/70" : "border-oro-300 bg-white/60"}`}
    >
      <DibujoMotivo motivo={motivo} className={`mt-0.5 h-8 w-8 shrink-0 ${tono === "error" ? "text-red-700" : "text-oro-500"}`} />
      <div className="text-sm">
        <p className="font-semibold text-slate-900">{titulo}</p>
        {children && <div className="mt-1 text-slate-700">{children}</div>}
      </div>
    </div>
  );
}
