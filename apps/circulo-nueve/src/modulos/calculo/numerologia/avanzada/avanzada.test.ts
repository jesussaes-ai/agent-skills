import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CONFIG_POR_DEFECTO, crearConfig } from "../config";
import { calcularNumerologia } from "../motor";
import {
  cicloPersonal,
  ciclosDeVida,
  compatibilidadNumerologica,
  numerosAdicionales,
  pinaculosYDesafios,
} from "./index";

function ok<T extends { ok: boolean }>(r: T | { ok: false; errores: string[] }): T {
  if (!r.ok) throw new Error(`Se esperaba ok: ${JSON.stringify(r)}`);
  return r as T;
}

const raizDigital = (n: number) => ((n - 1) % 9) + 1;
const maestros = CONFIG_POR_DEFECTO.maestros;
const unDigitoOMaestro = (n: number) => (n >= 1 && n <= 9) || maestros.includes(n);

/*
 * Fechas de referencia calculadas a mano (personas ficticias):
 *
 * A) 1990-07-15 — día 15 → 1+5 = 6; mes 7; año 1990 → 19 → 10 → 1.
 *    Camino de vida = 6 + 7 + 1 = 14 → 5. A = 36 − 5 = 31.
 *    Pináculos: P1 = 7+6 = 13 → 4; P2 = 6+1 = 7; P3 = 4+7 = 11 (maestro); P4 = 7+1 = 8.
 *    Edades: 0–31, 31–40, 40–49, 49+.
 *    Desafíos: D1 = |7−6| = 1; D2 = |6−1| = 5; D3 = |1−5| = 4; D4 = |7−1| = 6.
 *    Ciclos de vida: 7, 6, 1 · edades 0–31, 31–58, 58+.
 *    Ciclo personal al 2026-11-02 (calendario): 2026 → 10 → 1; 6+7+1 = 14 → 5;
 *      mes 11 (maestro, se suma tal cual): 5+11 = 16 → 7; día 2: 7+2 = 9.
 *    Al 2026-03-01 desde cumpleaños: aún no cumple (15/7) → 2025 → 9; 6+7+9 = 22 (maestro);
 *      mes 3: 22+3 = 25 → 7; día 1: 7+1 = 8.
 *    Con «Ana María Núñez» (expresión 3): madurez 5+3 = 8; día 15 → 6; actitud 15+7 = 22 (maestro).
 *    Letras A1 N5 A1 M4 A1 R9 I9 A1 N5 U3 N5 E5 Z8 → conteo 1:4, 3:1, 4:1, 5:4, 8:1, 9:2 (13 letras).
 *    Kármicos ausentes: 2, 6, 7.
 *
 * B) 1980-01-01 — día 1, mes 1, año 1980 → 18 → 9. Camino de vida 1+1+9 = 11 (maestro) → 2 para edades.
 *    A = 36 − 2 = 34. Pináculos: 1+1 = 2; 1+9 = 10 → 1; 2+1 = 3; 1+9 = 10 → 1.
 *    Desafíos: |1−1| = 0; |1−9| = 8; |0−8| = 8; |1−9| = 8. Edades 0–34, 34–43, 43–52, 52+.
 *
 * C) 2000-02-29 (bisiesto) — día 29 → 11 (maestro) / 2 a un dígito; mes 2; año 2000 → 2.
 *    Camino de vida 11+2+2 = 15 → 6. A = 30. Pináculos 4, 4, 8, 4. Desafíos 0, 0, 0, 0.
 *    Ciclos de vida: 2, 11 (maestro), 2 · edades 0–30, 30–57, 57+.
 *    Día de nacimiento 29 → 11; actitud 29+2 = 31 → 4.
 *    Ciclo personal al 2025-02-28: calendario → 2025 → 9; 11+2+9 = 22 (maestro); 22+2 = 24 → 6; 28 → 10 → 1: 6+1 = 7.
 *      desde cumpleaños: 2025 no es bisiesto, cumple el 1/3 → aún no → 2024 → 8; 11+2+8 = 21 → 3; 3+2 = 5; 5+1 = 6.
 *    Al 2025-03-01 desde cumpleaños → 2025 → 22; 22+3 = 25 → 7; 7+1 = 8.
 *    Al 2028-02-29 desde cumpleaños (bisiesto, es su cumpleaños) → 2028 → 12 → 3; 11+2+3 = 16 → 7.
 *
 * D) 1999-11-22 — día 22 (maestro) / 4; mes 11 (maestro) / 2; año 1999 → 28 → 10 → 1.
 *    Camino de vida 22+11+1 = 34 → 7. A = 29. Pináculos: 2+4 = 6; 4+1 = 5; 6+5 = 11; 2+1 = 3.
 *    Desafíos: |2−4| = 2; |4−1| = 3; |2−3| = 1; |2−1| = 1. Ciclos de vida 11, 22, 1 (0–29, 29–56, 56+).
 *    Actitud 22+11 = 33 (maestro). Con «Gina» (expresión 22): madurez 7+22 = 29 → 11 (maestro).
 *    Ciclo personal al 2026-11-02: 22+11+1 = 34 → 7; 7+11 = 18 → 9; 9+2 = 11 (maestro).
 */

describe("cicloPersonal", () => {
  const valores = (r: ReturnType<typeof cicloPersonal>) => {
    const x = ok(r);
    return [x.anioPersonal.valor, x.mesPersonal.valor, x.diaPersonal.valor];
  };

  it("A) año calendario", () => {
    expect(valores(cicloPersonal("1990-07-15", "2026-11-02"))).toEqual([5, 7, 9]);
  });
  it("A) desde el cumpleaños, antes de cumplir (año personal maestro 22)", () => {
    const r = ok(cicloPersonal("1990-07-15", "2026-03-01", CONFIG_POR_DEFECTO, { inicioAnio: "cumpleanos" }));
    expect(r.entradas.anioUsado).toBe(2025);
    expect([r.anioPersonal.valor, r.mesPersonal.valor, r.diaPersonal.valor]).toEqual([22, 7, 8]);
    expect(r.anioPersonal.esMaestro).toBe(true);
  });
  it("A) calendario el mismo día da otro año personal", () => {
    expect(valores(cicloPersonal("1990-07-15", "2026-03-01"))).toEqual([5, 8, 9]);
  });
  it("C) 29 de febrero, calendario y cumpleaños en año no bisiesto", () => {
    expect(valores(cicloPersonal("2000-02-29", "2025-02-28"))).toEqual([22, 6, 7]);
    const r = ok(cicloPersonal("2000-02-29", "2025-02-28", undefined, { inicioAnio: "cumpleanos" }));
    expect(r.entradas.anioUsado).toBe(2024);
    expect(r.advertencias.join(" ")).toContain("1 de marzo");
    expect([r.anioPersonal.valor, r.mesPersonal.valor, r.diaPersonal.valor]).toEqual([3, 5, 6]);
    expect(valores(cicloPersonal("2000-02-29", "2025-03-01", undefined, { inicioAnio: "cumpleanos" }))).toEqual([22, 7, 8]);
    expect(ok(cicloPersonal("2000-02-29", "2028-02-29", undefined, { inicioAnio: "cumpleanos" })).anioPersonal.valor).toBe(7);
  });
  it("D) día personal maestro 11", () => {
    expect(valores(cicloPersonal("1999-11-22", "2026-11-02"))).toEqual([7, 9, 11]);
  });
  it("muestra pasos con descripción y operación", () => {
    const r = ok(cicloPersonal("1990-07-15", "2026-11-02"));
    expect(r.anioPersonal.pasos.map((p) => p.operacion)).toContain("6 + 7 + 1 = 14");
    expect(r.anioPersonal.pasos.map((p) => p.operacion)).toContain("14 → 1 + 4 = 5");
    for (const p of [...r.anioPersonal.pasos, ...r.mesPersonal.pasos, ...r.diaPersonal.pasos]) {
      expect(p.descripcion).toBeTruthy();
      expect(p.operacion).toBeTruthy();
    }
  });
  it("rechaza fechas inválidas y consulta anterior al nacimiento", () => {
    expect(cicloPersonal("1990-02-30", "2026-01-01").ok).toBe(false);
    expect(cicloPersonal("1990-07-15", "26-01-01").ok).toBe(false);
    expect(cicloPersonal("1990-07-15", "1990-07-14").ok).toBe(false);
    expect(cicloPersonal("1990-07-15", "1990-07-15").ok).toBe(true);
  });
});

describe("pinaculosYDesafios", () => {
  const resumen = (fecha: string) => {
    const r = ok(pinaculosYDesafios(fecha));
    return {
      pin: r.pinaculos.map((p) => p.valor),
      des: r.desafios.map((d) => d.valor),
      edades: r.pinaculos.map((p) => [p.edadInicio, p.edadFin]),
      cv: [r.caminoDeVida.valor, r.caminoDeVida.unDigito],
    };
  };

  it("A) 1990-07-15", () => {
    expect(resumen("1990-07-15")).toEqual({
      pin: [4, 7, 11, 8],
      des: [1, 5, 4, 6],
      edades: [[0, 31], [31, 40], [40, 49], [49, null]],
      cv: [5, 5],
    });
  });
  it("B) 1980-01-01 (camino de vida maestro 11)", () => {
    expect(resumen("1980-01-01")).toEqual({
      pin: [2, 1, 3, 1],
      des: [0, 8, 8, 8],
      edades: [[0, 34], [34, 43], [43, 52], [52, null]],
      cv: [11, 2],
    });
  });
  it("C) 2000-02-29 (bisiesto)", () => {
    expect(resumen("2000-02-29")).toEqual({
      pin: [4, 4, 8, 4],
      des: [0, 0, 0, 0],
      edades: [[0, 30], [30, 39], [39, 48], [48, null]],
      cv: [6, 6],
    });
  });
  it("D) 1999-11-22 (maestros 11 y 22 en la fecha)", () => {
    const r = resumen("1999-11-22");
    expect(r.pin).toEqual([6, 5, 11, 3]);
    expect(r.des).toEqual([2, 3, 1, 1]);
    expect(r.cv).toEqual([7, 7]);
  });
  it("da años de calendario y pasos", () => {
    const r = ok(pinaculosYDesafios("1990-07-15"));
    expect(r.pinaculos[0].anioFin).toBe(2021);
    expect(r.pinaculos[3].anioFin).toBeNull();
    expect(r.desafios[2].pasos[0].operacion).toBe("|1 − 5| = 4");
    expect(r.pinaculos[0].pasos.map((p) => p.operacion)).toContain("36 − 5 = 31");
  });
  it("rechaza fechas inválidas", () => {
    expect(pinaculosYDesafios("2001-02-29").ok).toBe(false);
  });
});

describe("ciclosDeVida", () => {
  it("A) edades por pináculos", () => {
    const r = ok(ciclosDeVida("1990-07-15"));
    expect(r.ciclos.map((c) => c.valor)).toEqual([7, 6, 1]);
    expect(r.ciclos.map((c) => [c.edadInicio, c.edadFin])).toEqual([[0, 31], [31, 58], [58, null]]);
  });
  it("C) 2000-02-29 conserva el maestro 11 del día", () => {
    const r = ok(ciclosDeVida("2000-02-29"));
    expect(r.ciclos.map((c) => c.valor)).toEqual([2, 11, 2]);
    expect(r.ciclos[1].esMaestro).toBe(true);
    expect(r.ciclos.map((c) => [c.edadInicio, c.edadFin])).toEqual([[0, 30], [30, 57], [57, null]]);
  });
  it("D) 1999-11-22 y edades fijas", () => {
    const r = ok(ciclosDeVida("1999-11-22", CONFIG_POR_DEFECTO, { edades: "fijas-28" }));
    expect(r.ciclos.map((c) => c.valor)).toEqual([11, 22, 1]);
    expect(r.ciclos.map((c) => [c.edadInicio, c.edadFin])).toEqual([[0, 28], [28, 56], [56, null]]);
  });
  it("sin maestros, todo es de un dígito", () => {
    const r = ok(ciclosDeVida("1999-11-22", crearConfig({ numerosMaestros: false })));
    expect(r.ciclos.map((c) => c.valor)).toEqual([2, 4, 1]);
  });
});

describe("numerosAdicionales", () => {
  it("A) Ana María Núñez, 1990-07-15", () => {
    const r = ok(numerosAdicionales("Ana María Núñez", "1990-07-15"));
    expect(r.madurez.valor).toBe(8);
    expect(r.diaDeNacimiento.valor).toBe(6);
    expect(r.actitud.valor).toBe(22);
    expect(r.actitud.esMaestro).toBe(true);
    expect(r.tablaDeInclusion.conteos.map((c) => c.cantidad)).toEqual([4, 0, 1, 1, 4, 0, 0, 1, 2]);
    expect(r.tablaDeInclusion.totalLetras).toBe(13);
    expect(r.karmicosAusentes.numeros).toEqual([2, 6, 7]);
    expect(r.entradas.nombreNormalizado).toBe("ANA MARIA NUNEZ");
  });
  it("C) 2000-02-29: día de nacimiento maestro y actitud", () => {
    const r = ok(numerosAdicionales("Gina", "2000-02-29"));
    expect(r.diaDeNacimiento.valor).toBe(11);
    expect(r.actitud.valor).toBe(4);
    // Camino 6 + expresión 22 = 28 → 10 → 1
    expect(r.madurez.valor).toBe(1);
    // G7 I9 N5 A1
    expect(r.karmicosAusentes.numeros).toEqual([2, 3, 4, 6, 8]);
  });
  it("D) 1999-11-22: madurez 11 y actitud 33", () => {
    const r = ok(numerosAdicionales("Gina", "1999-11-22"));
    expect(r.madurez.valor).toBe(11);
    expect(r.actitud.valor).toBe(33);
    expect(r.diaDeNacimiento.valor).toBe(22);
  });
  it("exige nombre y fecha válidos", () => {
    expect(numerosAdicionales("", "1990-07-15").ok).toBe(false);
    expect(numerosAdicionales("Ana", "").ok).toBe(false);
    expect(numerosAdicionales("Ana3", "1990-07-15").ok).toBe(false);
  });
});

describe("compatibilidadNumerologica", () => {
  it("compara los cuatro números con diferencia y etiqueta", () => {
    const r = ok(
      compatibilidadNumerologica({ nombre: "Gina", fecha: "1980-01-01" }, { nombre: "Ana María Núñez", fecha: "1990-07-15" }),
    );
    const t = Object.fromEntries(r.pares.map((p) => [p.clave, [p.a, p.b, p.diferencia, p.etiqueta]]));
    // CV 11 (→2) vs 5 → 3; expresión 22 (→4) vs 3 → 1; alma 1 vs 3 → 2; personalidad 3 vs 9 → 6
    expect(t).toEqual({
      caminoDeVida: [11, 5, 3, "distintos"],
      expresion: [22, 3, 1, "complementarios"],
      alma: [1, 3, 2, "complementarios"],
      personalidad: [3, 9, 6, "distintos"],
    });
    expect(JSON.stringify(r)).not.toMatch(/%/);
  });
  it("misma vibración con maestro reducido; convención configurable", () => {
    const a = { fecha: "2000-09-09" }; // 9 + 9 + 2 = 20 → 2
    const b = { fecha: "1980-01-01" }; // 11
    const r = ok(compatibilidadNumerologica(a, b));
    const cv = r.pares.find((p) => p.clave === "caminoDeVida")!;
    expect([cv.a, cv.b, cv.diferencia, cv.etiquetaTexto]).toEqual([2, 11, 0, "misma vibración"]);
    const r2 = ok(compatibilidadNumerologica(a, b, CONFIG_POR_DEFECTO, { reducirMaestrosAlComparar: false }));
    expect(r2.pares[0].diferencia).toBe(9);
    expect(r2.pares[0].etiqueta).toBe("distintos");
    const r3 = ok(compatibilidadNumerologica({ fecha: "1990-07-15" }, b, CONFIG_POR_DEFECTO, { complementariosMax: 3 }));
    expect(r3.pares[0].etiqueta).toBe("complementarios");
  });
  it("sin datos suficientes deja el par en null y avisa", () => {
    const r = ok(compatibilidadNumerologica({ fecha: "1990-07-15" }, { nombre: "Gina" }));
    expect(r.pares.every((p) => p.diferencia === null)).toBe(true);
    expect(r.advertencias.length).toBeGreaterThan(0);
  });
  it("propaga errores con la persona indicada", () => {
    const r = compatibilidadNumerologica({ fecha: "1990-13-01" }, { nombre: "Gina" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errores[0]).toMatch(/^Persona A:/);
  });
});

/* ---------- Propiedades ---------- */

const fechaArb = fc
  .date({ min: new Date(Date.UTC(1900, 0, 1)), max: new Date(Date.UTC(2100, 11, 31)), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));

describe("propiedades", () => {
  it("ciclo personal: 1–9 o maestro, y congruente módulo 9", () => {
    fc.assert(
      fc.property(fechaArb, fechaArb, (x, y) => {
        const [n, c] = x <= y ? [x, y] : [y, x];
        const r = ok(cicloPersonal(n, c));
        const [, nm, nd] = n.split("-").map(Number);
        const [ca, cm, cd] = c.split("-").map(Number);
        for (const i of [r.anioPersonal, r.mesPersonal, r.diaPersonal]) expect(unDigitoOMaestro(i.valor)).toBe(true);
        expect(raizDigital(r.anioPersonal.valor)).toBe(raizDigital(nd + nm + ca));
        expect(raizDigital(r.mesPersonal.valor)).toBe(raizDigital(nd + nm + ca + cm));
        expect(raizDigital(r.diaPersonal.valor)).toBe(raizDigital(nd + nm + ca + cm + cd));
      }),
    );
  });

  it("pináculos 1–9 o maestro; desafíos 0–8; edades encadenadas", () => {
    fc.assert(
      fc.property(fechaArb, (f) => {
        const r = ok(pinaculosYDesafios(f));
        expect(r.pinaculos.every((p) => unDigitoOMaestro(p.valor))).toBe(true);
        expect(r.desafios.every((d) => d.valor >= 0 && d.valor <= 8)).toBe(true);
        expect(r.pinaculos[0].edadFin).toBe(36 - r.caminoDeVida.unDigito);
        for (let i = 1; i < 4; i++) expect(r.pinaculos[i].edadInicio).toBe(r.pinaculos[i - 1].edadFin);
        expect(r.pinaculos[1].edadFin! - r.pinaculos[1].edadInicio).toBe(9);
        expect(r.pinaculos[3].edadFin).toBeNull();
        expect(r.desafios[2].valor).toBe(Math.abs(r.desafios[0].valor - r.desafios[1].valor));
      }),
    );
  });

  it("sin maestros, todo queda en 1–9", () => {
    const sin = crearConfig({ numerosMaestros: false });
    fc.assert(
      fc.property(fechaArb, fechaArb, (x, y) => {
        const [n, c] = x <= y ? [x, y] : [y, x];
        const cp = ok(cicloPersonal(n, c, sin));
        const pd = ok(pinaculosYDesafios(n, sin));
        const cv = ok(ciclosDeVida(n, sin));
        const todos = [cp.anioPersonal, cp.mesPersonal, cp.diaPersonal, ...pd.pinaculos, ...cv.ciclos].map((i) => i.valor);
        expect(todos.every((v) => v >= 1 && v <= 9)).toBe(true);
      }),
    );
  });

  it("tabla de inclusión cuenta todas las letras y los ausentes son los de conteo 0", () => {
    const nombreArb = fc
      .array(fc.stringMatching(/^[A-Za-z]{1,10}$/), { minLength: 1, maxLength: 4 })
      .map((p) => p.join(" "));
    fc.assert(
      fc.property(nombreArb, fechaArb, (nombre, fecha) => {
        const r = ok(numerosAdicionales(nombre, fecha));
        const letras = nombre.replace(/\s/g, "").length;
        expect(r.tablaDeInclusion.totalLetras).toBe(letras);
        expect(r.tablaDeInclusion.conteos.reduce((a, c) => a + c.cantidad, 0)).toBe(letras);
        expect(r.karmicosAusentes.numeros).toEqual(
          r.tablaDeInclusion.conteos.filter((c) => c.cantidad === 0).map((c) => c.numero),
        );
        for (const i of [r.madurez, r.diaDeNacimiento, r.actitud]) expect(unDigitoOMaestro(i.valor)).toBe(true);
        const base = ok(calcularNumerologia({ nombre, fecha }));
        const v = (k: string) => base.indicadores.find((i) => i.clave === k)!.valor;
        expect(raizDigital(r.madurez.valor)).toBe(raizDigital(v("caminoDeVida") + v("expresion")));
      }),
    );
  });

  it("compatibilidad es simétrica y la diferencia está en 0–8", () => {
    fc.assert(
      fc.property(fechaArb, fechaArb, (x, y) => {
        const ab = ok(compatibilidadNumerologica({ fecha: x }, { fecha: y }));
        const ba = ok(compatibilidadNumerologica({ fecha: y }, { fecha: x }));
        expect(ab.pares[0].diferencia).toBe(ba.pares[0].diferencia);
        expect(ab.pares[0].diferencia).toBeGreaterThanOrEqual(0);
        expect(ab.pares[0].diferencia).toBeLessThanOrEqual(8);
      }),
    );
  });
});
