import type { CambioNormalizacion, ConfigNumerologia, Paso } from "../tipos";

/** Metadatos comunes a todos los resultados del módulo avanzado. */
export interface MetadatosAvanzada {
  motor: string;
  motorVersion: string;
  tradicion: string;
  reglasVersion: string;
  reglas: ConfigNumerologia;
}

export type ClaveAvanzada =
  | "anioPersonal"
  | "mesPersonal"
  | "diaPersonal"
  | "pinaculo"
  | "desafio"
  | "cicloDeVida"
  | "madurez"
  | "diaDeNacimiento"
  | "actitud";

/** Un número calculado con sus pasos visibles. No incluye interpretaciones. */
export interface IndicadorAvanzado {
  clave: ClaveAvanzada;
  nombre: string;
  /** Cómo se calcula (no qué significa). */
  descripcion: string;
  valor: number;
  esMaestro: boolean;
  pasos: Paso[];
}

/** Periodo de la vida expresado en edades. `edadFin` es la edad en la que empieza el siguiente; `null` = hasta el final. */
export interface Periodo {
  numero: number;
  edadInicio: number;
  edadFin: number | null;
  anioInicio: number;
  anioFin: number | null;
}

export type IndicadorConPeriodo = IndicadorAvanzado & Periodo;

/* ---------- 1. Ciclo personal ---------- */

export type InicioAnioPersonal = "calendario" | "cumpleanos";

export interface OpcionesCicloPersonal {
  /**
   * "calendario" (por defecto): el año personal cambia el 1 de enero.
   * "cumpleanos": cambia el día del cumpleaños; antes del cumpleaños se usa el año anterior.
   */
  inicioAnio?: InicioAnioPersonal;
}

export interface ResultadoCicloPersonal extends MetadatosAvanzada {
  ok: true;
  opciones: Required<OpcionesCicloPersonal>;
  entradas: { fechaNacimiento: string; fechaConsulta: string; anioUsado: number };
  advertencias: string[];
  anioPersonal: IndicadorAvanzado;
  mesPersonal: IndicadorAvanzado;
  diaPersonal: IndicadorAvanzado;
}

/* ---------- 2 y 3. Pináculos, desafíos y ciclos de vida ---------- */

export interface ResultadoPinaculosYDesafios extends MetadatosAvanzada {
  ok: true;
  entradas: { fechaNacimiento: string };
  /** Camino de vida tal como lo da el motor base y su reducción a un dígito (usada para las edades). */
  caminoDeVida: { valor: number; unDigito: number; pasos: Paso[] };
  /** Día, mes y año reducidos a un dígito (sin maestros). */
  componentes: { dia: number; mes: number; anio: number; pasos: Paso[] };
  pinaculos: IndicadorConPeriodo[];
  desafios: IndicadorConPeriodo[];
}

export type EdadesCiclosDeVida = "pinaculos" | "fijas-28";

export interface OpcionesCiclosDeVida {
  /**
   * "pinaculos" (por defecto): ciclo 1 hasta 36 − camino de vida (un dígito),
   * ciclo 2 dura 27 años, ciclo 3 hasta el final.
   * "fijas-28": 0–28, 28–56, 56 en adelante.
   */
  edades?: EdadesCiclosDeVida;
}

export interface ResultadoCiclosDeVida extends MetadatosAvanzada {
  ok: true;
  opciones: Required<OpcionesCiclosDeVida>;
  entradas: { fechaNacimiento: string };
  ciclos: IndicadorConPeriodo[];
}

/* ---------- 4. Números adicionales ---------- */

export interface ConteoInclusion {
  numero: number;
  cantidad: number;
  letras: string[];
}

export interface ResultadoNumerosAdicionales extends MetadatosAvanzada {
  ok: true;
  entradas: { nombreOriginal: string; nombreNormalizado: string; fecha: string };
  cambios: CambioNormalizacion[];
  advertencias: string[];
  madurez: IndicadorAvanzado;
  diaDeNacimiento: IndicadorAvanzado;
  actitud: IndicadorAvanzado;
  /** Tabla de inclusión (plano de expresión): cuántas letras del nombre valen cada número del 1 al 9. */
  tablaDeInclusion: { conteos: ConteoInclusion[]; totalLetras: number; pasos: Paso[] };
  /** Números del 1 al 9 que no aparecen en el nombre (lecciones kármicas / números kármicos ausentes). */
  karmicosAusentes: { numeros: number[]; pasos: Paso[] };
}

/* ---------- 5. Compatibilidad ---------- */

export type ClaveComparada = "caminoDeVida" | "expresion" | "alma" | "personalidad";
export type EtiquetaCompatibilidad = "misma-vibracion" | "complementarios" | "distintos";

export interface ConvencionCompatibilidad {
  /** Si es true (por defecto), 11→2, 22→4 y 33→6 antes de comparar. */
  reducirMaestrosAlComparar: boolean;
  /** Diferencia mínima y máxima (inclusive) para «complementarios». Por defecto 1 y 2. */
  complementariosMin: number;
  complementariosMax: number;
}

export interface PersonaCompatibilidad {
  nombre?: string;
  fecha?: string;
}

export interface ParComparado {
  clave: ClaveComparada;
  nombre: string;
  /** Valor tal como lo da el motor base (puede ser maestro); null si faltan datos. */
  a: number | null;
  b: number | null;
  /** Valores usados en la comparación (según la convención). */
  comparadoA: number | null;
  comparadoB: number | null;
  diferencia: number | null;
  etiqueta: EtiquetaCompatibilidad | null;
  etiquetaTexto: string | null;
  pasos: Paso[];
}

export interface ResultadoCompatibilidad extends MetadatosAvanzada {
  ok: true;
  convencion: ConvencionCompatibilidad;
  advertencias: string[];
  pares: ParComparado[];
}
