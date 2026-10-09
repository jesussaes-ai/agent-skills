/**
 * Catálogo de zonas horarias IANA para el selector: todas las que conoce el
 * motor de JavaScript, agrupadas por región, con México primero y el desfase
 * UTC vigente en la fecha indicada.
 */

/** Zonas de México (tzdb), en el orden en que se muestran. */
export const ZONAS_MEXICO = [
  "America/Mexico_City",
  "America/Cancun",
  "America/Merida",
  "America/Monterrey",
  "America/Matamoros",
  "America/Chihuahua",
  "America/Ciudad_Juarez",
  "America/Ojinaga",
  "America/Mazatlan",
  "America/Bahia_Banderas",
  "America/Hermosillo",
  "America/Tijuana",
] as const;

/** Respaldo si el entorno no tiene Intl.supportedValuesOf. */
export const ZONAS_RESPALDO = [
  ...ZONAS_MEXICO,
  "America/Bogota", "America/Lima", "America/Santiago", "America/Argentina/Buenos_Aires", "America/Caracas",
  "America/Guatemala", "America/Costa_Rica", "America/Panama", "America/Havana", "America/Puerto_Rico",
  "America/Sao_Paulo", "America/Montevideo", "America/La_Paz", "America/Asuncion", "America/Guayaquil",
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles",
  "America/Anchorage", "America/Toronto", "America/Vancouver", "Pacific/Honolulu",
  "Europe/Madrid", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Lisbon", "Europe/Moscow",
  "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata",
  "Asia/Dubai", "Asia/Jerusalem", "Asia/Singapore", "Australia/Sydney", "Pacific/Auckland", "Atlantic/Canary", "UTC",
];

const REGIONES: Record<string, string> = {
  Africa: "África",
  America: "América",
  Antarctica: "Antártida",
  Arctic: "Ártico",
  Asia: "Asia",
  Atlantic: "Océano Atlántico",
  Australia: "Australia",
  Europe: "Europa",
  Indian: "Océano Índico",
  Pacific: "Océano Pacífico",
};

export interface Zona {
  id: string;
  /** Ciudad legible, p. ej. «Ciudad de México» o «Argentina / Buenos Aires». */
  ciudad: string;
  /** Desfase vigente, p. ej. «UTC−06:00». */
  desfase: string;
}

export interface GrupoZonas {
  region: string;
  zonas: Zona[];
}

const NOMBRES_MEXICO: Record<string, string> = {
  "America/Mexico_City": "Ciudad de México (centro)",
  "America/Cancun": "Cancún (Quintana Roo)",
  "America/Merida": "Mérida (Yucatán)",
  "America/Monterrey": "Monterrey (Nuevo León)",
  "America/Matamoros": "Matamoros (frontera de Tamaulipas)",
  "America/Chihuahua": "Chihuahua",
  "America/Ciudad_Juarez": "Ciudad Juárez",
  "America/Ojinaga": "Ojinaga",
  "America/Mazatlan": "Mazatlán (Sinaloa, Nayarit, BCS)",
  "America/Bahia_Banderas": "Bahía de Banderas (Nayarit)",
  "America/Hermosillo": "Hermosillo (Sonora)",
  "America/Tijuana": "Tijuana (Baja California)",
};

/** Nombres actuales de ciudades que ICU aún publica con su identificador antiguo. */
const NOMBRES_ACTUALES: Record<string, string> = {
  "Asia/Calcutta": "Kolkata (Calcuta)",
  "Asia/Saigon": "Ho Chi Minh (Saigón)",
  "Asia/Katmandu": "Katmandú",
  "Asia/Rangoon": "Yangon (Rangún)",
  "Europe/Kiev": "Kyiv (Kiev)",
  "America/Godthab": "Nuuk (Godthab)",
  "Atlantic/Faeroe": "Islas Feroe",
  "Pacific/Truk": "Chuuk (Truk)",
  "Pacific/Ponape": "Pohnpei (Ponape)",
  "Pacific/Enderbury": "Kanton (Enderbury)",
};

export function zonasDisponibles(): string[] {
  try {
    const lista = (Intl as { supportedValuesOf?: (clave: string) => string[] }).supportedValuesOf?.("timeZone");
    if (lista?.length) return lista.includes("UTC") ? lista : [...lista, "UTC"];
  } catch {
    // sigue con el respaldo
  }
  return [...ZONAS_RESPALDO];
}

/** Desfase de una zona en una fecha, con signo tipográfico: «UTC+05:30», «UTC−06:00», «UTC±00:00». */
export function desfaseUtc(zona: string, fecha: Date = new Date()): string {
  try {
    const parte = new Intl.DateTimeFormat("en-US", { timeZone: zona, timeZoneName: "longOffset" })
      .formatToParts(fecha)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(parte ?? "");
    if (!m || (m[2] === "00" && (m[3] ?? "00") === "00")) return "UTC±00:00";
    return `UTC${m[1] === "-" ? "−" : "+"}${m[2]}:${m[3] ?? "00"}`;
  } catch {
    return "";
  }
}

export function nombreCiudad(id: string): string {
  if (NOMBRES_MEXICO[id]) return NOMBRES_MEXICO[id];
  if (NOMBRES_ACTUALES[id]) return NOMBRES_ACTUALES[id];
  const partes = id.split("/");
  return (partes.length > 1 ? partes.slice(1) : partes).join(" / ").replaceAll("_", " ");
}

/** Texto para mostrar una zona elegida: «Ciudad de México (centro) · America/Mexico_City». */
export function etiquetaZona(id: string): string {
  const ciudad = nombreCiudad(id);
  return ciudad === id ? id : `${ciudad} · ${id}`;
}

/** Agrupa por región, con «México» primero y «Otras» (UTC, Etc/…) al final. */
export function agruparZonas(ids: string[] = zonasDisponibles(), fecha: Date = new Date()): GrupoZonas[] {
  const deMexico = new Set<string>(ZONAS_MEXICO);
  const zona = (id: string): Zona => ({ id, ciudad: nombreCiudad(id), desfase: desfaseUtc(id, fecha) });
  const grupos = new Map<string, Zona[]>();
  for (const id of ids) {
    if (deMexico.has(id)) continue;
    const region = REGIONES[id.split("/")[0]] ?? "Otras";
    grupos.set(region, [...(grupos.get(region) ?? []), zona(id)]);
  }
  const ordenadas = [...grupos.entries()]
    .filter(([region]) => region !== "Otras")
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([region, zonas]) => ({ region, zonas: zonas.sort((a, b) => a.ciudad.localeCompare(b.ciudad, "es")) }));
  const mexico = ZONAS_MEXICO.filter((id) => ids.includes(id)).map(zona);
  const otras = grupos.get("Otras");
  return [
    ...(mexico.length ? [{ region: "México", zonas: mexico }] : []),
    ...ordenadas,
    ...(otras ? [{ region: "Otras", zonas: otras.sort((a, b) => a.id.localeCompare(b.id)) }] : []),
  ];
}

const sinAcentos = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Filtra por ciudad, identificador, región o desfase («mexico», «madrid», «-06», «utc+1»). */
export function filtrarZonas(grupos: GrupoZonas[], consulta: string): GrupoZonas[] {
  const q = sinAcentos(consulta.trim()).replaceAll("−", "-").replaceAll(" ", "");
  if (!q) return grupos;
  return grupos
    .map((g) => ({
      region: g.region,
      zonas: g.zonas.filter((z) => {
        const texto = sinAcentos(`${g.region}${z.ciudad}${z.id}${z.desfase}`).replaceAll("−", "-").replaceAll(" ", "").replaceAll("_", "");
        return texto.includes(q.replaceAll("_", ""));
      }),
    }))
    .filter((g) => g.zonas.length);
}
