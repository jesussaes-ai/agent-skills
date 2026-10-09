import type { ClaveAyanamsa } from "./tipos";

/**
 * Valor de cada ayanamsa en J2000.0 (TT), sin nutación, tal como lo da
 * Swiss Ephemeris 2.10.03 (swe_get_ayanamsa_ex con SEFLG_NONUT).
 */
export const AYANAMSA_J2000: Record<ClaveAyanamsa, number> = {
  lahiri: 23.85709233,
  "fagan-bradley": 24.74029997,
  raman: 22.41079101,
  krishnamurti: 23.76024001,
};

/** Precesión general en longitud p_A (IAU 2006, Capitaine et al. 2003), en grados. */
export function precesionGeneral(T: number): number {
  return (5028.796195 * T + 1.1054348 * T ** 2 + 0.00007964 * T ** 3 - 0.000023857 * T ** 4 - 0.0000000383 * T ** 5) / 3600;
}

/** Ayanamsa media (sin nutación) para T siglos julianos TT desde J2000. */
export function ayanamsaMedia(clave: ClaveAyanamsa, T: number): number {
  return AYANAMSA_J2000[clave] + precesionGeneral(T);
}
