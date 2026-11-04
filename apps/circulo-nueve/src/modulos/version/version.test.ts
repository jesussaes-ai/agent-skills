import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_VERSION, compararVersiones, hayActualizacion, versionActual } from "./version";

describe("versionActual", () => {
  it("usa el despliegue de Vercel, luego el commit y si no «local»", () => {
    expect(versionActual({ VERCEL_DEPLOYMENT_ID: "dpl_1", VERCEL_GIT_COMMIT_SHA: "abc" })).toBe("dpl_1");
    expect(versionActual({ VERCEL_GIT_COMMIT_SHA: "abc" })).toBe("abc");
    expect(versionActual({ VERCEL_DEPLOYMENT_ID: "  " })).toBe("local");
  });
});

describe("número de versión", () => {
  it("sale de package.json con formato X.Y.Z", () => {
    const paquete = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "package.json"), "utf8"));
    expect(APP_VERSION).toBe(paquete.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it("la línea del tiempo menciona la versión actual", () => {
    const linea = readFileSync(join(__dirname, "..", "..", "..", "LINEA_DE_TIEMPO.md"), "utf8");
    expect(linea).toContain(`v${APP_VERSION}`);
  });
  it("compara por números, no como texto", () => {
    expect(compararVersiones("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compararVersiones("v0.2.0", "0.2.0")).toBe(0);
    expect(compararVersiones("0.1.9", "0.2.0")).toBeLessThan(0);
  });
});

describe("hayActualizacion", () => {
  it("solo si el servidor responde con otro despliegue", () => {
    expect(hayActualizacion({ local: "v1", remota: "v1" })).toBe(false);
    expect(hayActualizacion({ local: "v1", remota: null })).toBe(false);
    expect(hayActualizacion({ local: "v1", remota: "v2" })).toBe(true);
  });
});
