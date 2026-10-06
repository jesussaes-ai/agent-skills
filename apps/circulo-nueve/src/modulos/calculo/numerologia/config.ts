import type { ConfigNumerologia } from "./tipos";

export const MOTOR = "circulo-nueve/numerologia-pitagorica";
export const MOTOR_VERSION = "1.0.0";
export const REGLAS_VERSION = "pitagorica-es-1";
export const TRADICION = "Numerología pitagórica (tabla occidental A=1 … I=9)";

/**
 * Valores por defecto mientras no se definan las tradiciones a partir de los
 * libros del propietario. Todos son configurables por lectura.
 */
export const CONFIG_POR_DEFECTO: ConfigNumerologia = Object.freeze({
  numerosMaestros: true,
  maestros: Object.freeze([11, 22, 33]),
  enye: "como-n",
  y: "consonante",
  metodoCaminoDeVida: "por-componentes",
  metodoNombre: "total",
});

export function crearConfig(parcial: Partial<ConfigNumerologia> = {}): ConfigNumerologia {
  return { ...CONFIG_POR_DEFECTO, ...parcial };
}
