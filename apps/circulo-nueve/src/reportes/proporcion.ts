import type { DatosReporte } from "./tipos";

export interface ProporcionFuentes {
  aportadas: number;
  complementarias: number;
  total: number;
  /** 0–1; null si no hay citas. */
  proporcionAportadas: number | null;
  objetivo: number;
  cumpleObjetivo: boolean | null;
}

function claveCita(fuenteId: string, l: DatosReporte["interpretaciones"][number]["citas"][number]["localizador"]): string {
  return [fuenteId, l.paginaImpresa, l.paginaArchivo, l.capitulo, l.seccion, l.url, l.marcaTiempo].join("|");
}

/**
 * Cuenta fragmentos citados distintos (fuente + localizador), de modo que citar
 * varias veces el mismo pasaje no infle la proporción.
 */
export function calcularProporcion(datos: Pick<DatosReporte, "interpretaciones" | "fuentes" | "objetivoAportadas">): ProporcionFuentes {
  const grupos = new Map(datos.fuentes.map((f) => [f.id, f.grupo]));
  const vistos = new Set<string>();
  let aportadas = 0;
  let complementarias = 0;

  for (const interp of datos.interpretaciones) {
    for (const cita of interp.citas) {
      const grupo = grupos.get(cita.fuenteId);
      if (!grupo) throw new Error(`Cita a una fuente no declarada: ${cita.fuenteId}`);
      const clave = claveCita(cita.fuenteId, cita.localizador);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      if (grupo === "aportada") aportadas++;
      else complementarias++;
    }
  }

  const total = aportadas + complementarias;
  const objetivo = datos.objetivoAportadas ?? 0.8;
  const proporcionAportadas = total ? aportadas / total : null;
  return {
    aportadas,
    complementarias,
    total,
    proporcionAportadas,
    objetivo,
    cumpleObjetivo: proporcionAportadas === null ? null : proporcionAportadas >= objetivo,
  };
}

export function formatearLocalizador(l: DatosReporte["interpretaciones"][number]["citas"][number]["localizador"]): string {
  const partes = [
    l.capitulo && `cap. ${l.capitulo}`,
    l.seccion && `secc. ${l.seccion}`,
    l.paginaImpresa && `p. ${l.paginaImpresa}`,
    l.marcaTiempo && `min. ${l.marcaTiempo}`,
    l.url,
  ].filter(Boolean);
  return partes.join(", ");
}
