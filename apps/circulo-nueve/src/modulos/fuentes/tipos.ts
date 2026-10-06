/**
 * Biblioteca RAG de libros y webs autorizados (etapa posterior). Solo tipos:
 * no hay fuentes cargadas. Es una base de conocimiento distinta de la ayuda
 * de la app (`modulos/conversacion/asistente-ayuda`).
 */

export type EstadoFuente = "pendiente" | "procesando" | "requiere_revision" | "indexado" | "fallido" | "retirado";
export type GrupoFuente = "aportada" | "complementaria";

export interface Fuente {
  id: string;
  titulo: string;
  autor?: string;
  referencia: string;
  edicion?: string;
  fechaConsulta?: string;
  idioma: string;
  tradicion?: string;
  grupo: GrupoFuente;
  licencia: string;
  estado: EstadoFuente;
}

export interface Localizador {
  paginaImpresa?: string;
  paginaArchivo?: number;
  capitulo?: string;
  seccion?: string;
  url?: string;
  marcaTiempo?: string;
  /** Rango de líneas del Markdown derivado, p. ej. "12-30". */
  lineas?: string;
}

export interface FragmentoFuente {
  id: string;
  fuenteId: string;
  texto: string;
  localizador: Localizador;
  jerarquia: string[];
}

export const TRANSICIONES_FUENTE: Record<EstadoFuente, EstadoFuente[]> = {
  pendiente: ["procesando", "retirado"],
  procesando: ["requiere_revision", "fallido"],
  requiere_revision: ["indexado", "fallido", "retirado"],
  indexado: ["procesando", "retirado"],
  fallido: ["pendiente", "retirado"],
  retirado: [],
};

export function puedeTransicionar(desde: EstadoFuente, hacia: EstadoFuente): boolean {
  return TRANSICIONES_FUENTE[desde].includes(hacia);
}
