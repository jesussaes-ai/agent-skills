import { describe, expect, it } from "vitest";
import { decidirActualizacion, versionActual } from "./version";

describe("versionActual", () => {
  it("usa el despliegue de Vercel, luego el commit y si no «local»", () => {
    expect(versionActual({ VERCEL_DEPLOYMENT_ID: "dpl_1", VERCEL_GIT_COMMIT_SHA: "abc" })).toBe("dpl_1");
    expect(versionActual({ VERCEL_GIT_COMMIT_SHA: "abc" })).toBe("abc");
    expect(versionActual({ VERCEL_DEPLOYMENT_ID: "  " })).toBe("local");
  });
});

describe("decidirActualizacion", () => {
  const base = { local: "v1", editando: false, recargadaPara: null };
  it("no hace nada si la versión coincide o el servidor no responde", () => {
    expect(decidirActualizacion({ ...base, remota: "v1" })).toBe("nada");
    expect(decidirActualizacion({ ...base, remota: null })).toBe("nada");
  });
  it("recarga sola si hay versión nueva y no se está llenando un formulario", () => {
    expect(decidirActualizacion({ ...base, remota: "v2" })).toBe("recargar");
  });
  it("avisa en lugar de recargar si hay un formulario a medio llenar", () => {
    expect(decidirActualizacion({ ...base, remota: "v2", editando: true })).toBe("avisar");
  });
  it("no recarga en bucle si tras recargar la versión sigue sin coincidir", () => {
    expect(decidirActualizacion({ ...base, remota: "v2", recargadaPara: "v2" })).toBe("avisar");
  });
});
