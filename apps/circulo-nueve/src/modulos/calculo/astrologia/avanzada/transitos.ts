import { diferencia, formatoMinuto, normalizar, signoDe } from "../angulos";
import { ASPECTOS, CUERPOS } from "../config";
import { motorAstronomyEngine, type MotorEfemerides } from "../efemerides";
import type { ClaveAspecto, ClaveCuerpo, ConfigAstrologia, ResultadoCarta } from "../tipos";
import {
  DIA_MS,
  ORBES_TRANSITO_POR_DEFECTO,
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
  velocidadEn,
} from "./comun";
import type {
  AspectoCruzado,
  ErrorAvanzado,
  EventoTransito,
  InstanteUtc,
  OpcionesCalendario,
  OpcionesTransitos,
  PlanetaCalendario,
  PosicionMovil,
  ResultadoCalendario,
  ResultadoTransitos,
} from "./tipos";

const nombreCuerpo = (clave: ClaveCuerpo, config: ConfigAstrologia) => {
  const c = CUERPOS.find((x) => x.clave === clave)!;
  return { nombre: clave === "nodo" ? `Nodo norte ${config.nodo}` : c.nombre, simbolo: c.simbolo };
};

/**
 * Posiciones de los cuerpos en tránsito en un instante UTC, casa natal en la
 * que cae cada uno (si la carta tiene casas) y aspectos tránsito → natal con
 * orbe y fase (aplicativo/separativo). Usa el zodiaco, la ayanamsa y el tipo
 * de nodo de la carta natal. Orbes por defecto: ORBES_TRANSITO_POR_DEFECTO
 * (2° conjunción/oposición/cuadratura/trígono, 1° sextil).
 */
export function calcularTransitos(
  cartaNatal: ResultadoCarta,
  fechaHoraUtc: InstanteUtc,
  opciones: OpcionesTransitos = {},
): ResultadoTransitos | ErrorAvanzado {
  const instante = leerInstante(fechaHoraUtc, "Fecha del tránsito");
  if ("error" in instante) return { ok: false, errores: [instante.error] };
  const t = instante.ms;
  const motor = opciones.motor ?? motorAstronomyEngine;
  const config = cartaNatal.config;
  const orbes = mezclarAspectos(ORBES_TRANSITO_POR_DEFECTO, opciones.aspectos);
  const cuerpos = opciones.cuerpos ?? CUERPOS.map((c) => c.clave);

  const posiciones: PosicionMovil[] = cuerpos.map((clave) => {
    const longitud = longitudEn(motor, config, clave, t);
    const velocidad = velocidadEn(motor, config, clave, t);
    return {
      clave,
      ...nombreCuerpo(clave, config),
      longitud,
      signo: signoDe(longitud),
      texto: formatoMinuto(longitud),
      velocidad,
      retrogrado: clave === "nodo" ? undefined : velocidad < 0,
      casaNatal: casaEn(cartaNatal, longitud),
    };
  });

  const aspectos: AspectoCruzado[] = [];
  for (const p of posiciones)
    for (const n of cartaNatal.posiciones)
      aspectos.push(
        ...aspectosEntre(
          { clave: p.clave, longitud: p.longitud, muestras: [p.longitud], velocidad: p.velocidad },
          { clave: n.clave, longitud: n.longitud, muestras: muestrasNatales(n), velocidad: 0 },
          orbes,
        ),
      );
  aspectos.sort((a, b) => a.orbe - b.orbe);

  return {
    ok: true,
    tipo: "transitos",
    reproducibilidad: reproducibilidad(cartaNatal, motor, { cuerpos, aspectos: orbes }),
    utc: aIso(t),
    posiciones,
    aspectos,
    advertencias: avisosCarta(cartaNatal, motor),
    interpretaciones: SIN_INTERPRETACION,
  };
}

// ── Calendario ───────────────────────────────────────────────────────────────

export const PLANETAS_LENTOS: PlanetaCalendario[] = ["jupiter", "saturno", "urano", "neptuno", "pluton"];
export const PLANETAS_RAPIDOS: PlanetaCalendario[] = ["sol", "mercurio", "venus", "marte"];
export const ASPECTOS_MAYORES: ClaveAspecto[] = (Object.keys(ASPECTOS) as ClaveAspecto[]).filter((k) => ASPECTOS[k].mayor);
/** Rango máximo del calendario: 2 años (731 días, para admitir un año bisiesto). */
export const RANGO_MAXIMO_DIAS = 731;
/** Paso de muestreo: 6 h para Sol, Mercurio, Venus y Marte; 1 día para el resto. */
export const PASO_MUESTREO_MS: Record<PlanetaCalendario, number> = {
  sol: DIA_MS / 4,
  mercurio: DIA_MS / 4,
  venus: DIA_MS / 4,
  marte: DIA_MS / 4,
  jupiter: DIA_MS,
  saturno: DIA_MS,
  urano: DIA_MS,
  neptuno: DIA_MS,
  pluton: DIA_MS,
  nodo: DIA_MS,
};
/** Dos exactitudes consecutivas pertenecen a la misma serie si entre ellas el planeta nunca se alejó más de esto del punto exacto. */
const ALEJAMIENTO_SERIE = 30;

/** Raíz de f en [a, b] por bisección, hasta un intervalo menor de 1 s. */
function biseccion(f: (t: number) => number, a: number, b: number): number {
  let fa = f(a);
  while (b - a > 1000) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fm === 0) return m;
    if (fa < 0 === fm < 0) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return (a + b) / 2;
}

/** Mínimo de g en [a, b] por sección áurea (para detectar contactos rozantes en una estación). */
function minimoAureo(g: (t: number) => number, a: number, b: number): number {
  const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a);
  let d = a + r * (b - a);
  let gc = g(c);
  let gd = g(d);
  while (b - a > 1000) {
    if (gc < gd) {
      b = d;
      d = c;
      gd = gc;
      c = b - r * (b - a);
      gc = g(c);
    } else {
      a = c;
      c = d;
      gc = gd;
      d = a + r * (b - a);
      gd = g(d);
    }
  }
  return (a + b) / 2;
}

const redondearMinuto = (ms: number) => Math.round(ms / 60_000) * 60_000;

/**
 * Fechas exactas (al minuto) en que un planeta en tránsito forma un aspecto
 * mayor exacto con un punto natal entre `desdeUtc` y `hastaUtc` (máx. 2 años).
 *
 * Método: se muestrea la diferencia con signo d(t) = longitud(t) − (natal ± ángulo)
 * cada 6 h (planetas rápidos) o 1 día (lentos); cada cambio de signo de d(t)
 * es una exactitud y se afina por bisección hasta < 1 s, y se publica redondeada
 * al minuto.
 *
 * Movimiento retrógrado: como se busca cada cambio de signo y no «la» fecha,
 * un planeta que pasa por encima del punto, retrocede y vuelve a pasar genera
 * una exactitud por cada cruce (típicamente 1 o 3; más si hay varios bucles).
 * Cada evento indica si el planeta iba directo o retrógrado, y `pasada`/`totalPasadas`
 * dentro de su serie (cruces consecutivos del mismo objetivo sin que el planeta
 * se aleje más de 30° entre ellos). Si una estación cae casi encima del punto,
 * se comprueba además el mínimo de |d(t)| entre muestras para no perder dos
 * cruces muy próximos; un contacto que se queda a unas décimas sin cruzar no
 * es exacto y no se lista. Las pasadas que caen fuera del rango no se cuentan.
 */
export function calendarioTransitos(
  cartaNatal: ResultadoCarta,
  desdeUtc: InstanteUtc,
  hastaUtc: InstanteUtc,
  opciones: OpcionesCalendario = {},
): ResultadoCalendario | ErrorAvanzado {
  const desde = leerInstante(desdeUtc, "Inicio del rango");
  const hasta = leerInstante(hastaUtc, "Fin del rango");
  const errores: string[] = [];
  if ("error" in desde) errores.push(desde.error);
  if ("error" in hasta) errores.push(hasta.error);
  if ("ms" in desde && "ms" in hasta) {
    if (hasta.ms <= desde.ms) errores.push("El fin del rango debe ser posterior al inicio.");
    else if (hasta.ms - desde.ms > RANGO_MAXIMO_DIAS * DIA_MS) errores.push(`El rango no puede superar 2 años (${RANGO_MAXIMO_DIAS} días).`);
  }
  const planetas = opciones.planetas ?? (opciones.incluirRapidos ? [...PLANETAS_RAPIDOS, ...PLANETAS_LENTOS] : PLANETAS_LENTOS);
  if (planetas.some((p) => (p as string) === "luna")) errores.push("La Luna no se admite en el calendario de tránsitos.");
  if (errores.length || !("ms" in desde) || !("ms" in hasta)) return { ok: false, errores };

  const motor: MotorEfemerides = opciones.motor ?? motorAstronomyEngine;
  const config = cartaNatal.config;
  const aspectos = opciones.aspectos ?? ASPECTOS_MAYORES;
  const natales = cartaNatal.posiciones.filter((p) => !opciones.puntosNatales || opciones.puntosNatales.includes(p.clave));

  const eventos: EventoTransito[] = [];
  for (const planeta of planetas) {
    const paso = PASO_MUESTREO_MS[planeta];
    const tiempos: number[] = [];
    for (let t = desde.ms; t < hasta.ms; t += paso) tiempos.push(t);
    tiempos.push(hasta.ms);
    const lon = (t: number) => longitudEn(motor, config, planeta, t);
    const lons = tiempos.map(lon);

    for (const n of natales) {
      for (const clave of aspectos) {
        const angulo = ASPECTOS[clave].angulo;
        const objetivos = [...new Set([normalizar(n.longitud + angulo), normalizar(n.longitud - angulo)].map((x) => x.toFixed(9)))].map(Number);
        for (const objetivo of objetivos) {
          const f = (t: number) => diferencia(lon(t), objetivo);
          const ds = lons.map((l) => diferencia(l, objetivo));
          const raices: number[] = [];
          for (let i = 0; i + 1 < ds.length; i++) {
            const a = ds[i];
            const b = ds[i + 1];
            const cruza = ((a < 0 && b >= 0) || (a > 0 && b <= 0)) && Math.abs(a - b) < 90;
            if (cruza) raices.push(biseccion(f, tiempos[i], tiempos[i + 1]));
            else if (i > 0 && Math.abs(a) < 1 && Math.abs(a) <= Math.abs(ds[i - 1]) && Math.abs(a) <= Math.abs(b) && ds[i - 1] < 0 === a < 0 && a < 0 === b < 0 && a !== 0) {
              // Posible doble cruce entre muestras cerca de una estación.
              const s = a < 0 ? -1 : 1;
              const tm = minimoAureo((t) => s * f(t), tiempos[i - 1], tiempos[i + 1]);
              if (s * f(tm) < 0) raices.push(biseccion(f, tiempos[i - 1], tm), biseccion(f, tm, tiempos[i + 1]));
            }
          }
          const unicas = [...new Set(raices.map(redondearMinuto))].sort((x, y) => x - y);
          // Series de pasadas.
          const series: number[][] = [];
          for (const r of unicas) {
            const ultima = series[series.length - 1];
            const previa = ultima?.[ultima.length - 1];
            const misma =
              previa !== undefined &&
              ds.every((d, k) => tiempos[k] < previa || tiempos[k] > r || Math.abs(d) <= ALEJAMIENTO_SERIE);
            if (misma) ultima.push(r);
            else series.push([r]);
          }
          for (const serie of series)
            serie.forEach((r, k) => {
              const lt = lon(r);
              eventos.push({
                utc: aIso(r),
                instanteMs: r,
                transito: planeta,
                natal: n.clave,
                aspecto: clave,
                nombre: ASPECTOS[clave].nombre,
                angulo,
                longitudObjetivo: objetivo,
                longitudTransito: lt,
                longitudNatal: n.longitud,
                orbe: Math.abs(diferencia(lt, objetivo)),
                movimiento: velocidadEn(motor, config, planeta, r) < 0 ? "retrogrado" : "directo",
                pasada: k + 1,
                totalPasadas: serie.length,
                precisionNatal: n.precision,
              });
            });
        }
      }
    }
  }
  eventos.sort((a, b) => a.instanteMs - b.instanteMs || a.transito.localeCompare(b.transito) || a.natal.localeCompare(b.natal));

  const advertencias = avisosCarta(cartaNatal, motor);
  if (natales.some((n) => n.precision === "rango"))
    advertencias.push("Algunos puntos natales tienen un rango amplio: sus fechas exactas dependen de la hora de nacimiento y se marcan con precisionNatal = «rango».");
  return {
    ok: true,
    tipo: "calendario-transitos",
    reproducibilidad: reproducibilidad(cartaNatal, motor, {
      planetas,
      aspectos,
      puntosNatales: natales.map((n) => n.clave),
      pasoMuestreoMs: Object.fromEntries(planetas.map((p) => [p, PASO_MUESTREO_MS[p]])),
      toleranciaBiseccionMs: 1000,
      redondeo: "minuto",
      rangoMaximoDias: RANGO_MAXIMO_DIAS,
    }),
    desde: aIso(desde.ms),
    hasta: aIso(hasta.ms),
    eventos,
    advertencias,
    interpretaciones: SIN_INTERPRETACION,
  };
}
