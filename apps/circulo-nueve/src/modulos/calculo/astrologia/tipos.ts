export type PrecisionHora = "exacta" | "aproximada" | "desconocida";
export type Zodiaco = "tropical" | "sideral";
export type ClaveAyanamsa = "lahiri" | "fagan-bradley" | "raman" | "krishnamurti";
export type SistemaCasas = "placidus" | "koch" | "regiomontano" | "campano" | "porfirio" | "iguales" | "signos-enteros";
export type SistemaRespaldoPolar = "porfirio" | "iguales" | "signos-enteros";
export type TipoNodo = "medio" | "verdadero";
export type ClaveCuerpo =
  | "sol"
  | "luna"
  | "mercurio"
  | "venus"
  | "marte"
  | "jupiter"
  | "saturno"
  | "urano"
  | "neptuno"
  | "pluton"
  | "nodo";
export type ClavePunto = ClaveCuerpo | "asc" | "mc";
export type ClaveAspecto =
  | "conjuncion"
  | "oposicion"
  | "trigono"
  | "cuadratura"
  | "sextil"
  | "semisextil"
  | "quincuncio"
  | "semicuadratura"
  | "sesquicuadratura";

export interface ConfigAspecto {
  clave: ClaveAspecto;
  activo: boolean;
  /** Orbe máximo en grados. */
  orbe: number;
}

export interface ConfigAstrologia {
  zodiaco: Zodiaco;
  /** Solo se usa con zodiaco sideral. */
  ayanamsa: ClaveAyanamsa;
  sistemaCasas: SistemaCasas;
  /** Sistema que sustituye a Placidus/Koch cuando no están definidos (latitudes polares). */
  respaldoPolar: SistemaRespaldoPolar;
  nodo: TipoNodo;
  aspectos: ConfigAspecto[];
  /** Margen ± en minutos que se asume para una hora "exacta" (redondeo del registro). */
  margenExactaMin: number;
  /** Margen ± en minutos para una hora "aproximada". */
  margenAproximadaMin: number;
}

export type FuenteLugar =
  | { tipo: "geonames"; geonameId: number; atribucion: string }
  | { tipo: "manual"; descripcion: string };

export interface LugarNacimiento {
  /** Nombre legible tal como se mostrará (p. ej. «Guadalajara, Jalisco, México»). */
  nombre: string;
  latitud: number;
  longitud: number;
  /** Zona IANA asociada al lugar por la fuente, si la hay. */
  zonaHoraria?: string;
  /** Incertidumbre ± de las coordenadas, en grados. */
  incertidumbreGrados: number;
  fuente: FuenteLugar;
}

export interface EntradaCarta {
  /** AAAA-MM-DD, calendario gregoriano, fecha local del lugar. */
  fecha: string;
  /** HH:MM o HH:MM:SS local. Obligatoria salvo con precisión "desconocida". */
  hora?: string;
  precisionHora: PrecisionHora;
  lugar?: LugarNacimiento;
  /** Zona IANA indicada por la persona; tiene prioridad sobre la del lugar. */
  zonaHoraria?: string;
  /** Si la hora local se repite (fin del horario de verano), cuál de las dos usar. */
  ocurrencia?: "primera" | "segunda";
}

export interface Paso {
  descripcion: string;
  valor: string;
}

export interface ConversionHora {
  zonaHoraria: string;
  fuenteZona: string;
  estado: "unica" | "repetida" | "inexistente";
  /** Desfase respecto a UTC usado, en segundos (local = UTC + desfase). */
  desfaseSeg: number;
  desfaseTexto: string;
  /** Instante UTC (ISO 8601) de referencia. */
  utc: string;
  /** Instantes UTC posibles si la hora local se repite. */
  alternativasUtc: string[];
  versionTzdb: string;
  esHoraMediaLocal: boolean;
}

export type ClasePrecision = "minuto" | "grado" | "rango";

export interface Rango {
  desde: number;
  hasta: number;
}

export interface PosicionCalculada {
  clave: ClavePunto;
  nombre: string;
  simbolo: string;
  /** Longitud eclíptica en grados [0, 360), sin redondear (valor interno). */
  longitud: number;
  signo: string;
  /** Texto con la precisión que permiten los datos. */
  texto: string;
  precision: ClasePrecision;
  /** Intervalo de longitudes posibles dados los márgenes de hora y lugar. */
  rango: Rango;
  signosPosibles: string[];
  /** Grados/día; negativo = retrógrado. Solo cuerpos. */
  velocidad?: number;
  retrogrado?: boolean;
  retrogradoIncierto?: boolean;
  /** Casa con la hora de referencia, si hay casas. */
  casa?: number;
  casasPosibles?: number[];
}

export interface CuspideCasa {
  casa: number;
  longitud: number;
  signo: string;
  texto: string;
  precision: ClasePrecision;
  rango: Rango;
}

export interface ResultadoCasas {
  sistemaSolicitado: SistemaCasas;
  sistemaUsado: SistemaCasas;
  cuspides: CuspideCasa[];
}

export interface AspectoCalculado {
  a: ClavePunto;
  b: ClavePunto;
  aspecto: ClaveAspecto;
  nombre: string;
  angulo: number;
  /** Orbe con la hora de referencia, en grados. */
  orbe: number;
  orbeMaximo: number;
  /** El aspecto podría salir o entrar del orbe dentro de los márgenes de los datos. */
  incierto: boolean;
  fase?: "aplicativo" | "separativo";
}

export interface ResultadoCarta {
  ok: true;
  motor: string;
  motorVersion: string;
  efemerides: string;
  reglasVersion: string;
  config: ConfigAstrologia;
  entradas: {
    fecha: string;
    hora?: string;
    precisionHora: PrecisionHora;
    margenMinutos: number;
    lugar?: LugarNacimiento;
  };
  tiempo: ConversionHora;
  ayanamsaGrados?: number;
  /** Posiciones calculadas: datos, no interpretaciones. */
  posiciones: PosicionCalculada[];
  casas: ResultadoCasas | null;
  aspectos: AspectoCalculado[];
  pasos: Paso[];
  advertencias: string[];
  /** Las interpretaciones viven aparte y requieren fuentes citadas. */
  interpretaciones: { estado: "pendiente"; motivo: string };
}

export interface ErrorCarta {
  ok: false;
  errores: string[];
  /** Si la hora local se repite, opciones para que la persona elija. */
  opcionesHoraRepetida?: { ocurrencia: "primera" | "segunda"; utc: string; desfaseTexto: string }[];
}
