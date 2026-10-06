import { SIGNOS } from "./config";
import type { ClasePrecision, Rango } from "./tipos";

export const RAD = Math.PI / 180;

export const sen = (g: number) => Math.sin(g * RAD);
export const cos = (g: number) => Math.cos(g * RAD);
export const tan = (g: number) => Math.tan(g * RAD);
export const asen = (x: number) => Math.asin(x) / RAD;
export const atan = (x: number) => Math.atan(x) / RAD;
export const atan2 = (y: number, x: number) => Math.atan2(y, x) / RAD;

export function normalizar(g: number): number {
  const r = g % 360;
  return r < 0 ? r + 360 : r;
}

/** Diferencia a − b en (−180, 180]. */
export function diferencia(a: number, b: number): number {
  const d = normalizar(a - b);
  return d > 180 ? d - 360 : d;
}

/** Separación angular mínima en [0, 180]. */
export function separacion(a: number, b: number): number {
  return Math.abs(diferencia(a, b));
}

export function indiceSigno(longitud: number): number {
  return Math.floor(normalizar(longitud) / 30) % 12;
}

export function signoDe(longitud: number): string {
  return SIGNOS[indiceSigno(longitud)];
}

/** Rango que cubre todas las muestras, desenrollado alrededor de `centro`. */
export function rangoDe(centro: number, muestras: number[], margen = 0): Rango {
  let min = 0;
  let max = 0;
  for (const m of muestras) {
    const d = diferencia(m, centro);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { desde: normalizar(centro + min - margen), hasta: normalizar(centro + max + margen) };
}

export function anchoRango(r: Rango): number {
  return normalizar(r.hasta - r.desde);
}

export function signosEnRango(r: Rango): string[] {
  const signos: string[] = [];
  const ancho = anchoRango(r);
  const inicio = indiceSigno(r.desde);
  const pasos = Math.floor((normalizar(r.desde) % 30 + ancho) / 30);
  for (let i = 0; i <= pasos && signos.length < 12; i++) signos.push(SIGNOS[(inicio + i) % 12]);
  return signos;
}

export function clasePrecision(r: Rango): ClasePrecision {
  const ancho = anchoRango(r);
  if (ancho <= 2 / 60) return "minuto";
  if (ancho <= 2) return "grado";
  return "rango";
}

/** «15°20′ Cáncer». Redondea al minuto sin desbordar al signo siguiente. */
export function formatoMinuto(longitud: number): string {
  const totalMin = Math.round(normalizar(longitud) * 60) % (360 * 60);
  const signo = Math.floor(totalMin / 1800);
  const enSigno = totalMin - signo * 1800;
  const g = Math.floor(enSigno / 60);
  const m = enSigno % 60;
  return `${g}°${String(m).padStart(2, "0")}′ ${SIGNOS[signo]}`;
}

/** «≈15° Cáncer». Trunca al grado del signo. */
export function formatoGrado(longitud: number): string {
  const l = normalizar(longitud);
  return `≈${Math.floor(l % 30)}° ${signoDe(l)}`;
}

/** Mayor distancia entre `longitud` y los extremos del rango. */
function semiancho(longitud: number, r: Rango): number {
  return Math.max(Math.abs(diferencia(longitud, r.desde)), Math.abs(diferencia(r.hasta, longitud)));
}

export function formatoSegunPrecision(longitud: number, r: Rango): { texto: string; precision: ClasePrecision } {
  const precision = clasePrecision(r);
  if (precision === "minuto") return { texto: formatoMinuto(longitud), precision };
  if (precision === "grado") {
    const mitad = semiancho(longitud, r);
    return mitad < 0.5
      ? { texto: `${formatoMinuto(longitud)} (±${Math.ceil(mitad * 60)}′)`, precision }
      : { texto: `${formatoGrado(longitud)} (±${Math.ceil(mitad)}°)`, precision };
  }
  return {
    texto: `entre ${Math.floor(r.desde % 30)}° ${signoDe(r.desde)} y ${Math.floor(r.hasta % 30)}° ${signoDe(r.hasta)}`,
    precision,
  };
}
