import type { ConversionHora } from "./tipos";

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateador(zona: string): Intl.DateTimeFormat {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      era: "short",
    });
    formateadores.set(zona, f);
  }
  return f;
}

export function esZonaValida(zona: string): boolean {
  try {
    formateador(zona);
    return true;
  } catch {
    return false;
  }
}

/** Desfase local − UTC en segundos para un instante, según la tzdb del entorno. */
export function desfaseEn(zona: string, utcMs: number): number {
  const partes = formateador(zona).formatToParts(new Date(utcMs));
  const v: Record<string, number> = {};
  let antesDeCristo = false;
  for (const p of partes) {
    if (p.type === "era") antesDeCristo = p.value === "BC";
    else if (p.type !== "literal") v[p.type] = Number(p.value);
  }
  const anio = antesDeCristo ? 1 - v.year : v.year;
  const comoUtc = Date.UTC(anio, v.month - 1, v.day, v.hour, v.minute, v.second);
  const fecha = new Date(comoUtc);
  if (anio >= 0 && anio < 100) fecha.setUTCFullYear(anio);
  return Math.round((fecha.getTime() - Math.floor(utcMs / 1000) * 1000) / 1000);
}

export function textoDesfase(seg: number): string {
  const signo = seg < 0 ? "−" : "+";
  const abs = Math.abs(seg);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  return `UTC${signo}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}${s ? `:${String(s).padStart(2, "0")}` : ""}`;
}

/** Versión de la tzdb del entorno, si se puede conocer (Node la expone; los navegadores no). */
export function versionTzdb(): string {
  const p = (globalThis as { process?: { versions?: Record<string, string> } }).process;
  const tz = p?.versions?.tz;
  return tz ? `tzdb ${tz} (ICU de Node.js)` : "tzdb incluida en el navegador (versión no expuesta)";
}

export interface HoraLocal {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

/** Hora local escrita como si fuera UTC, en ms. */
export function comoUtcIngenuo(l: HoraLocal): number {
  const d = new Date(Date.UTC(2000, l.mes - 1, l.dia, l.hora, l.minuto, l.segundo));
  d.setUTCFullYear(l.anio);
  return d.getTime();
}

export interface Candidatos {
  estado: "unica" | "repetida" | "inexistente";
  /** Instantes UTC (ms) cuyo reloj local coincide, ordenados. */
  utcMs: number[];
  desfasesSeg: number[];
}

/**
 * Resuelve todos los instantes UTC cuyo reloj local en `zona` marca `l`.
 * Cero candidatos = hora inexistente (salto adelante); dos = hora repetida.
 */
export function candidatosUtc(zona: string, l: HoraLocal): Candidatos {
  const ingenuo = comoUtcIngenuo(l);
  const dia = 86_400_000;
  const desfases = new Set<number>();
  for (const delta of [-dia, -dia / 2, 0, dia / 2, dia]) desfases.add(desfaseEn(zona, ingenuo + delta));
  const encontrados = new Map<number, number>();
  for (const d of desfases) {
    const u = ingenuo - d * 1000;
    if (desfaseEn(zona, u) === d) encontrados.set(u, d);
  }
  const utcMs = [...encontrados.keys()].sort((a, b) => a - b);
  return {
    estado: utcMs.length === 0 ? "inexistente" : utcMs.length > 1 ? "repetida" : "unica",
    utcMs,
    desfasesSeg: utcMs.map((u) => encontrados.get(u)!),
  };
}

export function leerFecha(fecha: string): { anio: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(2000, mes - 1, dia));
  d.setUTCFullYear(anio);
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return { anio, mes, dia };
}

export function leerHora(hora: string): { hora: number; minuto: number; segundo: number } | null {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hora);
  if (!m) return null;
  const [h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (h > 23 || mi > 59 || s > 59) return null;
  return { hora: h, minuto: mi, segundo: s };
}

export function aIso(ms: number): string {
  return new Date(ms).toISOString().replace(".000Z", "Z");
}

export function construirConversion(
  zona: string,
  fuenteZona: string,
  candidatos: Candidatos,
  indice: number,
): ConversionHora {
  const desfaseSeg = candidatos.desfasesSeg[indice];
  return {
    zonaHoraria: zona,
    fuenteZona,
    estado: candidatos.estado,
    desfaseSeg,
    desfaseTexto: textoDesfase(desfaseSeg),
    utc: aIso(candidatos.utcMs[indice]),
    alternativasUtc: candidatos.utcMs.map(aIso),
    versionTzdb: versionTzdb(),
    esHoraMediaLocal: desfaseSeg % 900 !== 0,
  };
}
