import type { LugarNacimiento } from "./tipos";

/** Fila compacta de public/datos/lugares-geonames.json (ver scripts/generar-lugares.mjs). */
export type FilaLugar = [
  geonameId: number,
  nombre: string,
  otrosNombres: string,
  region: string,
  pais: string,
  latitud: number,
  longitud: number,
  zonaHoraria: string,
  poblacion: number,
];

export interface CatalogoLugares {
  fuente: string;
  licencia: string;
  atribucion: string;
  descargado: string;
  cobertura: string;
  lugares: FilaLugar[];
}

export const RUTA_CATALOGO = "/datos/lugares-geonames.json";

export function normalizarBusqueda(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const nombresPais = (() => {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" });
  } catch {
    return null;
  }
})();

export function nombrePais(codigo: string): string {
  return nombresPais?.of(codigo) ?? codigo;
}

/**
 * Incertidumbre ± de las coordenadas de un punto de GeoNames: la ciudad se
 * representa con un solo punto, así que crece con el tamaño de la población.
 */
export function incertidumbrePorPoblacion(poblacion: number): number {
  if (poblacion >= 1_000_000) return 0.15;
  if (poblacion >= 100_000) return 0.08;
  return 0.03;
}

export function aLugarNacimiento(fila: FilaLugar, catalogo: Pick<CatalogoLugares, "atribucion">): LugarNacimiento {
  const [geonameId, nombre, , region, pais, latitud, longitud, zonaHoraria, poblacion] = fila;
  return {
    nombre: [nombre, region && region !== nombre ? region : "", nombrePais(pais)].filter(Boolean).join(", "),
    latitud,
    longitud,
    zonaHoraria,
    incertidumbreGrados: incertidumbrePorPoblacion(poblacion),
    fuente: { tipo: "geonames", geonameId, atribucion: catalogo.atribucion },
  };
}

/**
 * Busca por nombre de ciudad; tras una coma se puede añadir región o país
 * («Guadalajara, Jalisco», «Valencia, España»). Ordena por coincidencia y población.
 */
export function buscarLugares(catalogo: Pick<CatalogoLugares, "lugares">, consulta: string, limite = 8): FilaLugar[] {
  const [ciudad, ...resto] = consulta.split(",");
  const q = normalizarBusqueda(ciudad ?? "");
  if (q.length < 2) return [];
  const filtros = resto.map(normalizarBusqueda).filter(Boolean);
  const puntuados: { fila: FilaLugar; puntos: number }[] = [];
  for (const fila of catalogo.lugares) {
    const nombres = [normalizarBusqueda(fila[1]), ...(fila[2] ? fila[2].split("|") : [])];
    let puntos = 0;
    nombres.forEach((n, i) => {
      // El nombre principal pesa más que los alternos (otros idiomas, transliteraciones).
      const extra = i === 0 ? 0.5 : 0;
      if (n === q) puntos = Math.max(puntos, 3 + extra);
      else if (n.startsWith(q)) puntos = Math.max(puntos, 2 + extra);
      else if (q.length >= 4 && n.includes(q)) puntos = Math.max(puntos, 1);
    });
    if (!puntos) continue;
    if (filtros.length) {
      const contexto = normalizarBusqueda(`${fila[3]} ${fila[4]} ${nombrePais(fila[4])}`);
      if (!filtros.every((f) => contexto.includes(f))) continue;
    }
    puntuados.push({ fila, puntos });
  }
  return puntuados
    .sort((a, b) => b.puntos - a.puntos || b.fila[8] - a.fila[8])
    .slice(0, limite)
    .map((p) => p.fila);
}

/** Lugar con coordenadas escritas a mano; la zona IANA es obligatoria porque no se adivina. */
export function lugarManual(
  nombre: string,
  latitud: number,
  longitud: number,
  zonaHoraria: string,
  incertidumbreGrados = 0.01,
): LugarNacimiento {
  return {
    nombre: nombre.trim() || `${latitud.toFixed(4)}, ${longitud.toFixed(4)}`,
    latitud,
    longitud,
    zonaHoraria,
    incertidumbreGrados,
    fuente: { tipo: "manual", descripcion: "Coordenadas y zona horaria escritas por la persona" },
  };
}
