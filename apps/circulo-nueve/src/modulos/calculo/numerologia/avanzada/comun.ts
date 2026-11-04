import { MOTOR, MOTOR_VERSION, REGLAS_VERSION, TRADICION } from "../config";
import { esMaestro, reducir } from "../reducir";
import type { ConfigNumerologia, Paso } from "../tipos";
import type { ClaveAvanzada, IndicadorAvanzado, MetadatosAvanzada } from "./tipos";

export const MOTOR_AVANZADA_VERSION = "1.0.0";

export function metadatos(config: ConfigNumerologia): MetadatosAvanzada {
  return {
    motor: `${MOTOR}/avanzada`,
    motorVersion: `${MOTOR_VERSION}+avanzada-${MOTOR_AVANZADA_VERSION}`,
    tradicion: TRADICION,
    reglasVersion: REGLAS_VERSION,
    reglas: config,
  };
}

/** Reduce siempre a 1–9, ignorando los números maestros (para edades, desafíos y comparaciones). */
export function reducirAUnDigito(n: number, config: ConfigNumerologia, etiqueta: string): { valor: number; pasos: Paso[] } {
  return reducir(n, { ...config, numerosMaestros: false }, etiqueta);
}

/** Registra un componente (día, mes, año…) y lo reduce. Devuelve el valor reducido. */
export function componente(
  etiqueta: string,
  n: number,
  config: ConfigNumerologia,
  pasos: Paso[],
  unDigito = false,
): number {
  const r = unDigito ? reducirAUnDigito(n, config, `${etiqueta}: reducción`) : reducir(n, config, `${etiqueta}: reducción`);
  pasos.push({ descripcion: etiqueta, operacion: String(n) }, ...r.pasos);
  return r.valor;
}

export function crearIndicador(
  clave: ClaveAvanzada,
  nombre: string,
  descripcion: string,
  valor: number,
  pasos: Paso[],
  config: ConfigNumerologia,
): IndicadorAvanzado {
  return { clave, nombre, descripcion, valor, esMaestro: esMaestro(valor, config), pasos };
}

export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}
