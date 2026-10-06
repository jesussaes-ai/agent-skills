import * as Astronomy from "astronomy-engine";
import { atan2, normalizar } from "./angulos";
import { EFEMERIDES } from "./config";
import type { ClaveCuerpo, TipoNodo } from "./tipos";

/**
 * Interfaz del motor de efemérides. Permite sustituir astronomy-engine por
 * otro motor (p. ej. Swiss Ephemeris) sin tocar casas, aspectos ni la UI.
 * Todas las longitudes son geocéntricas aparentes, referidas al equinoccio y
 * la eclíptica verdaderos de la fecha (como el modo por defecto de Swiss Ephemeris).
 */
export interface MotorEfemerides {
  nombre: string;
  /** Longitud eclíptica tropical (grados) en el instante UTC dado (ms). */
  longitud(cuerpo: ClaveCuerpo, utcMs: number, nodo: TipoNodo): number;
  /** Ascensión recta del meridiano local = tiempo sidéreo aparente local en grados. */
  armc(utcMs: number, longitudGeografica: number): number;
  /** Oblicuidad verdadera de la eclíptica (grados). */
  oblicuidad(utcMs: number): number;
  /** Nutación en longitud (grados). */
  nutacionLongitud(utcMs: number): number;
  /** Siglos julianos TT desde J2000.0. */
  siglosTT(utcMs: number): number;
}

const CUERPO_AE: Partial<Record<ClaveCuerpo, Astronomy.Body>> = {
  mercurio: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  marte: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturno: Astronomy.Body.Saturn,
  urano: Astronomy.Body.Uranus,
  neptuno: Astronomy.Body.Neptune,
  pluton: Astronomy.Body.Pluto,
};

function tiempo(utcMs: number): Astronomy.AstroTime {
  return Astronomy.MakeTime(new Date(utcMs));
}

/**
 * Nodo medio de la Luna (Meeus, Astronomical Algorithms, 2.ª ed., ec. 47.7),
 * pasado al equinoccio verdadero sumando la nutación en longitud.
 */
function nodoMedio(t: Astronomy.AstroTime): number {
  const T = t.tt / 36525;
  const medio = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441 - (T * T * T * T) / 60616000;
  return normalizar(medio + Astronomy.e_tilt(t).dpsi / 3600);
}

/** Nodo verdadero (osculador): intersección del plano orbital instantáneo de la Luna con la eclíptica de la fecha. */
function nodoVerdadero(t: Astronomy.AstroTime): number {
  const estado = Astronomy.RotateState(Astronomy.Rotation_EQJ_ECT(t), Astronomy.GeoMoonState(t));
  const hx = estado.y * estado.vz - estado.z * estado.vy;
  const hy = estado.z * estado.vx - estado.x * estado.vz;
  return normalizar(atan2(hx, -hy));
}

export const motorAstronomyEngine: MotorEfemerides = {
  nombre: EFEMERIDES,
  longitud(cuerpo, utcMs, nodo) {
    const t = tiempo(utcMs);
    if (cuerpo === "sol") return Astronomy.SunPosition(t).elon;
    if (cuerpo === "luna") return Astronomy.EclipticGeoMoon(t).lon;
    if (cuerpo === "nodo") return nodo === "medio" ? nodoMedio(t) : nodoVerdadero(t);
    return Astronomy.Ecliptic(Astronomy.GeoVector(CUERPO_AE[cuerpo]!, t, true)).elon;
  },
  armc(utcMs, longitudGeografica) {
    return normalizar(Astronomy.SiderealTime(tiempo(utcMs)) * 15 + longitudGeografica);
  },
  oblicuidad(utcMs) {
    return Astronomy.e_tilt(tiempo(utcMs)).tobl;
  },
  nutacionLongitud(utcMs) {
    return Astronomy.e_tilt(tiempo(utcMs)).dpsi / 3600;
  },
  siglosTT(utcMs) {
    return tiempo(utcMs).tt / 36525;
  },
};
