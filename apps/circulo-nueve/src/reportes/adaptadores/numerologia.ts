import type { ResultadoNumerologia } from "@/modulos/calculo/numerologia";
import type { Calculo, DatoAutorizado, DatosReporte } from "../tipos";

const ORDEN = ["caminoDeVida", "expresion", "alma", "personalidad"] as const;

export function calculosDeNumerologia(r: ResultadoNumerologia): Calculo[] {
  return ORDEN.map((clave) => r.indicadores.find((i) => i.clave === clave))
    .filter((i) => i !== undefined)
    .map((i) => ({
      titulo: i.nombre,
      valor: String(i.valor),
      subtitulo: i.descripcion,
      destacado: i.esMaestro ? "Número maestro" : undefined,
      pasos: i.pasos.map((p) => ({ descripcion: p.descripcion, operacion: p.operacion })),
    }));
}

export function datosAutorizadosDeNumerologia(r: ResultadoNumerologia): DatoAutorizado[] {
  const datos: DatoAutorizado[] = [];
  if (r.entradas.nombreOriginal) {
    datos.push({
      etiqueta: "Nombre completo de nacimiento",
      valor: r.entradas.nombreOriginal,
      nota: r.entradas.nombreNormalizado ? `Normalizado para el cálculo: ${r.entradas.nombreNormalizado}` : undefined,
    });
  }
  if (r.entradas.fecha) datos.push({ etiqueta: "Fecha de nacimiento", valor: r.entradas.fecha });
  return datos;
}

/** Límites que se derivan del propio resultado; el llamador puede añadir más. */
export function limitesDeNumerologia(r: ResultadoNumerologia): string[] {
  return [
    `Cálculo según ${r.tradicion}, reglas ${r.reglasVersion} (motor ${r.motor} ${r.motorVersion}). Otras escuelas pueden asignar valores distintos.`,
    ...r.cambios.map((c) => `Normalización: «${c.original}» → «${c.resultado}» (${c.regla}).`),
    ...r.advertencias,
  ];
}

export type CamposNumerologiaReporte = Pick<
  DatosReporte,
  "tipo" | "tradicion" | "versionReglas" | "datosAutorizados" | "calculos" | "limites"
>;

export function reporteDeNumerologia(r: ResultadoNumerologia): CamposNumerologiaReporte {
  return {
    tipo: "numerologia",
    tradicion: r.tradicion,
    versionReglas: r.reglasVersion,
    datosAutorizados: datosAutorizadosDeNumerologia(r),
    calculos: calculosDeNumerologia(r),
    limites: limitesDeNumerologia(r),
  };
}
