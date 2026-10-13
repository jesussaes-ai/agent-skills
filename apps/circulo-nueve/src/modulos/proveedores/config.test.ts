import { describe, expect, it } from "vitest";
import { leerConfigLlm } from "./config";

describe("leerConfigLlm", () => {
  it("usa el modo demo por defecto", () => {
    expect(leerConfigLlm({})).toMatchObject({ proveedor: "demo", tieneLlave: false, permiteDatosReales: false });
  });

  it("vuelve a demo si falta la llave", () => {
    const c = leerConfigLlm({ LLM_PROVIDER: "openrouter" });
    expect(c.proveedor).toBe("demo");
    expect(c.advertencias).toHaveLength(1);
  });

  it("nunca devuelve el valor de la llave", () => {
    const c = leerConfigLlm({ LLM_PROVIDER: "openrouter", LLM_API_KEY: "valor-de-prueba" });
    expect(c.proveedor).toBe("openrouter");
    expect(JSON.stringify(c)).not.toContain("valor-de-prueba");
  });

  it("solo permite datos reales si se declara explícitamente", () => {
    expect(leerConfigLlm({ LLM_PROVIDER: "ollama" }).permiteDatosReales).toBe(false);
    expect(leerConfigLlm({ LLM_PROVIDER: "ollama", LLM_PERMITE_DATOS_REALES: "true" }).permiteDatosReales).toBe(true);
  });
});
