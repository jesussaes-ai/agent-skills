/**
 * Contratos de proveedores intercambiables (LLM, voz, embeddings).
 * Las llaves solo existen en el servidor; ninguno de estos tipos las contiene:
 * la configuración guarda el NOMBRE del secreto, nunca su valor.
 */

export interface PoliticaDatos {
  /** Solo true si el endpoint garantiza no entrenar ni retener datos personales y la administración lo aprobó. */
  permiteDatosReales: boolean;
  descripcion: string;
  /** null = desconocido (se trata como «sí»). */
  entrena?: boolean | null;
  retiene?: boolean | null;
  /** OpenRouter: pedir en cada solicitud solo endpoints sin retención (`provider.zdr`). */
  exigirZdr?: boolean;
  fuente?: string;
  verificadoEn?: string;
}

export interface CapacidadesLlm {
  json: boolean;
  herramientas: boolean;
  vision: boolean;
  audio: boolean;
}

export interface MensajeLlm {
  rol: "system" | "user" | "assistant";
  contenido: string;
}

export interface SolicitudLlm {
  mensajes: MensajeLlm[];
  respuestaJson?: boolean;
  maxTokens?: number;
  temperatura?: number;
}

export interface RespuestaLlm {
  texto: string;
  modelo: string;
  /** Nombre visible del proveedor que respondió (puede ser un respaldo). */
  proveedor?: string;
  tokensEntrada?: number;
  tokensSalida?: number;
  costoUsd?: number;
}

export interface LlmProvider {
  readonly id: string;
  readonly nombre: string;
  readonly modelo: string;
  readonly capacidades: CapacidadesLlm;
  readonly politicaDatos: PoliticaDatos;
  completar(solicitud: SolicitudLlm): Promise<RespuestaLlm>;
}

export const TIPOS_PROVEEDOR = ["openrouter", "freellmapi", "openai_compatible"] as const;
export type TipoProveedor = (typeof TIPOS_PROVEEDOR)[number];

export interface LimitesProveedor {
  solicitudesPorMinuto?: number;
  solicitudesPorDia?: number;
  limiteMensualUsd?: number;
  maxTokensSalida: number;
  tiempoMaximoMs: number;
  /** Reintentos por modelo ante 429/5xx antes de pasar al siguiente. */
  reintentos: number;
}

/** Precios en USD por millón de tokens; 0 en modelos gratuitos. */
export interface CostoProveedor {
  entradaUsdPorMillon: number;
  salidaUsdPorMillon: number;
}

/** Configuración de servidor de un proveedor LLM. */
export interface ConfigProveedor {
  id: string;
  tipo: TipoProveedor;
  nombre: string;
  endpoint: string;
  modelo: string;
  /** Modelos de respaldo del mismo proveedor, en orden. */
  modelosAlternos: string[];
  /** Nombre de la variable de entorno con la llave (p. ej. LLM_KEY_OPENROUTER). */
  secretoNombre?: string;
  /** Quién recibe los datos; se muestra al pedir consentimiento. */
  destinatarios: string;
  capacidades: CapacidadesLlm;
  politicaDatos: PoliticaDatos;
  limites: LimitesProveedor;
  costo: CostoProveedor;
  activo: boolean;
  prioridad: number;
  origen: "base-de-datos" | "entorno";
}

/** Lo que el navegador puede ver de un proveedor: sin secretos ni endpoint. */
export interface ProveedorPublico {
  id: string;
  tipo: TipoProveedor;
  nombre: string;
  modelo: string;
  modelosAlternos: string[];
  destinatarios: string;
  politicaDatos: Pick<PoliticaDatos, "permiteDatosReales" | "descripcion" | "entrena" | "retiene" | "exigirZdr">;
  capacidades: CapacidadesLlm;
  gratuito: boolean;
}

export type CodigoResultado =
  | "ok"
  | "limite_429"
  | "servidor"
  | "tiempo"
  | "red"
  | "autorizacion"
  | "credito"
  | "solicitud"
  | "respuesta_invalida"
  | "sin_llave"
  | "limite_local";

/** Registro de consumo. A propósito no tiene campos para el prompt ni la respuesta. */
export interface RegistroUso {
  proveedorId: string;
  modelo: string;
  usuarioId?: string | null;
  tokensEntrada?: number;
  tokensSalida?: number;
  costoEstimadoUsd?: number;
  codigoResultado: CodigoResultado;
  intento: number;
  latenciaMs: number;
  origen: "asistente-ayuda" | "prueba-admin" | "biblioteca";
}

export interface UsoActual {
  ultimoMinuto: number;
  hoy: number;
  gastoMesUsd: number;
}

export interface RegistroConsumo {
  registrar(registro: RegistroUso): Promise<void>;
  uso(proveedorId: string): Promise<UsoActual>;
}

export interface VozDisponible {
  id: string;
  nombre: string;
  idioma: string;
  /** false si el navegador indica que la voz usa un servicio remoto. */
  local: boolean;
}

/** Síntesis de voz intercambiable: hoy Web Speech API; mañana un proveedor de bajo costo. */
export interface TtsProvider {
  readonly id: string;
  readonly nombre: string;
  /** true si el texto sale del dispositivo (servicio remoto). */
  readonly remoto: boolean;
  disponible(): boolean;
  listarVoces(): Promise<VozDisponible[]>;
  hablar(texto: string, vozId?: string): Promise<void>;
  pausar(): void;
  reanudar(): void;
  detener(): void;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly modelo: string;
  readonly dimensiones: number;
  embeber(textos: string[]): Promise<number[][]>;
}
