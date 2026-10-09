import { describe, expect, it } from "vitest";
import { esquemaCrearEnlace } from "./esquemas";
import { estadoEnlace, opcionesVigencia } from "./estado";
import { esTokenValido, generarToken, hashToken } from "./token";

describe("tokens de enlaces compartidos", () => {
  it("genera tokens únicos de 43 caracteres y guarda solo su hash", () => {
    const a = generarToken();
    const b = generarToken();
    expect(a.token).not.toBe(b.token);
    expect(esTokenValido(a.token)).toBe(true);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).not.toContain(a.token);
  });

  it("rechaza tokens con formato distinto", () => {
    expect(esTokenValido("")).toBe(false);
    expect(esTokenValido("a".repeat(42))).toBe(false);
    expect(esTokenValido(`${"a".repeat(42)}/`)).toBe(false);
    expect(esTokenValido("../../etc/passwd")).toBe(false);
  });
});

describe("estado del enlace", () => {
  const ahora = new Date("2026-10-09T12:00:00Z");
  const base = { venceEl: "2026-10-10T12:00:00Z", revocadoEl: null, accesos: 0, maxAccesos: null };

  it("vigente, vencido, revocado y agotado", () => {
    expect(estadoEnlace(base, ahora)).toBe("vigente");
    expect(estadoEnlace({ ...base, venceEl: "2026-10-09T12:00:00Z" }, ahora)).toBe("vencido");
    expect(estadoEnlace({ ...base, revocadoEl: "2026-10-09T11:00:00Z" }, ahora)).toBe("revocado");
    expect(estadoEnlace({ ...base, accesos: 3, maxAccesos: 3 }, ahora)).toBe("agotado");
  });

  it("la revocación manda sobre el vencimiento", () => {
    expect(estadoEnlace({ ...base, venceEl: "2026-10-01T00:00:00Z", revocadoEl: "2026-09-30T00:00:00Z" }, ahora)).toBe("revocado");
  });

  it("las opciones de vigencia respetan el máximo configurado", () => {
    expect(opcionesVigencia(7).map((o) => o.horas)).toEqual([1, 24, 72, 168]);
    expect(opcionesVigencia(1).map((o) => o.horas)).toEqual([1, 24]);
    expect(opcionesVigencia(30).at(-1)?.horas).toBe(720);
  });
});

describe("formulario de enlace", () => {
  const id = "aaaaaaaa-0000-4000-8000-000000000001";

  it("un documento vacío significa todo el expediente", () => {
    const r = esquemaCrearEnlace.parse({ expedienteId: id, documentoId: "", vigenciaHoras: "24", maxAccesos: "", nota: "  " });
    expect(r).toEqual({ expedienteId: id, documentoId: null, vigenciaHoras: 24, maxAccesos: null, nota: null });
  });

  it("valida límites de vigencia, descargas y nota", () => {
    expect(esquemaCrearEnlace.safeParse({ expedienteId: id, documentoId: "", vigenciaHoras: "721", maxAccesos: "", nota: "" }).success).toBe(false);
    expect(esquemaCrearEnlace.safeParse({ expedienteId: id, documentoId: "", vigenciaHoras: "24", maxAccesos: "0", nota: "" }).success).toBe(false);
    expect(esquemaCrearEnlace.safeParse({ expedienteId: id, documentoId: "", vigenciaHoras: "24", maxAccesos: "", nota: "x".repeat(121) }).success).toBe(false);
    expect(esquemaCrearEnlace.safeParse({ expedienteId: "no", documentoId: "", vigenciaHoras: "24", maxAccesos: "", nota: "" }).success).toBe(false);
  });
});
