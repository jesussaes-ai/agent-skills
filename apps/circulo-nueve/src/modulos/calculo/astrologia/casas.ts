import { asen, atan, atan2, cos, diferencia, normalizar, sen, tan } from "./angulos";
import type { SistemaCasas, SistemaRespaldoPolar } from "./tipos";

export interface EntradaCasas {
  armc: number;
  latitud: number;
  oblicuidad: number;
}

export interface CasasCalculadas {
  /** 12 cúspides; índice 0 = casa 1. */
  cuspides: number[];
  asc: number;
  mc: number;
  sistemaUsado: SistemaCasas;
  /** true si el sistema pedido no está definido y se usó el de respaldo. */
  respaldo: boolean;
}

/** Punto de la eclíptica que asciende para un ARMC y una latitud (o "polo") dados. */
export function ascendente(armc: number, latitud: number, oblicuidad: number): number {
  return normalizar(atan2(cos(armc), -(sen(armc) * cos(oblicuidad) + tan(latitud) * sen(oblicuidad))));
}

export function medioCielo(armc: number, oblicuidad: number): number {
  return normalizar(atan2(sen(armc), cos(armc) * cos(oblicuidad)));
}

/** Límite de latitud para Placidus y Koch: fuera de él hay grados de la eclíptica que no salen o no se ponen. */
export function limitePolar(oblicuidad: number): number {
  return 90 - oblicuidad;
}

function porCuspidesIntermedias(asc: number, mc: number, c11: number, c12: number, c2: number, c3: number): number[] {
  const c = new Array<number>(12);
  c[0] = asc;
  c[1] = c2;
  c[2] = c3;
  c[3] = normalizar(mc + 180);
  c[9] = mc;
  c[10] = c11;
  c[11] = c12;
  for (const i of [4, 5, 6, 7, 8]) c[i] = normalizar(c[i - 6 < 0 ? i + 6 : i - 6] + 180);
  return c;
}

function placidus({ armc, latitud, oblicuidad }: EntradaCasas, asc: number, mc: number): number[] | null {
  const cuspide = (fraccion: number, superior: boolean): number | null => {
    let lon = normalizar(mc + (superior ? fraccion * 90 : 180 - fraccion * 90));
    for (let i = 0; i < 100; i++) {
      const dec = asen(sen(oblicuidad) * sen(lon));
      const x = tan(latitud) * tan(dec);
      if (Math.abs(x) >= 1) return null;
      const arcoSemidiurno = 90 + asen(x);
      const ar = superior ? armc + fraccion * arcoSemidiurno : armc + 180 - fraccion * (180 - arcoSemidiurno);
      const nueva = normalizar(atan2(sen(ar), cos(ar) * cos(oblicuidad)));
      if (Math.abs(diferencia(nueva, lon)) < 1e-10) return nueva;
      lon = nueva;
    }
    return lon;
  };
  const c11 = cuspide(1 / 3, true);
  const c12 = cuspide(2 / 3, true);
  const c2 = cuspide(2 / 3, false);
  const c3 = cuspide(1 / 3, false);
  if ([c11, c12, c2, c3].some((c) => c === null)) return null;
  return porCuspidesIntermedias(asc, mc, c11!, c12!, c2!, c3!);
}

function koch({ armc, latitud, oblicuidad }: EntradaCasas, asc: number, mc: number): number[] | null {
  const decMc = asen(sen(oblicuidad) * sen(mc));
  const x = tan(latitud) * tan(decMc);
  if (Math.abs(x) >= 1) return null;
  const tercio = asen(x) / 3;
  const a = (ar: number) => ascendente(ar - 90, latitud, oblicuidad);
  return porCuspidesIntermedias(
    asc,
    mc,
    a(armc + 30 - 2 * tercio),
    a(armc + 60 - tercio),
    a(armc + 120 + tercio),
    a(armc + 150 + 2 * tercio),
  );
}

function regiomontano({ armc, latitud, oblicuidad }: EntradaCasas, asc: number, mc: number): number[] {
  const polo1 = atan(tan(latitud) * 0.5);
  const polo2 = atan(tan(latitud) * cos(30));
  const a = (ar: number, polo: number) => ascendente(ar - 90, polo, oblicuidad);
  return porCuspidesIntermedias(asc, mc, a(armc + 30, polo1), a(armc + 60, polo2), a(armc + 120, polo2), a(armc + 150, polo1));
}

function campano({ armc, latitud, oblicuidad }: EntradaCasas, asc: number, mc: number): number[] {
  const polo1 = asen(sen(latitud) / 2);
  const polo2 = asen((Math.sqrt(3) / 2) * sen(latitud));
  const h1 = atan(Math.sqrt(3) / cos(latitud));
  const h2 = atan(1 / Math.sqrt(3) / cos(latitud));
  const a = (ar: number, polo: number) => ascendente(ar - 90, polo, oblicuidad);
  return porCuspidesIntermedias(asc, mc, a(armc + 90 - h1, polo1), a(armc + 90 - h2, polo2), a(armc + 90 + h2, polo2), a(armc + 90 + h1, polo1));
}

function porfirio(asc: number, mc: number): number[] {
  const arcoSuperior = normalizar(asc - mc);
  const arcoInferior = 180 - arcoSuperior;
  return porCuspidesIntermedias(
    asc,
    mc,
    normalizar(mc + arcoSuperior / 3),
    normalizar(mc + (2 * arcoSuperior) / 3),
    normalizar(asc + arcoInferior / 3),
    normalizar(asc + (2 * arcoInferior) / 3),
  );
}

function iguales(asc: number): number[] {
  return Array.from({ length: 12 }, (_, i) => normalizar(asc + 30 * i));
}

function signosEnteros(asc: number): number[] {
  const inicio = Math.floor(asc / 30) * 30;
  return Array.from({ length: 12 }, (_, i) => normalizar(inicio + 30 * i));
}

/** Sistemas de cuadrantes que dependen del horizonte y no se usan dentro de los círculos polares. */
export const SISTEMAS_NO_POLARES: readonly SistemaCasas[] = ["placidus", "koch", "regiomontano", "campano"];

function sistema(nombre: SistemaCasas, e: EntradaCasas, asc: number, mc: number): number[] | null {
  if (SISTEMAS_NO_POLARES.includes(nombre) && Math.abs(e.latitud) >= limitePolar(e.oblicuidad)) return null;
  switch (nombre) {
    case "placidus":
      return placidus(e, asc, mc);
    case "koch":
      return koch(e, asc, mc);
    case "regiomontano":
      return regiomontano(e, asc, mc);
    case "campano":
      return campano(e, asc, mc);
    case "porfirio":
      return porfirio(asc, mc);
    case "iguales":
      return iguales(asc);
    case "signos-enteros":
      return signosEnteros(asc);
  }
}

/**
 * Calcula Ascendente, Medio Cielo y cúspides. Dentro de los círculos polares
 * el Ascendente se toma siempre al este del meridiano (convención de Swiss
 * Ephemeris) y los sistemas de SISTEMAS_NO_POLARES se sustituyen por el de
 * respaldo. Swiss Ephemeris sí calcula Regiomontano y Campano ahí, pero
 * intercambiando MC e IC; aquí se evita esa convención a propósito.
 */
export function calcularCasas(e: EntradaCasas, pedido: SistemaCasas, respaldoPolar: SistemaRespaldoPolar): CasasCalculadas {
  const mc = medioCielo(e.armc, e.oblicuidad);
  let asc = ascendente(e.armc, e.latitud, e.oblicuidad);
  if (Math.abs(e.latitud) > limitePolar(e.oblicuidad) && diferencia(asc, mc) < 0) asc = normalizar(asc + 180);
  const cuspides = sistema(pedido, e, asc, mc);
  if (cuspides) return { cuspides, asc, mc, sistemaUsado: pedido, respaldo: false };
  return { cuspides: sistema(respaldoPolar, e, asc, mc)!, asc, mc, sistemaUsado: respaldoPolar, respaldo: true };
}

/** Casa (1–12) en la que cae una longitud, dadas las cúspides. */
export function casaDe(longitud: number, cuspides: number[]): number {
  for (let i = 0; i < 12; i++) {
    const inicio = cuspides[i];
    const fin = cuspides[(i + 1) % 12];
    const ancho = normalizar(fin - inicio);
    if (normalizar(longitud - inicio) < ancho) return i + 1;
  }
  return 12;
}
