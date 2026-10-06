/**
 * Lee la configuración del proveedor LLM desde variables de entorno.
 * Solo debe llamarse en código de servidor. Devuelve si hay llave, nunca la llave.
 */

export const PROVEEDORES_LLM = ["demo", "openrouter", "freellmapi", "ollama"] as const;
export type IdProveedorLlm = (typeof PROVEEDORES_LLM)[number];

export interface ConfigLlmPublica {
  proveedor: IdProveedorLlm;
  baseUrl?: string;
  modelo?: string;
  tieneLlave: boolean;
  permiteDatosReales: boolean;
  advertencias: string[];
}

export function leerConfigLlm(env: Record<string, string | undefined> = process.env): ConfigLlmPublica {
  const advertencias: string[] = [];
  const solicitado = (env.LLM_PROVIDER ?? "demo").trim().toLowerCase();
  let proveedor: IdProveedorLlm = "demo";
  if ((PROVEEDORES_LLM as readonly string[]).includes(solicitado)) {
    proveedor = solicitado as IdProveedorLlm;
  } else {
    advertencias.push(`Proveedor LLM desconocido («${solicitado}»); se usa el modo demo.`);
  }

  const tieneLlave = Boolean(env.LLM_API_KEY?.trim());
  if (proveedor !== "demo" && proveedor !== "ollama" && !tieneLlave) {
    advertencias.push(`El proveedor «${proveedor}» no tiene LLM_API_KEY; se usa el modo demo.`);
    proveedor = "demo";
  }

  return {
    proveedor,
    baseUrl: env.LLM_BASE_URL?.trim() || undefined,
    modelo: env.LLM_MODEL?.trim() || undefined,
    tieneLlave,
    permiteDatosReales: proveedor !== "demo" && env.LLM_PERMITE_DATOS_REALES === "true",
    advertencias,
  };
}
