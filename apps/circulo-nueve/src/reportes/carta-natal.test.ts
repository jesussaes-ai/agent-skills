import { describe, expect, it } from "vitest";
import { calcularCartaNatal } from "@/modulos/calculo/astrologia";
import { reporteDeCartaNatal, textoPdf } from "./adaptadores/carta-natal";
import { LUGAR_MUESTRA, datosMuestraCartaNatal } from "./demo/muestra-carta-natal";
import { generarReportePdf } from "./generar";

/** Caracteres que cubren las fuentes incrustadas (latín básico y latín-1, más estos símbolos, comprobado con su cmap). */
const PERMITIDO = /^[\u0020-\u007E\u00A0-\u00FF—–′″−…→◆\n]*$/u;

function textos(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(textos);
  if (v && typeof v === "object") return Object.values(v).flatMap(textos);
  return [];
}

const carta = (hora: string | undefined, precisionHora: "exacta" | "aproximada" | "desconocida") => {
  const r = calcularCartaNatal({ fecha: "1988-11-23", hora, precisionHora, lugar: LUGAR_MUESTRA });
  if (!r.ok) throw new Error(r.errores.join(" "));
  return r;
};

describe("adaptador de carta natal para PDF", () => {
  it("convierte la carta en datos, cálculos, tablas, rueda y límites", () => {
    const d = reporteDeCartaNatal(carta("06:40", "exacta"));
    expect(d.tipo).toBe("carta-natal");
    expect(d.tradicion).toBe("Astrología occidental · zodiaco tropical · casas Placidus");
    expect(d.datosAutorizados.map((x) => x.etiqueta)).toEqual([
      "Fecha de nacimiento",
      "Hora local de nacimiento",
      "Lugar de nacimiento",
      "Zona horaria",
      "Tiempo universal usado",
    ]);
    expect(d.datosAutorizados[2].nota).toMatch(/GeoNames id 4005539/);
    expect(d.calculos[0].pasos.some((p) => p.descripcion === "Tiempo universal (UT)")).toBe(true);
    expect(d.tablas?.map((t) => t.titulo)).toEqual(["Posiciones calculadas", "Cúspides de las casas · Placidus", expect.stringMatching(/^Aspectos/)]);
    expect(d.tablas?.[1].filas).toHaveLength(6);
    expect(d.rueda?.ascendente).toBeDefined();
    expect(d.rueda?.cuspides).toHaveLength(12);
    expect(d.limites.join(" ")).toMatch(/Swiss Ephemeris/);
  });

  it("sin hora no imprime casas ni Ascendente y lo explica", () => {
    const d = reporteDeCartaNatal(carta(undefined, "desconocida"));
    expect(d.tablas?.map((t) => t.titulo)).not.toContain("Cúspides de las casas · Placidus");
    expect(d.tablas?.[0].columnas).not.toContain("Casa");
    expect(d.rueda?.ascendente).toBeUndefined();
    expect(d.datosAutorizados[1]).toMatchObject({ valor: "Desconocida" });
    expect(d.rueda?.puntos.find((p) => p.abreviatura === "Lu")?.rango).toBeDefined();
    expect(d.limites.join(" ")).toMatch(/Hora desconocida/);
  });

  it("solo usa caracteres que existen en las fuentes del PDF", () => {
    expect(textoPdf("≈22° Cáncer")).toBe("aprox. 22° Cáncer");
    for (const datos of [datosMuestraCartaNatal(), { ...datosMuestraCartaNatal(), ...reporteDeCartaNatal(carta(undefined, "desconocida")) }]) {
      for (const t of textos(datos)) expect(t, t).toMatch(PERMITIDO);
    }
  });

  it("genera el PDF de la muestra ficticia", async () => {
    const pdf = await generarReportePdf(datosMuestraCartaNatal());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(50_000);
  });
});
