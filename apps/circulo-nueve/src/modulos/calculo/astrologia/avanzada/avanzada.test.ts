import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { separacion } from "../angulos";
import { motorAstronomyEngine } from "../efemerides";
import { lugarManual } from "../lugares";
import { calcularCartaNatal } from "../motor";
import type { ConfigAstrologia, EntradaCarta, ResultadoCarta } from "../tipos";
import { longitudEn } from "./comun";
import {
  ORBES_TRANSITO_POR_DEFECTO,
  arcoSolar,
  calcularTransitos,
  calendarioTransitos,
  progresionesSecundarias,
  revolucionSolar,
  sinastria,
  type ErrorAvanzado,
} from "./index";

const CDMX = lugarManual("Ciudad de México (ficticio)", 19.42847, -99.12766, "America/Mexico_City", 0.15);
const MADRID = lugarManual("Madrid", 40.4168, -3.7038, "Europe/Madrid", 0);
const ANA: EntradaCarta = { fecha: "1990-07-15", hora: "08:30", precisionHora: "exacta", lugar: CDMX };

function carta(e: EntradaCarta = ANA, c: Partial<ConfigAstrologia> = {}): ResultadoCarta {
  const r = calcularCartaNatal(e, c);
  if (!r.ok) throw new Error(r.errores.join(" "));
  return r;
}
function ok<T extends { ok: true }>(r: T | ErrorAvanzado): T {
  if (!r.ok) throw new Error(r.errores.join(" "));
  return r;
}

const natal = carta();
const natalSideral = carta(ANA, { zodiaco: "sideral", ayanamsa: "lahiri" });

describe("tránsitos", () => {
  it("en el instante natal, cada cuerpo en tránsito está en conjunción exacta consigo mismo y en su casa natal", () => {
    const r = ok(calcularTransitos(natal, natal.tiempo.utc));
    for (const p of r.posiciones) {
      const n = natal.posiciones.find((x) => x.clave === p.clave)!;
      expect(p.longitud).toBeCloseTo(n.longitud, 9);
      expect(p.casaNatal).toBe(n.casa);
      const conj = r.aspectos.find((a) => a.origen === p.clave && a.destino === p.clave && a.aspecto === "conjuncion");
      expect(conj?.orbe).toBeLessThan(1e-9);
    }
  });
  it("usa orbes de tránsito pequeños (≤ 2°) y documentados, configurables", () => {
    const r = ok(calcularTransitos(natal, "2026-11-02T12:00:00Z"));
    expect(Math.max(...ORBES_TRANSITO_POR_DEFECTO.filter((a) => a.activo).map((a) => a.orbe))).toBe(2);
    for (const a of r.aspectos) expect(a.orbe <= a.orbeMaximo || a.incierto).toBe(true);
    for (const a of r.aspectos) expect(a.fase === "aplicativo" || a.fase === "separativo").toBe(true);
    const r2 = ok(calcularTransitos(natal, "2026-11-02T12:00:00Z", { aspectos: [{ clave: "conjuncion", activo: true, orbe: 0.1 }] }));
    for (const a of r2.aspectos.filter((x) => x.aspecto === "conjuncion")) expect(a.orbeMaximo).toBe(0.1);
    expect(r.reproducibilidad.motorVersion).toBe(natal.motorVersion);
    expect(r.interpretaciones.estado).toBe("pendiente");
  });
  it("sideral: los tránsitos usan el mismo zodiaco que la carta", () => {
    const r = ok(calcularTransitos(natalSideral, natalSideral.tiempo.utc));
    const sol = r.posiciones.find((p) => p.clave === "sol")!;
    expect(sol.longitud).toBeCloseTo(natalSideral.posiciones.find((p) => p.clave === "sol")!.longitud, 9);
  });
  it("no adivina la zona: rechaza instantes sin Z ni desfase", () => {
    expect(calcularTransitos(natal, "2026-11-02T12:00:00").ok).toBe(false);
    expect(calcularTransitos(natal, "2026-11-02T06:00:00-06:00").ok).toBe(true);
  });
  it("el sentido aplicativo/separativo coincide con el orbe una hora después", () => {
    const t = Date.parse("2026-11-02T12:00:00Z");
    const r = ok(calcularTransitos(natal, t));
    const r2 = ok(calcularTransitos(natal, t + 3_600_000));
    for (const a of r.aspectos.filter((x) => x.orbe > 0.2)) {
      const b = r2.aspectos.find((x) => x.origen === a.origen && x.destino === a.destino && x.aspecto === a.aspecto);
      if (!b) continue;
      expect(b.orbe < a.orbe ? "aplicativo" : "separativo").toBe(a.fase);
    }
  });
});

describe("calendario de tránsitos", () => {
  const cal = ok(calendarioTransitos(natal, "2026-01-01T00:00:00Z", "2027-12-31T00:00:00Z"));

  it("cada exactitud encontrada tiene orbe < 0,01° en ese minuto (comprobado con calcularTransitos)", () => {
    expect(cal.eventos.length).toBeGreaterThan(20);
    for (const e of cal.eventos) {
      expect(e.orbe).toBeLessThan(0.01);
      expect(e.utc).toMatch(/T\d{2}:\d{2}:00Z$/);
      const t = ok(calcularTransitos(natal, e.utc, { cuerpos: [e.transito] }));
      const a = t.aspectos.find((x) => x.destino === e.natal && x.aspecto === e.aspecto);
      expect(a, `${e.transito} ${e.aspecto} ${e.natal} ${e.utc}`).toBeDefined();
      expect(a!.orbe).toBeLessThan(0.01);
    }
  });
  it("solo planetas lentos por defecto, ordenado por fecha", () => {
    // (Neptuno, cerca de 0°–3° Aries en 2026–2027, no forma aspectos exactos con esta carta en el rango.)
    for (const e of cal.eventos) expect(["jupiter", "saturno", "urano", "neptuno", "pluton"]).toContain(e.transito);
    expect(new Set(cal.eventos.map((e) => e.transito)).size).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < cal.eventos.length; i++) expect(cal.eventos[i].instanteMs).toBeGreaterThanOrEqual(cal.eventos[i - 1].instanteMs);
  });
  it("retrogradación: hay series de 3 pasadas directo → retrógrado → directo", () => {
    const triples = cal.eventos.filter((e) => e.totalPasadas === 3);
    expect(triples.length).toBeGreaterThan(0);
    const clave = (e: (typeof triples)[number]) => `${e.transito}|${e.natal}|${e.aspecto}|${e.longitudObjetivo}`;
    const grupos = new Map<string, typeof triples>();
    for (const e of triples) grupos.set(clave(e), [...(grupos.get(clave(e)) ?? []), e]);
    const patrones = [...grupos.values()].filter((g) => g.length === 3).map((g) => g.map((e) => e.movimiento).join(","));
    expect(patrones).toContain("directo,retrogrado,directo");
  });
  it("con planetas rápidos: el Sol pasa una vez al año sobre el Sol natal", () => {
    const r = ok(calendarioTransitos(natal, "2026-01-01T00:00:00Z", "2027-12-31T00:00:00Z", { planetas: ["sol"], aspectos: ["conjuncion"], puntosNatales: ["sol"] }));
    expect(r.eventos.map((e) => e.utc.slice(0, 7))).toEqual(["2026-07", "2027-07"]);
    expect(r.eventos.every((e) => e.pasada === 1 && e.totalPasadas === 1)).toBe(true);
  });
  it("limita el rango a 2 años y rechaza la Luna", () => {
    expect(calendarioTransitos(natal, "2026-01-01T00:00:00Z", "2028-03-01T00:00:00Z").ok).toBe(false);
    expect(calendarioTransitos(natal, "2026-01-01T00:00:00Z", "2025-01-01T00:00:00Z").ok).toBe(false);
    expect(calendarioTransitos(natal, "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", { planetas: ["luna" as never] }).ok).toBe(false);
  });
});

describe("sinastría", () => {
  it("una carta consigo misma: todas las conjunciones a 0° y cada punto en su propia casa", () => {
    const r = ok(sinastria(natal, natal));
    for (const p of natal.posiciones) {
      const conj = r.aspectos.find((a) => a.origen === p.clave && a.destino === p.clave && a.aspecto === "conjuncion");
      expect(conj?.orbe, p.clave).toBe(0);
    }
    for (const p of r.aEnCasasDeB!) {
      const n = natal.posiciones.find((x) => x.clave === p.clave)!;
      if (n.casa !== undefined) expect(p.casa).toBe(n.casa);
    }
  });
  it("sin casas en B: no ubica a A en casas de B; rechaza zodiacos distintos", () => {
    const sinHora = carta({ fecha: "1985-03-02", precisionHora: "desconocida", zonaHoraria: "America/Mexico_City" });
    const r = ok(sinastria(natal, sinHora));
    expect(r.aEnCasasDeB).toBeNull();
    expect(r.bEnCasasDeA).toHaveLength(sinHora.posiciones.length);
    expect(sinastria(natal, natalSideral).ok).toBe(false);
  });
});

describe("revolución solar", () => {
  it("deja al Sol a menos de 1″ de su longitud natal", () => {
    const r = ok(revolucionSolar(natal, 2026));
    expect(r.diferenciaArcosegundos).toBeLessThan(1);
    expect(r.instanteUtc).toMatch(/^2026-07-1[45]T\d{2}:\d{2}:\d{2}Z$/);
    expect(r.carta.tiempo.utc).toBe(r.instanteUtc);
    expect(r.carta.casas).not.toBeNull();
    expect(r.lugar.origen).toBe("natal");
  });
  it("en otro lugar: mismo instante y Sol, casas distintas", () => {
    const a = ok(revolucionSolar(natal, 2026));
    const b = ok(revolucionSolar(natal, 2026, MADRID));
    expect(b.instanteUtc).toBe(a.instanteUtc);
    expect(b.carta.tiempo.zonaHoraria).toBe("Europe/Madrid");
    expect(b.carta.posiciones.find((p) => p.clave === "asc")!.longitud).not.toBeCloseTo(a.carta.posiciones.find((p) => p.clave === "asc")!.longitud, 0);
  });
  it("sideral: el retorno es al Sol sideral", () => {
    const r = ok(revolucionSolar(natalSideral, 2030));
    expect(r.diferenciaArcosegundos).toBeLessThan(1);
    const t = Date.parse(r.instanteUtc);
    expect(separacion(longitudEn(motorAstronomyEngine, natalSideral.config, "sol", t), r.longitudSolNatal) * 3600).toBeLessThan(1);
  });
  it("rechaza años anteriores al nacimiento", () => {
    expect(revolucionSolar(natal, 1980).ok).toBe(false);
  });
});

describe("progresiones secundarias y arco solar", () => {
  it("a la fecha de nacimiento coinciden con la carta natal", () => {
    const r = ok(progresionesSecundarias(natal, natal.tiempo.utc));
    expect(r.edadAnios).toBe(0);
    expect(r.arcoSolar).toBe(0);
    for (const p of r.posiciones) expect(p.longitud).toBeCloseTo(natal.posiciones.find((x) => x.clave === p.clave)!.longitud, 9);
    const a = ok(arcoSolar(natal, natal.tiempo.utc));
    for (const p of a.posiciones) expect(p.longitud).toBeCloseTo(natal.posiciones.find((x) => x.clave === p.clave)!.longitud, 9);
  });
  it("un día de efeméride = un año de vida: a los 30 años el Sol progresado es el del 14 de agosto de 1990", () => {
    const consulta = Date.parse(natal.tiempo.utc) + 30 * 365.2421897 * 86_400_000;
    const r = ok(progresionesSecundarias(natal, consulta));
    expect(r.edadAnios).toBeCloseTo(30, 9);
    expect(Date.parse(r.instanteProgresadoUtc) - Date.parse(natal.tiempo.utc)).toBeCloseTo(30 * 86_400_000, -1);
    expect(r.arcoSolar).toBeGreaterThan(28);
    expect(r.arcoSolar).toBeLessThan(30);
    const mc = r.posiciones.find((p) => p.clave === "mc")!;
    expect(mc.metodo).toBe("arco-solar");
    expect(separacion(mc.longitud, natal.posiciones.find((p) => p.clave === "mc")!.longitud)).toBeCloseTo(r.arcoSolar, 9);
  });
  it("rechaza fechas de consulta anteriores al nacimiento", () => {
    expect(progresionesSecundarias(natal, "1980-01-01T00:00:00Z").ok).toBe(false);
  });
});

describe("propiedades (fast-check)", () => {
  const instante = fc.integer({ min: Date.UTC(1900, 0, 1), max: Date.UTC(2090, 0, 1) });

  it("tránsitos: orbe = |separación − ángulo| y nunca mayor que el máximo salvo incierto", () => {
    fc.assert(
      fc.property(instante, (t) => {
        const r = ok(calcularTransitos(natal, t));
        for (const a of r.aspectos) {
          const o = r.posiciones.find((p) => p.clave === a.origen)!.longitud;
          const d = natal.posiciones.find((p) => p.clave === a.destino)!.longitud;
          expect(Math.abs(separacion(o, d) - a.angulo)).toBeCloseTo(a.orbe, 9);
          expect(a.orbe <= a.orbeMaximo || a.incierto).toBe(true);
        }
      }),
      { numRuns: 25 },
    );
  });

  it("arco solar conserva las separaciones natales entre puntos", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 80 * 365 }), (dias) => {
        const r = ok(arcoSolar(natal, Date.parse(natal.tiempo.utc) + dias * 86_400_000));
        const ps = r.posiciones;
        for (let i = 0; i + 1 < ps.length; i++) {
          const n1 = natal.posiciones.find((p) => p.clave === ps[i].clave)!.longitud;
          const n2 = natal.posiciones.find((p) => p.clave === ps[i + 1].clave)!.longitud;
          expect(separacion(ps[i].longitud, ps[i + 1].longitud)).toBeCloseTo(separacion(n1, n2), 9);
        }
      }),
      { numRuns: 30 },
    );
  });

  it("sinastría simétrica: aspectos(A, B) = aspectos(B, A) intercambiados", () => {
    const fecha = fc.record({ y: fc.integer({ min: 1920, max: 2020 }), m: fc.integer({ min: 1, max: 12 }), d: fc.integer({ min: 1, max: 28 }), h: fc.integer({ min: 0, max: 23 }) });
    fc.assert(
      fc.property(fecha, ({ y, m, d, h }) => {
        const b = carta({ fecha: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, hora: `${String(h).padStart(2, "0")}:15`, precisionHora: "exacta", zonaHoraria: "UTC", lugar: MADRID });
        const ab = ok(sinastria(natal, b)).aspectos.map((a) => `${a.origen}|${a.destino}|${a.aspecto}|${a.orbe.toFixed(9)}`).sort();
        const ba = ok(sinastria(b, natal)).aspectos.map((a) => `${a.destino}|${a.origen}|${a.aspecto}|${a.orbe.toFixed(9)}`).sort();
        expect(ab).toEqual(ba);
      }),
      { numRuns: 10 },
    );
  });

  it("revolución solar de cualquier año: Sol a menos de 1″", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1991, max: 2099 }), (anio) => {
        const r = ok(revolucionSolar(natal, anio));
        expect(r.diferenciaArcosegundos).toBeLessThan(1);
      }),
      { numRuns: 10 },
    );
  });
});
