import { casaDe } from "../casas";
import { motorAstronomyEngine } from "../efemerides";
import type { ResultadoCarta } from "../tipos";
import {
  ORBES_SINASTRIA_POR_DEFECTO,
  SIN_INTERPRETACION,
  aspectosEntre,
  avisosCarta,
  cuspidesDe,
  datosCarta,
  mezclarAspectos,
  muestrasNatales,
  reproducibilidad,
} from "./comun";
import type { AspectoCruzado, ErrorAvanzado, OpcionesSinastria, PuntoEnCasa, ResultadoSinastria } from "./tipos";

function enCasas(de: ResultadoCarta, en: ResultadoCarta): PuntoEnCasa[] | null {
  const c = cuspidesDe(en);
  if (!c) return null;
  return de.posiciones.map((p) => ({ clave: p.clave, longitud: p.longitud, casa: casaDe(p.longitud, c) }));
}

/**
 * Aspectos entre cada punto de A y cada punto de B (incluidos Asc y MC si
 * existen), con orbe e incertidumbre según los rangos de ambas cartas. Sin
 * fase: no hay movimiento entre dos cartas fijas. Además, en qué casa de B
 * cae cada punto de A y viceversa. Ambas cartas deben usar el mismo zodiaco
 * (y la misma ayanamsa si es sideral). Orbes por defecto: los natales del motor.
 */
export function sinastria(cartaA: ResultadoCarta, cartaB: ResultadoCarta, opciones: OpcionesSinastria = {}): ResultadoSinastria | ErrorAvanzado {
  const errores: string[] = [];
  if (cartaA.config.zodiaco !== cartaB.config.zodiaco) errores.push("Las dos cartas deben usar el mismo zodiaco (tropical o sideral).");
  else if (cartaA.config.zodiaco === "sideral" && cartaA.config.ayanamsa !== cartaB.config.ayanamsa)
    errores.push("Las dos cartas siderales deben usar la misma ayanamsa.");
  if (errores.length) return { ok: false, errores };

  const orbes = mezclarAspectos(ORBES_SINASTRIA_POR_DEFECTO, opciones.aspectos);
  const aspectos: AspectoCruzado[] = [];
  for (const a of cartaA.posiciones)
    for (const b of cartaB.posiciones)
      aspectos.push(
        ...aspectosEntre(
          { clave: a.clave, longitud: a.longitud, muestras: muestrasNatales(a) },
          { clave: b.clave, longitud: b.longitud, muestras: muestrasNatales(b) },
          orbes,
        ),
      );
  aspectos.sort((x, y) => x.orbe - y.orbe);

  const advertencias = [...avisosCarta(cartaA, motorAstronomyEngine).map((x) => `A: ${x}`), ...avisosCarta(cartaB, motorAstronomyEngine).map((x) => `B: ${x}`)];
  if (cartaA.config.nodo !== cartaB.config.nodo) advertencias.push("Las cartas usan tipos de nodo distintos (medio y verdadero).");
  if (cartaA.casas && cartaB.casas && cartaA.casas.sistemaUsado !== cartaB.casas.sistemaUsado)
    advertencias.push("Las cartas usan sistemas de casas distintos; cada punto se ubica con el sistema de la carta receptora.");

  return {
    ok: true,
    tipo: "sinastria",
    reproducibilidad: reproducibilidad(cartaA, motorAstronomyEngine, { aspectos: orbes }),
    reproducibilidadB: datosCarta(cartaB),
    aspectos,
    aEnCasasDeB: enCasas(cartaA, cartaB),
    bEnCasasDeA: enCasas(cartaB, cartaA),
    advertencias,
    interpretaciones: SIN_INTERPRETACION,
  };
}
