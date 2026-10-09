import type { CapacidadesLlm, CostoProveedor, LimitesProveedor, PoliticaDatos, TipoProveedor } from "./tipos";

/**
 * Plantillas de proveedor y modelos sugeridos. Los datos de OpenRouter salen de
 * su API pública y su documentación el 6 oct 2026 (ver FUENTES_OPENROUTER); los
 * modelos gratuitos cambian a menudo, así que la administración puede escribir
 * cualquier otro id de modelo. Nada aquí se usa sin que la administración lo guarde.
 */

export const FECHA_VERIFICACION = "2026-10-06";

export const FUENTES_OPENROUTER = {
  modelos: "https://openrouter.ai/api/v1/models",
  gratuitos: "https://openrouter.ai/models?pricing=free",
  politicas: "https://openrouter.ai/docs/guides/privacy/provider-logging",
  zdr: "https://openrouter.ai/docs/guides/features/zdr",
  limites: "https://openrouter.ai/docs/api_reference/limits",
} as const;

/** Límites de OpenRouter para variantes `:free` según su documentación de límites. */
export const LIMITES_GRATUITOS_OPENROUTER = {
  solicitudesPorMinuto: 20,
  solicitudesPorDiaSinCreditos: 50,
  solicitudesPorDiaConCreditos: 1000,
  creditosUmbralUsd: 10,
} as const;

export interface ModeloCatalogo {
  id: string;
  nombre: string;
  familia: "NVIDIA" | "Qwen" | "DeepSeek" | "Router";
  gratuito: boolean;
  contexto: number;
  capacidades: CapacidadesLlm;
  costo: CostoProveedor;
  politica: PoliticaDatos;
  nota: string;
}

export interface PlantillaProveedor {
  tipo: TipoProveedor;
  nombre: string;
  endpoint: string;
  secretoSugerido: string;
  /** Si la llave es obligatoria para este tipo. */
  requiereLlave: boolean;
  destinatarios: string;
  descripcion: string;
  limites: LimitesProveedor;
  modelos: ModeloCatalogo[];
}

const SIN_COSTO: CostoProveedor = { entradaUsdPorMillon: 0, salidaUsdPorMillon: 0 };
const TEXTO_HERRAMIENTAS: CapacidadesLlm = { json: false, herramientas: true, vision: false, audio: false };

const POLITICA_NVIDIA_GRATIS: PoliticaDatos = {
  permiteDatosReales: false,
  entrena: true,
  retiene: true,
  descripcion:
    "Endpoint gratuito servido por NVIDIA. Según OpenRouter, NVIDIA puede entrenar con los prompts y los retiene. Solo para demo y contenido no personal.",
  fuente: FUENTES_OPENROUTER.politicas,
  verificadoEn: FECHA_VERIFICACION,
};

export const MODELOS_OPENROUTER: ModeloCatalogo[] = [
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    nombre: "NVIDIA Nemotron 3 Super 120B (gratis)",
    familia: "NVIDIA",
    gratuito: true,
    contexto: 262144,
    capacidades: { json: true, herramientas: true, vision: false, audio: false },
    costo: SIN_COSTO,
    politica: POLITICA_NVIDIA_GRATIS,
    nota: "Admite respuesta en JSON; es el sugerido para el asistente de ayuda en modo demo.",
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    nombre: "NVIDIA Nemotron 3 Ultra 550B (gratis)",
    familia: "NVIDIA",
    gratuito: true,
    contexto: 1000000,
    capacidades: TEXTO_HERRAMIENTAS,
    costo: SIN_COSTO,
    politica: POLITICA_NVIDIA_GRATIS,
    nota: "No anuncia salida JSON estructurada; útil como respaldo.",
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    nombre: "NVIDIA Nemotron 3.5 Lightning (gratis)",
    familia: "NVIDIA",
    gratuito: true,
    contexto: 1000000,
    capacidades: TEXTO_HERRAMIENTAS,
    costo: SIN_COSTO,
    politica: POLITICA_NVIDIA_GRATIS,
    nota: "No anuncia salida JSON estructurada; útil como respaldo.",
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    nombre: "NVIDIA Nemotron 3 Nano Omni 30B (gratis)",
    familia: "NVIDIA",
    gratuito: true,
    contexto: 256000,
    capacidades: { json: false, herramientas: true, vision: true, audio: true },
    costo: SIN_COSTO,
    politica: POLITICA_NVIDIA_GRATIS,
    nota: "Acepta imagen, audio y video. El 6 oct 2026 OpenRouter lo reportaba con estado degradado.",
  },
  {
    id: "qwen/qwen3.7-flash",
    nombre: "Qwen 3.7 Flash (de pago, bajo costo)",
    familia: "Qwen",
    gratuito: false,
    contexto: 1000000,
    capacidades: { json: true, herramientas: true, vision: true, audio: false },
    costo: { entradaUsdPorMillon: 0.03, salidaUsdPorMillon: 0.13 },
    politica: {
      permiteDatosReales: false,
      entrena: false,
      retiene: true,
      descripcion:
        "El 6 oct 2026 no había variante gratuita de Qwen en OpenRouter. Este modelo lo sirve solo Alibaba Cloud, que no entrena pero retiene los prompts. Solo demo.",
      fuente: FUENTES_OPENROUTER.politicas,
      verificadoEn: FECHA_VERIFICACION,
    },
    nota: "Sin variante gratuita de Qwen a la fecha de verificación.",
  },
  {
    id: "deepseek/deepseek-v4-flash",
    nombre: "DeepSeek V4 Flash (de pago, bajo costo)",
    familia: "DeepSeek",
    gratuito: false,
    contexto: 1048576,
    capacidades: { json: true, herramientas: true, vision: false, audio: false },
    costo: { entradaUsdPorMillon: 0.21, salidaUsdPorMillon: 1.41 },
    politica: {
      permiteDatosReales: false,
      entrena: false,
      retiene: false,
      exigirZdr: true,
      descripcion:
        "El 6 oct 2026 no había variante gratuita de DeepSeek. Con «exigir retención cero» OpenRouter solo enruta a endpoints que no entrenan ni retienen (DeepInfra, Venice, Azure, entre otros). Apto para datos reales solo si la administración lo aprueba.",
      fuente: FUENTES_OPENROUTER.zdr,
      verificadoEn: FECHA_VERIFICACION,
    },
    nota: "Costo estimado con el endpoint de retención cero más caro de la lista; el real suele ser menor.",
  },
  {
    id: "openrouter/free",
    nombre: "Router de modelos gratuitos (aleatorio)",
    familia: "Router",
    gratuito: true,
    contexto: 200000,
    capacidades: { json: true, herramientas: true, vision: true, audio: false },
    costo: SIN_COSTO,
    politica: {
      permiteDatosReales: false,
      entrena: null,
      retiene: null,
      descripcion: "Elige al azar un modelo gratuito; no se sabe de antemano qué empresa recibe el texto. No recomendado.",
      fuente: "https://openrouter.ai/docs/guides/routing/routers/free-router",
      verificadoEn: FECHA_VERIFICACION,
    },
    nota: "Contradice la selección manual de modelo; solo para pruebas.",
  },
];

const LIMITES_GRATIS: LimitesProveedor = {
  solicitudesPorMinuto: LIMITES_GRATUITOS_OPENROUTER.solicitudesPorMinuto,
  solicitudesPorDia: LIMITES_GRATUITOS_OPENROUTER.solicitudesPorDiaSinCreditos,
  limiteMensualUsd: 0,
  maxTokensSalida: 800,
  tiempoMaximoMs: 20000,
  reintentos: 2,
};

export const PLANTILLAS: Record<TipoProveedor, PlantillaProveedor> = {
  openrouter: {
    tipo: "openrouter",
    nombre: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1",
    secretoSugerido: "LLM_KEY_OPENROUTER",
    requiereLlave: true,
    destinatarios: "OpenRouter (EE. UU.) y la empresa que sirve el modelo elegido.",
    descripcion:
      "Router con modelos gratuitos (variante «:free») y de pago. Límites gratuitos: 20 solicitudes por minuto y 50 al día (1000 si la cuenta compró al menos 10 USD de créditos).",
    limites: LIMITES_GRATIS,
    modelos: MODELOS_OPENROUTER,
  },
  freellmapi: {
    tipo: "freellmapi",
    nombre: "FreeLLMAPI (autoalojado)",
    endpoint: "http://127.0.0.1:3001/v1",
    secretoSugerido: "LLM_KEY_FREELLMAPI",
    requiereLlave: true,
    destinatarios: "Tu servidor FreeLLMAPI y los proveedores gratuitos a los que reenvía cada solicitud.",
    descripcion:
      "Proyecto de código abierto (github.com/tashfeenahmed/freellmapi) que agrupa niveles gratuitos de varios proveedores detrás de un solo /v1 con llave unificada y respaldo automático. En Vercel necesita una URL pública con HTTPS; localhost solo funciona en tu PC.",
    limites: { ...LIMITES_GRATIS, solicitudesPorMinuto: undefined, solicitudesPorDia: undefined },
    modelos: [
      {
        id: "auto",
        nombre: "auto (el router de FreeLLMAPI elige)",
        familia: "Router",
        gratuito: true,
        contexto: 0,
        capacidades: { json: false, herramientas: false, vision: false, audio: false },
        costo: SIN_COSTO,
        politica: {
          permiteDatosReales: false,
          entrena: null,
          retiene: null,
          descripcion:
            "Reenvía a niveles gratuitos de terceros, cuyas políticas varían y suelen permitir registro o entrenamiento. Solo demo.",
          fuente: "https://github.com/tashfeenahmed/freellmapi",
          verificadoEn: FECHA_VERIFICACION,
        },
        nota: "Escribe otro id si fijaste un modelo concreto en FreeLLMAPI.",
      },
    ],
  },
  openai_compatible: {
    tipo: "openai_compatible",
    nombre: "Endpoint compatible con OpenAI (local o propio)",
    endpoint: "http://127.0.0.1:11434/v1",
    secretoSugerido: "LLM_KEY_LOCAL",
    requiereLlave: false,
    destinatarios: "El servidor que indiques en el endpoint (por ejemplo, Ollama o LM Studio en tu equipo).",
    descripcion:
      "Cualquier servidor con /v1/chat/completions: Ollama (puerto 11434), LM Studio (puerto 1234), vLLM u otro. Si corre en tu equipo, los datos no salen de él.",
    limites: { solicitudesPorMinuto: undefined, solicitudesPorDia: undefined, limiteMensualUsd: 0, maxTokensSalida: 800, tiempoMaximoMs: 60000, reintentos: 1 },
    modelos: [],
  },
};

export function buscarModeloCatalogo(id: string): ModeloCatalogo | undefined {
  return Object.values(PLANTILLAS)
    .flatMap((p) => p.modelos)
    .find((m) => m.id === id);
}

export function esModeloGratuito(id: string): boolean {
  return id.endsWith(":free") || id === "openrouter/free" || buscarModeloCatalogo(id)?.gratuito === true;
}
