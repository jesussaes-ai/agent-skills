/**
 * Configuración del proveedor LLM desde variables de entorno: respaldo cuando
 * no hay Supabase (desarrollo, demo) o la base no tiene proveedores activos.
 * Solo debe llamarse en código de servidor. Devuelve si hay llave, nunca la llave.
 */

import { PLANTILLAS, esModeloGratuito } from "./catalogo";
import { PATRON_SECRETO, normalizarEndpoint, validarEndpoint } from "./esquemas";
import type { ConfigProveedor, TipoProveedor } from "./tipos";

export const PROVEEDORES_LLM = ["demo", "openrouter", "freellmapi", "ollama", "openai_compatible"] as const;
export type IdProveedorLlm = (typeof PROVEEDORES_LLM)[number];

type Entorno = Record<string, string | undefined>;

export interface ConfigLlmPublica {
  proveedor: IdProveedorLlm;
  baseUrl?: string;
  modelo?: string;
  tieneLlave: boolean;
  permiteDatosReales: boolean;
  advertencias: string[];
}

function tipoDe(id: IdProveedorLlm): TipoProveedor | null {
  if (id === "demo") return null;
  return id === "ollama" ? "openai_compatible" : id;
}

export function leerConfigLlm(env: Entorno = process.env): ConfigLlmPublica {
  const advertencias: string[] = [];
  const solicitado = (env.LLM_PROVIDER ?? "demo").trim().toLowerCase();
  let proveedor: IdProveedorLlm = "demo";
  if ((PROVEEDORES_LLM as readonly string[]).includes(solicitado)) {
    proveedor = solicitado as IdProveedorLlm;
  } else {
    advertencias.push(`Proveedor LLM desconocido («${solicitado}»); se usa el modo demo.`);
  }

  const tieneLlave = Boolean(env.LLM_API_KEY?.trim());
  const tipo = tipoDe(proveedor);
  if (tipo && PLANTILLAS[tipo].requiereLlave && !tieneLlave) {
    advertencias.push(`El proveedor «${proveedor}» no tiene LLM_API_KEY; se usa el modo demo.`);
    proveedor = "demo";
  }

  const modelo = env.LLM_MODEL?.trim() || undefined;
  const gratuito = modelo ? esModeloGratuito(modelo) : false;
  return {
    proveedor,
    baseUrl: env.LLM_BASE_URL?.trim() || undefined,
    modelo,
    tieneLlave,
    permiteDatosReales: proveedor !== "demo" && proveedor !== "freellmapi" && !gratuito && env.LLM_PERMITE_DATOS_REALES === "true",
    advertencias,
  };
}

/** Proveedor único definido por variables de entorno, o null si no hay uno usable. */
export function proveedorDesdeEntorno(env: Entorno = process.env): ConfigProveedor | null {
  const c = leerConfigLlm(env);
  const tipo = tipoDe(c.proveedor);
  if (!tipo) return null;
  const plantilla = PLANTILLAS[tipo];
  const endpoint = normalizarEndpoint(c.baseUrl ?? plantilla.endpoint);
  const modelo = c.modelo ?? plantilla.modelos[0]?.id;
  if (!modelo || validarEndpoint(endpoint)) return null;
  const delCatalogo = plantilla.modelos.find((m) => m.id === modelo);
  const modelosAlternos = (env.LLM_MODELOS_ALTERNOS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  const permiteDatosReales = c.permiteDatosReales && ![modelo, ...modelosAlternos].some(esModeloGratuito);
  return {
    id: "entorno",
    tipo,
    nombre: `${plantilla.nombre} (variables de entorno)`,
    endpoint,
    modelo,
    modelosAlternos,
    destinatarios: plantilla.destinatarios,
    capacidades: delCatalogo?.capacidades ?? { json: env.LLM_JSON === "true", herramientas: false, vision: false, audio: false },
    politicaDatos: {
      permiteDatosReales,
      descripcion: permiteDatosReales
        ? "Declarado apto para datos reales en LLM_PERMITE_DATOS_REALES."
        : (delCatalogo?.politica.descripcion ?? "Sin política declarada: solo demo."),
      entrena: delCatalogo?.politica.entrena ?? null,
      retiene: delCatalogo?.politica.retiene ?? null,
      exigirZdr: delCatalogo?.politica.exigirZdr ?? false,
    },
    limites: { ...plantilla.limites, limiteMensualUsd: Math.max(0, Number(env.LLM_LIMITE_MENSUAL_USD) || 0) },
    costo: delCatalogo?.costo ?? { entradaUsdPorMillon: 0, salidaUsdPorMillon: 0 },
    activo: true,
    prioridad: 1000,
    origen: "entorno",
  };
}

/** Llave del proveedor leída del entorno del servidor. Nunca sale de aquí hacia el cliente. */
export function llaveDe(p: ConfigProveedor, env: Entorno = process.env): string | undefined {
  const nombre = p.origen === "entorno" ? "LLM_API_KEY" : p.secretoNombre;
  if (!nombre) return undefined;
  if (p.origen !== "entorno" && !PATRON_SECRETO.test(nombre)) return undefined;
  return env[nombre]?.trim() || undefined;
}
