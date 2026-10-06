import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { anchoRango, formatoMinuto, signosEnRango } from "./angulos";
import { calcularCasas, casaDe } from "./casas";
import { aLugarNacimiento, buscarLugares, lugarManual, type CatalogoLugares } from "./lugares";
import { calcularCartaNatal } from "./motor";
import { desfaseEn, textoDesfase } from "./tiempo";
import type { EntradaCarta, ResultadoCarta } from "./tipos";

const CDMX = lugarManual("Ciudad de México (ficticio)", 19.42847, -99.12766, "America/Mexico_City", 0.15);
const TROMSO = lugarManual("Tromsø", 69.6489, 18.95508, "Europe/Oslo", 0);

const ANA: EntradaCarta = { fecha: "1990-07-15", hora: "08:30", precisionHora: "exacta", lugar: CDMX };

function ok(r: ReturnType<typeof calcularCartaNatal>): ResultadoCarta {
  if (!r.ok) throw new Error(r.errores.join(" "));
  return r;
}
const punto = (r: ResultadoCarta, clave: string) => r.posiciones.find((p) => p.clave === clave)!;

describe("validación de entradas", () => {
  it("rechaza fechas imposibles o fuera de rango", () => {
    expect(calcularCartaNatal({ ...ANA, fecha: "1990-02-30" }).ok).toBe(false);
    expect(calcularCartaNatal({ ...ANA, fecha: "1700-01-01" }).ok).toBe(false);
  });
  it("exige hora salvo que sea desconocida", () => {
    expect(calcularCartaNatal({ ...ANA, hora: "" }).ok).toBe(false);
    expect(calcularCartaNatal({ ...ANA, hora: "", precisionHora: "desconocida" }).ok).toBe(true);
  });
  it("no adivina la zona horaria", () => {
    const r = calcularCartaNatal({ fecha: "1990-07-15", hora: "08:30", precisionHora: "exacta" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores[0]).toMatch(/zona horaria/);
  });
  it("rechaza zonas inexistentes y coordenadas inválidas", () => {
    expect(calcularCartaNatal({ ...ANA, zonaHoraria: "America/Atlantida" }).ok).toBe(false);
    expect(calcularCartaNatal({ ...ANA, lugar: { ...CDMX, latitud: 95 } }).ok).toBe(false);
  });
});

describe("zona horaria histórica", () => {
  it("hora repetida: pide elegir y respeta la elección", () => {
    const base: EntradaCarta = { fecha: "2000-10-29", hora: "02:30", precisionHora: "exacta", zonaHoraria: "Europe/Madrid" };
    const r = calcularCartaNatal(base);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.opcionesHoraRepetida?.map((o) => o.desfaseTexto)).toEqual(["UTC+02:00", "UTC+01:00"]);
    const segunda = ok(calcularCartaNatal({ ...base, ocurrencia: "segunda" }));
    expect(segunda.tiempo.utc).toBe("2000-10-29T01:30:00Z");
    expect(segunda.tiempo.estado).toBe("repetida");
  });
  it("hora inexistente: lo explica en vez de corregirla en silencio", () => {
    const r = calcularCartaNatal({ fecha: "2002-04-07", hora: "02:30", precisionHora: "exacta", lugar: CDMX });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores[0]).toMatch(/no existió/);
  });
  it("hora media local antes de 1922 en la Ciudad de México", () => {
    const r = ok(calcularCartaNatal({ fecha: "1900-01-01", hora: "12:00", precisionHora: "exacta", lugar: CDMX }));
    expect(r.tiempo.desfaseTexto).toBe("UTC−06:36:36");
    expect(r.tiempo.esHoraMediaLocal).toBe(true);
    expect(r.advertencias.join(" ")).toMatch(/hora media local/);
  });
  it("formatea desfases y conoce la abolición del horario de verano en México (2022)", () => {
    expect(textoDesfase(-21600)).toBe("UTC−06:00");
    expect(textoDesfase(19800)).toBe("UTC+05:30");
    expect(desfaseEn("America/Mexico_City", Date.UTC(2021, 6, 1))).toBe(-5 * 3600);
    expect(desfaseEn("America/Mexico_City", Date.UTC(2023, 6, 1))).toBe(-6 * 3600);
  });
});

describe("precisión según los datos", () => {
  it("hora exacta y coordenadas exactas: planetas al minuto de arco", () => {
    const r = ok(calcularCartaNatal({ ...ANA, lugar: { ...CDMX, incertidumbreGrados: 0 } }, { margenExactaMin: 0 }));
    for (const p of r.posiciones) expect(p.precision, p.clave).toBe("minuto");
    expect(r.casas?.cuspides).toHaveLength(12);
  });
  it("hora exacta (±1 min) y ciudad grande: el Ascendente no se da al minuto", () => {
    const r = ok(calcularCartaNatal(ANA));
    expect(punto(r, "sol").precision).toBe("minuto");
    expect(punto(r, "asc").precision).not.toBe("minuto");
  });
  it("hora aproximada: rango del Ascendente acorde al margen", () => {
    const r = ok(calcularCartaNatal({ ...ANA, precisionHora: "aproximada" }, { margenAproximadaMin: 30 }));
    const asc = punto(r, "asc");
    expect(asc.precision).toBe("rango");
    expect(anchoRango(asc.rango)).toBeGreaterThan(10);
    expect(r.advertencias.join(" ")).toMatch(/±30 min/);
  });
  it("hora desconocida: sin casas ni ángulos, Luna con el rango del día", () => {
    const r = ok(calcularCartaNatal({ ...ANA, hora: undefined, precisionHora: "desconocida" }));
    expect(r.casas).toBeNull();
    expect(r.posiciones.some((p) => p.clave === "asc" || p.clave === "mc")).toBe(false);
    expect(r.posiciones.every((p) => p.casa === undefined)).toBe(true);
    const luna = punto(r, "luna");
    expect(luna.precision).toBe("rango");
    expect(anchoRango(luna.rango)).toBeGreaterThan(11);
    expect(anchoRango(luna.rango)).toBeLessThan(16);
    expect(r.advertencias[0]).toMatch(/no se calculan casas/);
    expect(r.aspectos.every((a) => a.a !== "asc" && a.b !== "asc")).toBe(true);
  });
  it("sin lugar pero con zona: planetas sí, casas no", () => {
    const r = ok(calcularCartaNatal({ fecha: "1990-07-15", hora: "08:30", precisionHora: "exacta", zonaHoraria: "America/Mexico_City" }));
    expect(r.casas).toBeNull();
    expect(r.advertencias.join(" ")).toMatch(/Sin lugar/);
  });
});

describe("casas", () => {
  it("Placidus en zona polar usa el respaldo configurado y avisa", () => {
    const entrada: EntradaCarta = { fecha: "1995-12-21", hora: "10:00", precisionHora: "exacta", lugar: TROMSO };
    const porfirio = ok(calcularCartaNatal(entrada));
    expect(porfirio.casas?.sistemaUsado).toBe("porfirio");
    expect(porfirio.advertencias.join(" ")).toMatch(/no está definido/);
    const enteros = ok(calcularCartaNatal(entrada, { respaldoPolar: "signos-enteros" }));
    expect(enteros.casas?.sistemaUsado).toBe("signos-enteros");
    expect(enteros.casas!.cuspides[0].longitud % 30).toBe(0);
  });
  it("las cúspides opuestas difieren 180° y casaDe es coherente", () => {
    const r = calcularCasas({ armc: 123.4, latitud: 19.4, oblicuidad: 23.44 }, "placidus", "porfirio");
    for (let i = 0; i < 6; i++) expect(Math.abs(((r.cuspides[i + 6] - r.cuspides[i] + 360) % 360) - 180)).toBeLessThan(1e-9);
    expect(r.cuspides[0]).toBe(r.asc);
    expect(r.cuspides[9]).toBe(r.mc);
    expect(casaDe(r.asc + 0.01, r.cuspides)).toBe(1);
    expect(casaDe(r.mc - 0.01, r.cuspides)).toBe(9);
  });
  it("todos los sistemas devuelven 12 cúspides en latitudes medias", () => {
    for (const s of ["placidus", "koch", "regiomontano", "campano", "porfirio", "iguales", "signos-enteros"] as const) {
      const r = ok(calcularCartaNatal(ANA, { sistemaCasas: s }));
      expect(r.casas?.sistemaUsado).toBe(s);
      expect(r.casas?.cuspides).toHaveLength(12);
    }
  });
});

describe("zodiaco y aspectos", () => {
  it("sideral resta la ayanamsa y lo registra en los pasos", () => {
    const trop = ok(calcularCartaNatal(ANA));
    const sid = ok(calcularCartaNatal(ANA, { zodiaco: "sideral", ayanamsa: "lahiri" }));
    const d = (punto(trop, "sol").longitud - punto(sid, "sol").longitud + 360) % 360;
    expect(d).toBeCloseTo(sid.ayanamsaGrados!, 6);
    expect(sid.ayanamsaGrados).toBeGreaterThan(23.6);
    expect(sid.ayanamsaGrados).toBeLessThan(23.8);
    expect(sid.pasos.some((p) => p.descripcion === "Ayanamsa")).toBe(true);
  });
  it("respeta orbes y aspectos activos", () => {
    const r = ok(calcularCartaNatal(ANA));
    for (const a of r.aspectos) if (!a.incierto) expect(a.orbe).toBeLessThanOrEqual(a.orbeMaximo);
    const soloConj = ok(
      calcularCartaNatal(ANA, {
        aspectos: [
          { clave: "oposicion", activo: false, orbe: 8 },
          { clave: "trigono", activo: false, orbe: 7 },
          { clave: "cuadratura", activo: false, orbe: 7 },
          { clave: "sextil", activo: false, orbe: 5 },
        ],
      }),
    );
    expect(soloConj.aspectos.every((a) => a.aspecto === "conjuncion")).toBe(true);
  });
});

describe("separación entre cálculo e interpretación y reproducibilidad", () => {
  it("no incluye interpretaciones y registra motor, versión y reglas", () => {
    const r = ok(calcularCartaNatal(ANA));
    expect(r.interpretaciones.estado).toBe("pendiente");
    expect(r.efemerides).toMatch(/astronomy-engine/);
    expect(r.motorVersion).toBeTruthy();
    expect(r.reglasVersion).toBeTruthy();
  });
  it("es determinista", () => {
    expect(calcularCartaNatal(ANA)).toEqual(calcularCartaNatal(ANA));
  });
});

describe("formato de ángulos", () => {
  it("redondea al minuto sin desbordar el signo", () => {
    expect(formatoMinuto(119.9999)).toBe("0°00′ Leo");
    expect(formatoMinuto(112.5)).toBe("22°30′ Cáncer");
    expect(formatoMinuto(359.999)).toBe("0°00′ Aries");
  });
  it("lista los signos que abarca un rango, incluso cruzando Aries", () => {
    expect(signosEnRango({ desde: 355, hasta: 5 })).toEqual(["Piscis", "Aries"]);
    expect(signosEnRango({ desde: 10, hasta: 20 })).toEqual(["Aries"]);
  });
});

describe("catálogo de lugares (GeoNames)", () => {
  const catalogo = JSON.parse(readFileSync("public/datos/lugares-geonames.json", "utf8")) as CatalogoLugares;

  it("declara fuente, licencia y atribución", () => {
    expect(catalogo.fuente).toBe("GeoNames");
    expect(catalogo.licencia).toBe("CC BY 4.0");
    expect(catalogo.lugares.length).toBeGreaterThan(30000);
  });
  it("encuentra nombres en español y acota por región o país", () => {
    expect(buscarLugares(catalogo, "Ciudad de México")[0][0]).toBe(3530597);
    expect(buscarLugares(catalogo, "Guadalajara, Jalisco")[0][4]).toBe("MX");
    expect(buscarLugares(catalogo, "Guadalajara, España")[0][4]).toBe("ES");
    expect(buscarLugares(catalogo, "x")).toEqual([]);
  });
  it("convierte una fila en lugar con zona IANA, incertidumbre y fuente", () => {
    const fila = buscarLugares(catalogo, "Cancún")[0];
    const lugar = aLugarNacimiento(fila, catalogo);
    expect(lugar.zonaHoraria).toBe("America/Cancun");
    expect(lugar.fuente).toMatchObject({ tipo: "geonames", geonameId: 3531673 });
    expect(lugar.nombre).toMatch(/México/);
    expect(lugar.incertidumbreGrados).toBeGreaterThan(0);
  });
});
