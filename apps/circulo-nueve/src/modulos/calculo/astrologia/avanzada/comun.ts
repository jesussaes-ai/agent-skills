import { normalizar } from "../angulos";
import { calcularAspectos } from "../aspectos";
import { ayanamsaMedia } from "../ayanamsa";
import { casaDe } from "../casas";
import { ASPECTOS_POR_DEFECTO, MOTOR, MOTOR_VERSION, REGLAS_VERSION } from "../config";
import type { MotorEfemerides } from "../efemerides";
import { ANIO_MAXIMO, ANIO_MINIMO } from "../motor";
import { aIso } from "../tiempo";
import type { ClaveCuerpo, ClavePunto, ConfigAspecto, ConfigAstrologia, PosicionCalculada, ResultadoCarta } from "../tipos";
import type { AspectoCruzado, InstanteUtc, Reproducibilidad } from "./tipos";

export const MODULO_AVANZADO = "circulo-nueve/astrologia/avanzada";
export const MODULO_AVANZADO_VERSION = "1.0.0";
export const REGLAS_AVANZADAS_VERSION = "avanzada-2026.11";
export const DIA_MS = 86_400_000;

export const SIN_INTERPRETACION = {
  estado: "pendiente" as const,
  motivo: "Solo hay posiciones, aspectos, fechas y orbes calculados. Las interpretaciones requieren fuentes citadas y viven en otro módulo.",
};

/**
 * Orbes de tránsito por defecto (más pequeños que los natales 8/8/7/7/5):
 * conjunción, oposición, cuadratura y trígono 2°; sextil 1°.
 * Menores inactivos, con 1° si se activan.
 */
export const ORBES_TRANSITO_POR_DEFECTO: ConfigAspecto[] = [
  { clave: "conjuncion", activo: true, orbe: 2 },
  { clave: "oposicion", activo: true, orbe: 2 },
  { clave: "trigono", activo: true, orbe: 2 },
  { clave: "cuadratura", activo: true, orbe: 2 },
  { clave: "sextil", activo: true, orbe: 1 },
  { clave: "semisextil", activo: false, orbe: 1 },
  { clave: "quincuncio", activo: false, orbe: 1 },
  { clave: "semicuadratura", activo: false, orbe: 1 },
  { clave: "sesquicuadratura", activo: false, orbe: 1 },
];

/** Orbes de progresión y arco solar: 1° en los mayores; menores inactivos con 0,5°. */
export const ORBES_PROGRESION_POR_DEFECTO: ConfigAspecto[] = ORBES_TRANSITO_POR_DEFECTO.map((a) => ({
  ...a,
  orbe: a.activo ? 1 : 0.5,
}));

/** Orbes de sinastría: los mismos que la carta natal por defecto del motor (8/8/7/7/5; menores inactivos). */
export const ORBES_SINASTRIA_POR_DEFECTO: ConfigAspecto[] = ASPECTOS_POR_DEFECTO.map((a) => ({ ...a }));

/** Mezcla por clave, igual que `crearConfig` del motor. */
export function mezclarAspectos(base: ConfigAspecto[], parcial?: ConfigAspecto[]): ConfigAspecto[] {
  const porClave = new Map((parcial ?? []).map((a) => [a.clave, a]));
  return base.map((a) => ({ ...a, ...porClave.get(a.clave) }));
}

/** Convierte la entrada a ms UTC. Un texto sin `Z` ni desfase se rechaza (no se adivina la zona). */
export function leerInstante(x: InstanteUtc, nombre: string): { ms: number } | { error: string } {
  let ms: number;
  if (x instanceof Date) ms = x.getTime();
  else if (typeof x === "number") ms = x;
  else if (typeof x === "string" && /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(x.trim())) ms = Date.parse(x.trim());
  else return { error: `${nombre}: indica el instante en UTC (ISO 8601 con «Z» o desfase explícito), en ms o como Date.` };
  if (!Number.isFinite(ms)) return { error: `${nombre}: no es un instante válido.` };
  const anio = new Date(ms).getUTCFullYear();
  if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO) return { error: `${nombre}: solo se calculan fechas entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}.` };
  return { ms };
}

export const utcNatal = (carta: ResultadoCarta) => Date.parse(carta.tiempo.utc);

/** Ayanamsa (media + nutación) del zodiaco sideral, o 0 en tropical — misma fórmula que `calcularCartaNatal`. */
export function ayanamsaEn(motor: MotorEfemerides, config: ConfigAstrologia, t: number): number {
  return config.zodiaco === "sideral" ? ayanamsaMedia(config.ayanamsa, motor.siglosTT(t)) + motor.nutacionLongitud(t) : 0;
}

/** Longitud en el zodiaco de la carta (reutiliza el motor de efemérides). */
export function longitudEn(motor: MotorEfemerides, config: ConfigAstrologia, cuerpo: ClaveCuerpo, t: number): number {
  return normalizar(motor.longitud(cuerpo, t, config.nodo) - ayanamsaEn(motor, config, t));
}

/** Grados/día por diferencia centrada de ±12 h, como el motor natal. */
export function velocidadEn(motor: MotorEfemerides, config: ConfigAstrologia, cuerpo: ClaveCuerpo, t: number): number {
  const d = normalizar(motor.longitud(cuerpo, t + DIA_MS / 2, config.nodo) - motor.longitud(cuerpo, t - DIA_MS / 2, config.nodo));
  return d > 180 ? d - 360 : d;
}

export function cuspidesDe(carta: ResultadoCarta): number[] | null {
  return carta.casas ? carta.casas.cuspides.map((c) => c.longitud) : null;
}

export function casaEn(carta: ResultadoCarta, longitud: number): number | undefined {
  const c = cuspidesDe(carta);
  return c ? casaDe(longitud, c) : undefined;
}

/** Valores posibles de un punto natal: referencia y extremos de su rango de incertidumbre. */
export function muestrasNatales(p: PosicionCalculada, desplazamiento = 0): number[] {
  return [p.longitud, p.rango.desde, p.rango.hasta].map((x) => normalizar(x + desplazamiento));
}

export interface PuntoCruce {
  clave: ClavePunto;
  longitud: number;
  muestras: number[];
  velocidad?: number;
}

/**
 * Aspectos entre un punto de un conjunto y uno de otro, reutilizando
 * `calcularAspectos` del motor (orbe, incertidumbre y fase). Se usan claves
 * provisionales para que la regla interna «Asc–MC no es aspecto» (válida solo
 * dentro de una misma carta) no se aplique entre cartas distintas.
 */
export function aspectosEntre(origen: PuntoCruce, destino: PuntoCruce, config: ConfigAspecto[]): AspectoCruzado[] {
  const ma: number[] = [];
  const mb: number[] = [];
  for (const a of origen.muestras) for (const b of destino.muestras) {
    ma.push(a);
    mb.push(b);
  }
  return calcularAspectos(
    [
      { clave: "sol", longitud: origen.longitud, muestras: ma, velocidad: origen.velocidad },
      { clave: "luna", longitud: destino.longitud, muestras: mb, velocidad: destino.velocidad },
    ],
    config,
  ).map((x) => ({
    origen: origen.clave,
    destino: destino.clave,
    aspecto: x.aspecto,
    nombre: x.nombre,
    angulo: x.angulo,
    orbe: x.orbe,
    orbeMaximo: x.orbeMaximo,
    incierto: x.incierto,
    fase: x.fase,
  }));
}

export function datosCarta(carta: ResultadoCarta): Reproducibilidad["cartaNatal"] {
  return { utc: carta.tiempo.utc, motorVersion: carta.motorVersion, reglasVersion: carta.reglasVersion, efemerides: carta.efemerides };
}

export function reproducibilidad(carta: ResultadoCarta, motor: MotorEfemerides, ajustes: Record<string, unknown>): Reproducibilidad {
  return {
    motor: MOTOR,
    motorVersion: MOTOR_VERSION,
    efemerides: motor.nombre,
    reglasVersion: REGLAS_VERSION,
    modulo: MODULO_AVANZADO,
    moduloVersion: MODULO_AVANZADO_VERSION,
    reglasAvanzadasVersion: REGLAS_AVANZADAS_VERSION,
    config: carta.config,
    ajustes,
    cartaNatal: datosCarta(carta),
  };
}

/** Avisos comunes sobre la carta de partida. */
export function avisosCarta(carta: ResultadoCarta, motor: MotorEfemerides): string[] {
  const avisos: string[] = [];
  if (carta.motorVersion !== MOTOR_VERSION || carta.reglasVersion !== REGLAS_VERSION)
    avisos.push(
      `La carta natal se calculó con el motor ${carta.motorVersion} (reglas ${carta.reglasVersion}); este cálculo usa ${MOTOR_VERSION} (${REGLAS_VERSION}). Recalcula la carta para que todo sea coherente.`,
    );
  if (carta.efemerides !== motor.nombre) avisos.push(`La carta natal usó otras efemérides (${carta.efemerides}) que este cálculo (${motor.nombre}).`);
  if (carta.entradas.precisionHora !== "exacta")
    avisos.push(
      `La hora de nacimiento es ${carta.entradas.precisionHora}: los puntos natales rápidos (Luna, Asc, MC, casas) tienen rangos amplios y los aspectos con ellos se marcan como inciertos cuando el rango cruza el orbe.`,
    );
  return avisos;
}

export { aIso };
