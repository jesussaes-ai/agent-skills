import { diferencia, formatoMinuto, normalizar, signoDe } from "../angulos";
import { motorAstronomyEngine, type MotorEfemerides } from "../efemerides";
import type { ClaveCuerpo, ConfigAstrologia, ResultadoCarta } from "../tipos";
import {
  DIA_MS,
  ORBES_PROGRESION_POR_DEFECTO,
  SIN_INTERPRETACION,
  aIso,
  aspectosEntre,
  avisosCarta,
  casaEn,
  leerInstante,
  longitudEn,
  mezclarAspectos,
  muestrasNatales,
  reproducibilidad,
  utcNatal,
  velocidadEn,
} from "./comun";
import type { AspectoCruzado, ErrorAvanzado, InstanteUtc, OpcionesProgresion, ResultadoProgresion } from "./tipos";

/** Año trópico medio (días). «Un día de efeméride = un año trópico de vida». */
export const ANIO_TROPICO_DIAS = 365.2421897;

const esCuerpo = (clave: string): clave is ClaveCuerpo => clave !== "asc" && clave !== "mc";

interface Preparado {
  consulta: number;
  motor: MotorEfemerides;
  config: ConfigAstrologia;
  edadAnios: number;
  tProg: number;
  arco: number;
  velSol: number;
}

function preparar(cartaNatal: ResultadoCarta, fechaConsulta: InstanteUtc, opciones: OpcionesProgresion): Preparado | { error: string } {
  const consulta = leerInstante(fechaConsulta, "Fecha de consulta");
  if ("error" in consulta) return { error: consulta.error };
  const natalMs = utcNatal(cartaNatal);
  if (consulta.ms < natalMs) return { error: "La fecha de consulta no puede ser anterior al nacimiento." };
  if (!cartaNatal.posiciones.some((p) => p.clave === "sol")) return { error: "La carta natal no tiene la posición del Sol." };
  const motor = opciones.motor ?? motorAstronomyEngine;
  const config = cartaNatal.config;
  const edadDias = (consulta.ms - natalMs) / DIA_MS;
  const edadAnios = edadDias / ANIO_TROPICO_DIAS;
  const tProg = natalMs + edadAnios * DIA_MS;
  const solNatal = cartaNatal.posiciones.find((p) => p.clave === "sol")!.longitud;
  const solProg = longitudEn(motor, config, "sol", tProg);
  // El arco solar es positivo y crece ≈1°/año; diferencia() basta hasta ≈180 años.
  const arco = diferencia(solProg, solNatal);
  const velSol = velocidadEn(motor, config, "sol", tProg);
  return { consulta: consulta.ms, motor, config, edadAnios, tProg, arco, velSol };
}

function resultado(
  tipo: ResultadoProgresion["tipo"],
  cartaNatal: ResultadoCarta,
  p: Preparado,
  posiciones: ResultadoProgresion["posiciones"],
  muestras: Map<string, number[]>,
  orbes: ReturnType<typeof mezclarAspectos>,
  ajustes: Record<string, unknown>,
): ResultadoProgresion {
  const aspectos: AspectoCruzado[] = [];
  for (const q of posiciones)
    for (const n of cartaNatal.posiciones)
      aspectos.push(
        ...aspectosEntre(
          { clave: q.clave, longitud: q.longitud, muestras: muestras.get(q.clave) ?? [q.longitud], velocidad: q.velocidad },
          { clave: n.clave, longitud: n.longitud, muestras: muestrasNatales(n), velocidad: 0 },
          orbes,
        ),
      );
  aspectos.sort((a, b) => a.orbe - b.orbe);
  return {
    ok: true,
    tipo,
    reproducibilidad: reproducibilidad(cartaNatal, p.motor, { ...ajustes, aspectos: orbes, anioTropicoDias: ANIO_TROPICO_DIAS }),
    fechaConsulta: aIso(p.consulta),
    edadAnios: p.edadAnios,
    instanteProgresadoUtc: aIso(Math.round(p.tProg)),
    arcoSolar: p.arco,
    posiciones,
    aspectos,
    advertencias: avisosCarta(cartaNatal, p.motor),
    interpretaciones: SIN_INTERPRETACION,
  };
}

/**
 * Progresiones secundarias: posiciones de la efeméride en
 * nacimiento + (edad en años trópicos) días. Las velocidades quedan en grados
 * por día de efeméride = grados por año de vida. Asc y MC (si existen) se
 * progresan por arco solar en longitud (MC natal + arco solar, Asc natal + arco
 * solar); es una convención declarada, no la única posible. Aspectos
 * progresado → natal con ORBES_PROGRESION_POR_DEFECTO (1°).
 */
export function progresionesSecundarias(
  cartaNatal: ResultadoCarta,
  fechaConsulta: InstanteUtc,
  opciones: OpcionesProgresion = {},
): ResultadoProgresion | ErrorAvanzado {
  const p = preparar(cartaNatal, fechaConsulta, opciones);
  if ("error" in p) return { ok: false, errores: [p.error] };
  const orbes = mezclarAspectos(ORBES_PROGRESION_POR_DEFECTO, opciones.aspectos);
  const muestras = new Map<string, number[]>();
  const posiciones: ResultadoProgresion["posiciones"] = cartaNatal.posiciones.map((n) => {
    if (esCuerpo(n.clave)) {
      const longitud = longitudEn(p.motor, p.config, n.clave, p.tProg);
      const velocidad = velocidadEn(p.motor, p.config, n.clave, p.tProg);
      return {
        clave: n.clave,
        nombre: n.nombre,
        simbolo: n.simbolo,
        longitud,
        signo: signoDe(longitud),
        texto: formatoMinuto(longitud),
        velocidad,
        retrogrado: n.clave === "nodo" ? undefined : velocidad < 0,
        casaNatal: casaEn(cartaNatal, longitud),
        metodo: "efemeride" as const,
      };
    }
    const longitud = normalizar(n.longitud + p.arco);
    muestras.set(n.clave, muestrasNatales(n, p.arco));
    return {
      clave: n.clave,
      nombre: n.nombre,
      simbolo: n.simbolo,
      longitud,
      signo: signoDe(longitud),
      texto: formatoMinuto(longitud),
      velocidad: p.velSol,
      casaNatal: casaEn(cartaNatal, longitud),
      metodo: "arco-solar" as const,
    };
  });
  return resultado("progresiones-secundarias", cartaNatal, p, posiciones, muestras, orbes, {
    metodo: "un día de efeméride = un año trópico de vida",
    angulos: "Asc y MC por arco solar en longitud",
  });
}

/**
 * Direcciones por arco solar: todos los puntos natales (cuerpos, Asc, MC)
 * desplazados por el arco del Sol progresado (Sol progresado − Sol natal).
 * Todos se mueven al ritmo del Sol progresado. Aspectos dirigido → natal con
 * ORBES_PROGRESION_POR_DEFECTO (1°).
 */
export function arcoSolar(cartaNatal: ResultadoCarta, fechaConsulta: InstanteUtc, opciones: OpcionesProgresion = {}): ResultadoProgresion | ErrorAvanzado {
  const p = preparar(cartaNatal, fechaConsulta, opciones);
  if ("error" in p) return { ok: false, errores: [p.error] };
  const orbes = mezclarAspectos(ORBES_PROGRESION_POR_DEFECTO, opciones.aspectos);
  const muestras = new Map<string, number[]>();
  const posiciones: ResultadoProgresion["posiciones"] = cartaNatal.posiciones.map((n) => {
    const longitud = normalizar(n.longitud + p.arco);
    muestras.set(n.clave, muestrasNatales(n, p.arco));
    return {
      clave: n.clave,
      nombre: n.nombre,
      simbolo: n.simbolo,
      longitud,
      signo: signoDe(longitud),
      texto: formatoMinuto(longitud),
      velocidad: p.velSol,
      casaNatal: casaEn(cartaNatal, longitud),
      metodo: "arco-solar" as const,
    };
  });
  return resultado("arco-solar", cartaNatal, p, posiciones, muestras, orbes, {
    metodo: "arco solar en longitud (Sol progresado − Sol natal)",
  });
}
