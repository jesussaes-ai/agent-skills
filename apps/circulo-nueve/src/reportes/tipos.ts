import type { GrupoFuente, Localizador } from "@/modulos/fuentes/tipos";

export type TipoReporte = "numerologia" | "carta-natal" | "cabala" | "tarot" | "lectura-integral";

/** Origen de cada bloque de interpretación; se imprime siempre como etiqueta visible. */
export type OrigenInterpretacion = "tradicional" | "ia";

export interface DatoAutorizado {
  etiqueta: string;
  valor: string;
  /** Nota de precisión, p. ej. "hora aproximada" o "zona horaria resuelta con…". */
  nota?: string;
}

export interface PasoCalculo {
  descripcion: string;
  operacion: string;
}

export interface Calculo {
  titulo: string;
  valor: string;
  subtitulo?: string;
  destacado?: string;
  pasos: PasoCalculo[];
}

export interface Cita {
  fuenteId: string;
  localizador: Localizador;
  tipo: "textual" | "parafrasis" | "sintesis";
}

export interface Interpretacion {
  titulo: string;
  origen: OrigenInterpretacion;
  parrafos: string[];
  citas: Cita[];
  /** Para origen "ia": proveedor y modelo que generaron el texto. */
  generadoPor?: string;
  preguntas?: string[];
}

export interface FuenteCitada {
  id: string;
  titulo: string;
  autor?: string;
  referencia: string;
  edicion?: string;
  fechaConsulta?: string;
  grupo: GrupoFuente;
}

/** Campos del aviso de privacidad. Los llena el propietario; nunca se inventan. */
export interface AvisoPrivacidad {
  responsable?: string;
  finalidades?: string;
  datosTratados?: string;
  conservacion?: string;
  derechos?: string;
  contacto?: string;
}

export interface Pensamiento {
  id: string;
  texto: string;
  /** "Círculo Nueve" para textos propios; autor verificado para citas de dominio público. */
  autor: string;
  obra?: string;
  /** Referencia localizable de la cita (obra, capítulo, verso…). */
  referencia?: string;
  /** Presente cuando el texto es traducción hecha para Círculo Nueve. */
  traduccion?: string;
  original?: string;
  origen: "original" | "dominio-publico";
}

export interface DatosReporte {
  tipo: TipoReporte;
  titulo: string;
  subtitulo?: string;
  /** Nombre que la persona autorizó mostrar en portada. */
  nombrePersona: string;
  folio: string;
  /** Fecha de elaboración en formato AAAA-MM-DD. */
  fechaElaboracion: string;
  demostracion: boolean;
  tradicion: string;
  versionReglas?: string;
  datosAutorizados: DatoAutorizado[];
  calculos: Calculo[];
  interpretaciones: Interpretacion[];
  limites: string[];
  fuentes: FuenteCitada[];
  /** Proporción objetivo de fuentes aportadas (0–1). Por defecto 0.8. */
  objetivoAportadas?: number;
  avisoPrivacidad: AvisoPrivacidad;
  /** Si se omite se usa el pensamiento recomendado del tipo de reporte. */
  pensamientoId?: string;
  descripcion?: string;
}
