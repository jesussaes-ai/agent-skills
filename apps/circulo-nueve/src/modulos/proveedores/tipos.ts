/**
 * Contratos de proveedores intercambiables. Las implementaciones reales (OpenRouter,
 * FreeLLMAPI, Ollama, TTS remoto, efemérides) se añaden en etapas posteriores.
 * Las llaves solo existen en el servidor; estas interfaces nunca las exponen.
 */

export interface PoliticaDatos {
  /** Solo true si el endpoint garantiza no entrenar ni retener datos personales. */
  permiteDatosReales: boolean;
  descripcion: string;
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
  tokensEntrada?: number;
  tokensSalida?: number;
}

export interface LlmProvider {
  readonly id: string;
  readonly nombre: string;
  readonly modelo: string;
  readonly capacidades: CapacidadesLlm;
  readonly politicaDatos: PoliticaDatos;
  completar(solicitud: SolicitudLlm): Promise<RespuestaLlm>;
}

export interface VozDisponible {
  id: string;
  nombre: string;
  idioma: string;
  /** false si el navegador indica que la voz usa un servicio remoto. */
  local: boolean;
}

export interface TtsProvider {
  readonly id: string;
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
