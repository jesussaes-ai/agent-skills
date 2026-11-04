/**
 * Consulta integral: con los datos ya confirmados por la persona calcula todo junto
 * (numerología, ciclo personal, pináculos y desafíos, cábala y carta natal) para una sola carta final.
 * Solo cálculos con pasos visibles; las interpretaciones salen de la biblioteca aparte.
 */
import { calcularCartaNatal, type LugarNacimiento, type PrecisionHora, type ResultadoCarta } from "@/modulos/calculo/astrologia";
import { calcularCabala, type ResultadoCabala } from "@/modulos/calculo/cabala";
import { calcularNumerologia, type ResultadoNumerologia } from "@/modulos/calculo/numerologia";
import {
  cicloPersonal,
  pinaculosYDesafios,
  type ResultadoCicloPersonal,
  type ResultadoPinaculosYDesafios,
} from "@/modulos/calculo/numerologia/avanzada";

export interface EntradaConsulta {
  /** Nombre completo de nacimiento. */
  nombre: string;
  /** Cómo quiere que se le llame en la carta. */
  nombrePreferido?: string;
  /** AAAA-MM-DD. */
  fecha: string;
  hora?: string;
  precisionHora: PrecisionHora;
  lugar?: LugarNacimiento;
  zonaHoraria?: string;
  /** Nombre en letras hebreas, APROBADO por la persona. Sin él no se calcula la cábala. */
  hebreo?: string;
  /** Fecha local de la consulta (AAAA-MM-DD), para el año, mes y día personal. */
  fechaConsulta: string;
}

export interface ResultadoConsulta {
  ok: true;
  entrada: EntradaConsulta;
  numerologia: ResultadoNumerologia;
  ciclo?: ResultadoCicloPersonal;
  pinaculos?: ResultadoPinaculosYDesafios;
  cabala?: ResultadoCabala;
  carta?: ResultadoCarta;
  /** Partes que no se pudieron calcular y por qué (la consulta sigue con lo demás). */
  omitidos: string[];
}

export function calcularConsulta(e: EntradaConsulta): ResultadoConsulta | { ok: false; errores: string[] } {
  const numerologia = calcularNumerologia({ nombre: e.nombre, fecha: e.fecha });
  if (!numerologia.ok) return { ok: false, errores: numerologia.errores };
  const omitidos: string[] = [];

  const ciclo = cicloPersonal(e.fecha, e.fechaConsulta);
  if (!ciclo.ok) omitidos.push(`Ciclo personal: ${ciclo.errores.join(" ")}`);
  const pinaculos = pinaculosYDesafios(e.fecha);
  if (!pinaculos.ok) omitidos.push(`Pináculos y desafíos: ${pinaculos.errores.join(" ")}`);

  let cabala: ResultadoCabala | undefined;
  if (e.hebreo?.trim()) {
    const numeros = numerologia.indicadores.map((i) => ({ origen: i.nombre, valor: i.valor }));
    const r = calcularCabala({ hebreo: e.hebreo, numeros });
    if (r.ok) cabala = r;
    else omitidos.push(`Cábala: ${r.errores.join(" ")}`);
  } else {
    omitidos.push("Cábala: falta aprobar cómo se escribe el nombre en letras hebreas.");
  }

  let carta: ResultadoCarta | undefined;
  if (e.lugar) {
    const r = calcularCartaNatal({
      fecha: e.fecha,
      hora: e.precisionHora === "desconocida" ? undefined : e.hora,
      precisionHora: e.precisionHora,
      lugar: e.lugar,
      zonaHoraria: e.zonaHoraria,
    });
    if (r.ok) carta = r;
    else omitidos.push(`Carta natal: ${r.errores.join(" ")}`);
  } else {
    omitidos.push("Carta natal: falta el lugar de nacimiento.");
  }

  return {
    ok: true,
    entrada: e,
    numerologia,
    ciclo: ciclo.ok ? ciclo : undefined,
    pinaculos: pinaculos.ok ? pinaculos : undefined,
    cabala,
    carta,
    omitidos,
  };
}

/** Subtítulo de la portada según lo que de verdad incluye la carta. */
export function subtituloCarta(cabala: boolean, carta: boolean): string {
  const partes = ["Numerología", cabala ? "cábala" : null, carta ? "carta natal" : null].filter((p): p is string => p !== null);
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}` : partes[0];
  return `${lista} en una sola lectura`;
}

/** Fecha AAAA-MM-DD en la zona horaria indicada (la carta lleva la fecha local, no la UTC). */
export function fechaLocal(zona: string | undefined, ahora: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zona || "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
  }
}
