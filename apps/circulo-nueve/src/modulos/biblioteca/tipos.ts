import type { GrupoFuente, Localizador } from "@/modulos/fuentes/tipos";

/** Un tramo del documento con su referencia precisa (página, capítulo, sección, URL…). */
export interface Segmento {
  texto: string;
  localizador: Localizador;
  jerarquia: string[];
  ocrConfianza?: number;
}

export interface DocumentoExtraido {
  markdown: string;
  segmentos: Segmento[];
  metodo: string;
  advertencias: string[];
  metadatos?: {
    titulo?: string;
    autor?: string;
    fechaPublicacion?: string;
    urlCanonica?: string;
    idioma?: string;
  };
}

export interface Fragmento {
  orden: number;
  texto: string;
  localizador: Localizador;
  jerarquia: string[];
  ocrConfianza?: number;
  sospechoso: boolean;
  motivoSospecha?: string;
}

/** Fragmento recuperado por la búsqueda híbrida, con su fuente. */
export interface FragmentoRecuperado {
  chunkId: string;
  fuenteId: string;
  titulo: string;
  autor: string | null;
  referencia: string;
  edicion: string | null;
  fechaConsulta: string | null;
  grupo: GrupoFuente;
  esDemo: boolean;
  texto: string;
  localizador: Localizador;
  jerarquia: string[];
  sospechoso: boolean;
  ocrConfianza: number | null;
  puntaje: number;
}

export type TipoCita = "textual" | "parafrasis" | "sintesis";

export interface AfirmacionValidada {
  texto: string;
  /** null = sin respaldo: se muestra como «interpretación general (IA)». */
  tipoCita: TipoCita | null;
  chunkIds: string[];
  avisos: string[];
}

export interface ProporcionAfirmaciones {
  /** Peso de afirmaciones atribuido a fuentes aportadas (puede ser fraccional). */
  aportadas: number;
  complementarias: number;
  citadas: number;
  sinRespaldo: number;
  /** 0–1; null si no hay afirmaciones citadas. */
  proporcion: number | null;
  objetivo: number;
  cumple: boolean | null;
}
