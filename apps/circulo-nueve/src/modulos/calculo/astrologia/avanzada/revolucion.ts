import { diferencia, separacion } from "../angulos";
import { motorAstronomyEngine, type MotorEfemerides } from "../efemerides";
import { ANIO_MAXIMO, ANIO_MINIMO, calcularCartaNatal } from "../motor";
import { aIso, candidatosUtc, desfaseEn, esZonaValida } from "../tiempo";
import type { LugarNacimiento, ResultadoCarta } from "../tipos";
import { DIA_MS, SIN_INTERPRETACION, avisosCarta, longitudEn, reproducibilidad, utcNatal, velocidadEn } from "./comun";
import type { ErrorAvanzado, ResultadoRevolucionSolar } from "./tipos";

const dos = (n: number) => String(n).padStart(2, "0");

/**
 * Instante exacto (UTC, al segundo) en que el Sol vuelve a su longitud natal
 * —en el zodiaco de la carta (tropical o sideral)— y carta levantada para ese
 * instante con `calcularCartaNatal`.
 *
 * Convenciones:
 * - Se toma el retorno más próximo al aniversario UTC del nacimiento en `anio`
 *   (puede caer el 31 dic o el 1 ene del año vecino si se nació en esas fechas; se avisa).
 * - Se resuelve por Newton sobre la longitud del Sol hasta |Δt| < 1 ms y se redondea al segundo
 *   (el Sol recorre ≈0,04″ por segundo).
 * - Lugar: el indicado; si no, el natal. Sin zona en el lugar indicado se usa UTC
 *   (la zona solo cambia cómo se escribe la hora local, no las posiciones ni las casas).
 * - La carta se calcula con la misma configuración que la natal y margen de hora 0.
 */
export function revolucionSolar(
  cartaNatal: ResultadoCarta,
  anio: number,
  lugarOpcional?: LugarNacimiento,
  motor: MotorEfemerides = motorAstronomyEngine,
): ResultadoRevolucionSolar | ErrorAvanzado {
  const natalMs = utcNatal(cartaNatal);
  const nacimiento = new Date(natalMs);
  const errores: string[] = [];
  if (!Number.isInteger(anio) || anio < ANIO_MINIMO || anio > ANIO_MAXIMO) errores.push(`El año debe ser un entero entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}.`);
  else if (anio < nacimiento.getUTCFullYear()) errores.push("El año de la revolución solar no puede ser anterior al nacimiento.");
  const sol = cartaNatal.posiciones.find((p) => p.clave === "sol");
  if (!sol) errores.push("La carta natal no tiene la posición del Sol.");
  const lugar = lugarOpcional ?? cartaNatal.entradas.lugar;
  const zona = lugarOpcional ? (lugarOpcional.zonaHoraria ?? "UTC") : cartaNatal.tiempo.zonaHoraria;
  if (!esZonaValida(zona)) errores.push(`La zona horaria «${zona}» no existe en la base IANA de este entorno.`);
  if (errores.length || !sol) return { ok: false, errores };

  const config = cartaNatal.config;
  const objetivo = sol.longitud;
  const inicio = new Date(natalMs);
  inicio.setUTCFullYear(anio);
  let t = inicio.getTime();
  for (let i = 0; i < 30; i++) {
    const dt = (-diferencia(longitudEn(motor, config, "sol", t), objetivo) / velocidadEn(motor, config, "sol", t)) * DIA_MS;
    t += dt;
    if (Math.abs(dt) < 1) break;
  }
  const tSeg = Math.round(t / 1000) * 1000;

  // Hora local en la zona elegida para reutilizar el cálculo de carta del motor.
  const local = new Date(tSeg + desfaseEn(zona, tSeg) * 1000);
  const anioLocal = local.getUTCFullYear();
  const fecha = `${String(anioLocal).padStart(4, "0")}-${dos(local.getUTCMonth() + 1)}-${dos(local.getUTCDate())}`;
  const hora = `${dos(local.getUTCHours())}:${dos(local.getUTCMinutes())}:${dos(local.getUTCSeconds())}`;
  const candidatos = candidatosUtc(zona, {
    anio: anioLocal,
    mes: local.getUTCMonth() + 1,
    dia: local.getUTCDate(),
    hora: local.getUTCHours(),
    minuto: local.getUTCMinutes(),
    segundo: local.getUTCSeconds(),
  });
  const indice = candidatos.utcMs.indexOf(tSeg);
  const carta = calcularCartaNatal(
    {
      fecha,
      hora,
      precisionHora: "exacta",
      lugar,
      zonaHoraria: lugar?.zonaHoraria === zona ? undefined : zona,
      ocurrencia: candidatos.estado === "repetida" ? (indice === 1 ? "segunda" : "primera") : undefined,
    },
    { ...config, margenExactaMin: 0 },
    motor,
  );
  if (!carta.ok) return { ok: false, errores: carta.errores };

  const solRs = carta.posiciones.find((p) => p.clave === "sol")!;
  const advertencias = avisosCarta(cartaNatal, motor);
  if (new Date(tSeg).getUTCFullYear() !== anio)
    advertencias.push(`El retorno más próximo al aniversario cae en ${new Date(tSeg).getUTCFullYear()} (UTC), por nacer cerca del cambio de año.`);
  if (cartaNatal.entradas.precisionHora === "desconocida")
    advertencias.push("Con la hora de nacimiento desconocida, el Sol natal tiene ±0,5° de incertidumbre y el instante de la revolución, ±12 h.");
  else if (cartaNatal.entradas.precisionHora === "aproximada")
    advertencias.push(`Con la hora aproximada (±${cartaNatal.entradas.margenMinutos} min), el instante de la revolución tiene esa misma incertidumbre.`);
  if (!lugar) advertencias.push("Sin lugar: la carta de la revolución no tiene casas, Ascendente ni Medio Cielo.");

  return {
    ok: true,
    tipo: "revolucion-solar",
    reproducibilidad: reproducibilidad(cartaNatal, motor, {
      anio,
      metodo: "Newton sobre la longitud del Sol, |Δt| < 1 ms, redondeo al segundo",
      lugar: lugarOpcional ? "indicado" : lugar ? "natal" : "ninguno",
      zonaHoraria: zona,
      margenExactaMin: 0,
    }),
    anio,
    instanteUtc: aIso(tSeg),
    longitudSolNatal: objetivo,
    longitudSolRevolucion: solRs.longitud,
    diferenciaArcosegundos: separacion(solRs.longitud, objetivo) * 3600,
    lugar: { origen: lugarOpcional ? "indicado" : lugar ? "natal" : "ninguno", nombre: lugar?.nombre, zonaHoraria: zona },
    carta,
    advertencias: [...advertencias, ...carta.advertencias.map((a) => `Carta de la revolución: ${a}`)],
    interpretaciones: SIN_INTERPRETACION,
  };
}
