import { describe, expect, it } from "vitest";
import { ZONAS_MEXICO, ZONAS_RESPALDO, agruparZonas, desfaseUtc, etiquetaZona, filtrarZonas, zonasDisponibles } from "./zonas";

const INVIERNO = new Date("2026-01-15T12:00:00Z");
const VERANO = new Date("2026-07-15T12:00:00Z");

describe("catálogo de zonas horarias", () => {
  it("usa todas las zonas IANA del motor e incluye UTC", () => {
    const zonas = zonasDisponibles();
    expect(zonas.length).toBeGreaterThan(300);
    expect(zonas).toContain("America/Mexico_City");
    expect(zonas).toContain("UTC");
  });

  it("si no hay Intl.supportedValuesOf, recurre a la lista de respaldo", () => {
    const original = Intl.supportedValuesOf;
    (Intl as { supportedValuesOf?: unknown }).supportedValuesOf = undefined;
    try {
      expect(zonasDisponibles()).toEqual(ZONAS_RESPALDO);
    } finally {
      Intl.supportedValuesOf = original;
    }
  });

  it("calcula el desfase vigente con horario de verano", () => {
    expect(desfaseUtc("America/Mexico_City", INVIERNO)).toBe("UTC−06:00");
    expect(desfaseUtc("Europe/Madrid", INVIERNO)).toBe("UTC+01:00");
    expect(desfaseUtc("Europe/Madrid", VERANO)).toBe("UTC+02:00");
    expect(desfaseUtc("Asia/Calcutta", VERANO)).toBe("UTC+05:30");
    expect(desfaseUtc("UTC", VERANO)).toBe("UTC±00:00");
    expect(desfaseUtc("Zona/Inventada", VERANO)).toBe("");
  });

  it("pone México primero, en su orden, y no repite sus zonas en América", () => {
    const grupos = agruparZonas(undefined, INVIERNO);
    expect(grupos[0].region).toBe("México");
    expect(grupos[0].zonas.map((z) => z.id)).toEqual([...ZONAS_MEXICO]);
    expect(grupos[0].zonas[0]).toMatchObject({ ciudad: "Ciudad de México (centro)", desfase: "UTC−06:00" });
    const america = grupos.find((g) => g.region === "América")!;
    expect(america.zonas.some((z) => z.id === "America/Mexico_City")).toBe(false);
    expect(america.zonas.some((z) => z.id === "America/Bogota")).toBe(true);
    expect(grupos.at(-1)!.region).toBe("Otras");
    const total = grupos.reduce((n, g) => n + g.zonas.length, 0);
    expect(total).toBe(zonasDisponibles().length);
  });

  it("busca sin acentos por ciudad, región, identificador o desfase", () => {
    const grupos = agruparZonas(undefined, INVIERNO);
    const ids = (q: string) => filtrarZonas(grupos, q).flatMap((g) => g.zonas.map((z) => z.id));
    expect(ids("merida")).toEqual(["America/Merida"]);
    expect(ids("Buenos Aires").some((id) => id.endsWith("Buenos_Aires"))).toBe(true);
    expect(ids("madrid")).toEqual(["Europe/Madrid"]);
    expect(ids("utc+05:30").some((id) => /Asia\/(Kolkata|Calcutta)/.test(id))).toBe(true);
    expect(ids("kolkata").length).toBe(1);
    expect(ids("mexico")).toEqual(expect.arrayContaining([...ZONAS_MEXICO]));
    expect(filtrarZonas(grupos, "")).toBe(grupos);
    expect(ids("zzzz")).toEqual([]);
  });

  it("muestra la zona elegida con ciudad e identificador", () => {
    expect(etiquetaZona("America/Mexico_City")).toBe("Ciudad de México (centro) · America/Mexico_City");
    expect(etiquetaZona("Europe/Madrid")).toBe("Madrid · Europe/Madrid");
    expect(etiquetaZona("UTC")).toBe("UTC");
  });
});
