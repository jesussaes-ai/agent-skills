import { describe, expect, it } from "vitest";
import { proponerTransliteracion } from "@/modulos/calculo/cabala";
import { calcularConsulta, fechaLocal, subtituloCarta, type EntradaConsulta } from "@/modulos/consulta/integral";
import { reporteIntegral } from "./adaptadores/integral";
import { LUGAR_MUESTRA } from "./demo/muestra-carta-natal";
import { generarReportePdf } from "./generar";

const PERMITIDO = /^[ -~ -ÿ—–′″−…→◆\n]*$/u;
const textos = (v: unknown): string[] =>
  typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(textos) : v && typeof v === "object" ? Object.values(v).flatMap(textos) : [];

const NOMBRE = "Ana María Núñez";
const base: EntradaConsulta = {
  nombre: NOMBRE,
  fecha: "1988-11-23",
  hora: "06:40",
  precisionHora: "exacta",
  lugar: LUGAR_MUESTRA,
  hebreo: proponerTransliteracion(NOMBRE).map((p) => p.hebreo).join(" "),
  fechaConsulta: "2026-11-03",
};

describe("consulta integral", () => {
  it("calcula numerología, ciclo, pináculos, cábala y carta juntos", () => {
    const r = calcularConsulta(base);
    if (!r.ok) throw new Error(r.errores.join(" "));
    expect(r.numerologia.indicadores).toHaveLength(4);
    expect(r.ciclo?.anioPersonal.valor).toBeGreaterThan(0);
    expect(r.pinaculos?.pinaculos).toHaveLength(4);
    expect(r.cabala?.totales.hejraji).toBeGreaterThan(0);
    expect(r.carta?.posiciones.length).toBeGreaterThan(10);
    expect(r.omitidos).toEqual([]);
  });

  it("sin hebreo aprobado ni lugar sigue con lo demás y dice qué faltó", () => {
    const r = calcularConsulta({ ...base, hebreo: undefined, lugar: undefined });
    if (!r.ok) throw new Error("debía calcular");
    expect(r.cabala).toBeUndefined();
    expect(r.carta).toBeUndefined();
    expect(r.omitidos.join(" ")).toMatch(/hebreas/);
    expect(r.omitidos.join(" ")).toMatch(/lugar/);
  });

  it("rechaza un nombre o una fecha inválidos", () => {
    expect(calcularConsulta({ ...base, fecha: "1990-02-31" }).ok).toBe(false);
  });

  it("el subtítulo de la portada solo nombra lo que incluye", () => {
    expect(subtituloCarta(true, true)).toBe("Numerología, cábala y carta natal en una sola lectura");
    expect(subtituloCarta(false, true)).toBe("Numerología y carta natal en una sola lectura");
    expect(subtituloCarta(false, false)).toBe("Numerología en una sola lectura");
  });

  it("la fecha de la carta es la local, no la UTC", () => {
    // 3 nov 2026 a las 02:00 UTC todavía es 2 nov en la Ciudad de México.
    expect(fechaLocal("America/Mexico_City", new Date("2026-11-03T02:00:00Z"))).toBe("2026-11-02");
    expect(fechaLocal("zona/inventada", new Date("2026-11-03T12:00:00Z"))).toBe("2026-11-03");
  });

  it("la carta integral solo usa caracteres de las fuentes del PDF y se genera", async () => {
    const r = calcularConsulta(base);
    if (!r.ok) throw new Error("debía calcular");
    const campos = reporteIntegral(r);
    expect(campos.tipo).toBe("lectura-integral");
    expect(campos.tablas?.map((t) => t.titulo)).toEqual(expect.arrayContaining(["Pináculos y desafíos", "Letras del nombre"]));
    for (const t of textos(campos)) expect(t, t).toMatch(PERMITIDO);
    const pdf = await generarReportePdf({
      ...campos,
      titulo: "Carta de Círculo Nueve",
      nombrePersona: "Ana",
      folio: "CN-20261103-PRUEBA",
      fechaElaboracion: "2026-11-03",
      demostracion: true,
      interpretaciones: [],
      fuentes: [],
      avisoPrivacidad: {},
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 60_000);
});
