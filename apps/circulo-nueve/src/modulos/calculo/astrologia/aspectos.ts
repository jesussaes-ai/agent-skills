import { separacion } from "./angulos";
import { ASPECTOS } from "./config";
import type { AspectoCalculado, ClavePunto, ConfigAspecto } from "./tipos";

export interface PuntoParaAspecto {
  clave: ClavePunto;
  /** Longitud con la hora de referencia. */
  longitud: number;
  /** Longitudes en cada muestra de los márgenes (mismo orden para todos los puntos). */
  muestras: number[];
  /** Grados/día, para saber si el aspecto se forma o se deshace. */
  velocidad?: number;
}

function orbe(a: number, b: number, angulo: number): number {
  return Math.abs(separacion(a, b) - angulo);
}

/**
 * Aspectos entre todos los pares de puntos. Un aspecto se marca como incierto
 * si en alguna muestra de los márgenes de hora o lugar el orbe cruza el máximo.
 */
export function calcularAspectos(puntos: PuntoParaAspecto[], config: ConfigAspecto[]): AspectoCalculado[] {
  const activos = config.filter((c) => c.activo && c.orbe > 0);
  const resultado: AspectoCalculado[] = [];
  for (let i = 0; i < puntos.length; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      const p = puntos[i];
      const q = puntos[j];
      // La relación Ascendente–Medio Cielo es geométrica, no un aspecto.
      if ((p.clave === "asc" && q.clave === "mc") || (p.clave === "mc" && q.clave === "asc")) continue;
      for (const c of activos) {
        const def = ASPECTOS[c.clave];
        const orbes = p.muestras.map((m, k) => orbe(m, q.muestras[k], def.angulo));
        const minimo = Math.min(...orbes);
        if (minimo > c.orbe) continue;
        const actual = orbe(p.longitud, q.longitud, def.angulo);
        const incierto = Math.max(...orbes) > c.orbe;
        let fase: AspectoCalculado["fase"];
        if (p.velocidad !== undefined && q.velocidad !== undefined) {
          const paso = 1 / 24;
          const despues = orbe(p.longitud + p.velocidad * paso, q.longitud + q.velocidad * paso, def.angulo);
          fase = despues < actual ? "aplicativo" : "separativo";
        }
        resultado.push({
          a: p.clave,
          b: q.clave,
          aspecto: c.clave,
          nombre: def.nombre,
          angulo: def.angulo,
          orbe: actual,
          orbeMaximo: c.orbe,
          incierto: incierto || actual > c.orbe,
          fase,
        });
      }
    }
  }
  return resultado.sort((x, y) => x.orbe - y.orbe);
}
