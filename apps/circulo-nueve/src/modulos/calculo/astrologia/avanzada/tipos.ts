import type { MotorEfemerides } from "../efemerides";
import type {
  ClasePrecision,
  ClaveAspecto,
  ClaveCuerpo,
  ClavePunto,
  ConfigAspecto,
  ConfigAstrologia,
  ResultadoCarta,
} from "../tipos";

/** Instante en UTC: ms desde 1970, `Date` o texto ISO 8601 con `Z` o desfase explícito. */
export type InstanteUtc = string | number | Date;

/** Datos para reproducir cualquier cálculo avanzado (igual que en la carta natal). */
export interface Reproducibilidad {
  motor: string;
  motorVersion: string;
  efemerides: string;
  /** Reglas de la carta natal del motor. */
  reglasVersion: string;
  modulo: string;
  moduloVersion: string;
  reglasAvanzadasVersion: string;
  /** Configuración astrológica heredada de la carta natal (zodiaco, ayanamsa, nodo, casas). */
  config: ConfigAstrologia;
  /** Ajustes propios del cálculo avanzado ya resueltos (orbes, cuerpos, etc.). */
  ajustes: Record<string, unknown>;
  /** Carta natal de partida. */
  cartaNatal: { utc: string; motorVersion: string; reglasVersion: string; efemerides: string };
}

export interface ErrorAvanzado {
  ok: false;
  errores: string[];
}

/** Aspecto entre un punto de un conjunto (origen) y uno de otro (destino). */
export interface AspectoCruzado {
  origen: ClavePunto;
  destino: ClavePunto;
  aspecto: ClaveAspecto;
  nombre: string;
  angulo: number;
  /** Orbe en grados con los valores de referencia. */
  orbe: number;
  orbeMaximo: number;
  /** El aspecto podría entrar o salir del orbe dentro de los márgenes de los datos natales. */
  incierto: boolean;
  /** Solo cuando hay movimiento (tránsitos, progresiones, arco solar). */
  fase?: "aplicativo" | "separativo";
}

export interface PosicionMovil {
  clave: ClavePunto;
  nombre: string;
  simbolo: string;
  /** Longitud eclíptica [0, 360) en el zodiaco de la carta natal. */
  longitud: number;
  signo: string;
  /** «15°20′ Cáncer». */
  texto: string;
  /** Grados/día (en progresiones: grados por año de vida). Negativo = retrógrado. */
  velocidad?: number;
  retrogrado?: boolean;
  /** Casa natal en la que cae, si la carta natal tiene casas. */
  casaNatal?: number;
}

interface BaseResultado {
  ok: true;
  reproducibilidad: Reproducibilidad;
  advertencias: string[];
  interpretaciones: { estado: "pendiente"; motivo: string };
}

// ── 1. Tránsitos ─────────────────────────────────────────────────────────────

export interface OpcionesTransitos {
  /** Cuerpos en tránsito. Por defecto, los 11 del motor (Sol a Plutón y nodo). */
  cuerpos?: ClaveCuerpo[];
  /** Orbes de tránsito; se mezclan por clave con ORBES_TRANSITO_POR_DEFECTO. */
  aspectos?: ConfigAspecto[];
  motor?: MotorEfemerides;
}

export interface ResultadoTransitos extends BaseResultado {
  tipo: "transitos";
  utc: string;
  posiciones: PosicionMovil[];
  /** origen = cuerpo en tránsito, destino = punto natal. */
  aspectos: AspectoCruzado[];
}

// ── 2. Calendario de tránsitos exactos ───────────────────────────────────────

/** La Luna no se admite (se mueve demasiado rápido para un calendario de 2 años). */
export type PlanetaCalendario = Exclude<ClaveCuerpo, "luna">;

export interface OpcionesCalendario {
  /** Por defecto Júpiter, Saturno, Urano, Neptuno y Plutón. */
  planetas?: PlanetaCalendario[];
  /** Atajo: añade Sol, Mercurio, Venus y Marte a los planetas por defecto. */
  incluirRapidos?: boolean;
  /** Aspectos buscados. Por defecto los 5 mayores. */
  aspectos?: ClaveAspecto[];
  /** Puntos natales. Por defecto todos los de la carta (incluidos Asc y MC si existen). */
  puntosNatales?: ClavePunto[];
  motor?: MotorEfemerides;
}

export interface EventoTransito {
  /** Instante exacto redondeado al minuto (ISO 8601, UTC). */
  utc: string;
  instanteMs: number;
  transito: PlanetaCalendario;
  natal: ClavePunto;
  aspecto: ClaveAspecto;
  nombre: string;
  angulo: number;
  /** Longitud exacta buscada (natal ± ángulo). */
  longitudObjetivo: number;
  longitudTransito: number;
  longitudNatal: number;
  /** Orbe en el minuto publicado (grados). */
  orbe: number;
  movimiento: "directo" | "retrogrado";
  /** Número de pasada dentro de la serie (1, 2, 3…) y total de pasadas de la serie dentro del rango. */
  pasada: number;
  totalPasadas: number;
  /** Precisión del punto natal: con "rango" la fecha exacta depende de datos inciertos. */
  precisionNatal: ClasePrecision;
}

export interface ResultadoCalendario extends BaseResultado {
  tipo: "calendario-transitos";
  desde: string;
  hasta: string;
  eventos: EventoTransito[];
}

// ── 3. Sinastría ─────────────────────────────────────────────────────────────

export interface OpcionesSinastria {
  /** Se mezclan por clave con ORBES_SINASTRIA_POR_DEFECTO. */
  aspectos?: ConfigAspecto[];
}

export interface PuntoEnCasa {
  clave: ClavePunto;
  longitud: number;
  casa: number;
}

export interface ResultadoSinastria extends BaseResultado {
  tipo: "sinastria";
  /** origen = punto de A, destino = punto de B. */
  aspectos: AspectoCruzado[];
  /** Puntos de A en las casas de B (null si B no tiene casas). */
  aEnCasasDeB: PuntoEnCasa[] | null;
  /** Puntos de B en las casas de A (null si A no tiene casas). */
  bEnCasasDeA: PuntoEnCasa[] | null;
  reproducibilidadB: Reproducibilidad["cartaNatal"];
}

// ── 4. Revolución solar ──────────────────────────────────────────────────────

export interface ResultadoRevolucionSolar extends BaseResultado {
  tipo: "revolucion-solar";
  anio: number;
  /** Instante exacto del retorno, al segundo (ISO 8601, UTC). */
  instanteUtc: string;
  longitudSolNatal: number;
  longitudSolRevolucion: number;
  /** |Sol en la revolución − Sol natal| en segundos de arco. */
  diferenciaArcosegundos: number;
  lugar: { origen: "natal" | "indicado" | "ninguno"; nombre?: string; zonaHoraria: string };
  /** Carta levantada con el motor existente para ese instante y lugar. */
  carta: ResultadoCarta;
}

// ── 5. Progresiones secundarias y arco solar ─────────────────────────────────

export interface OpcionesProgresion {
  /** Se mezclan por clave con ORBES_PROGRESION_POR_DEFECTO. */
  aspectos?: ConfigAspecto[];
  motor?: MotorEfemerides;
}

export interface ResultadoProgresion extends BaseResultado {
  tipo: "progresiones-secundarias" | "arco-solar";
  fechaConsulta: string;
  /** Años trópicos transcurridos desde el nacimiento. */
  edadAnios: number;
  /** Instante de la efeméride que corresponde a la fecha de consulta (nacimiento + edad en días). */
  instanteProgresadoUtc: string;
  /** Sol progresado − Sol natal, en grados. */
  arcoSolar: number;
  posiciones: (PosicionMovil & { metodo: "efemeride" | "arco-solar" })[];
  /** origen = punto progresado/dirigido, destino = punto natal. */
  aspectos: AspectoCruzado[];
}

