import { describe, expect, it } from "vitest";
import { diferencia } from "./angulos";
import { ayanamsaMedia } from "./ayanamsa";
import { SISTEMAS_NO_POLARES, calcularCasas, limitePolar } from "./casas";
import referencias from "./casos-referencia.json";
import { motorAstronomyEngine as motor } from "./efemerides";
import { calcularCartaNatal } from "./motor";
import { candidatosUtc, leerFecha, leerHora } from "./tiempo";
import type { ClaveAyanamsa, ClaveCuerpo, LugarNacimiento, SistemaCasas } from "./tipos";

/** Tolerancias declaradas (ver docs/astrologia-motor.md). */
const TOLERANCIA = {
  planetas: 30 / 3600,
  nodos: 30 / 3600,
  casas: 20 / 3600,
  ayanamsa: 1 / 3600,
};

const CUERPOS: [ClaveCuerpo, string][] = [
  ["sol", "sol"],
  ["luna", "luna"],
  ["mercurio", "mercurio"],
  ["venus", "venus"],
  ["marte", "marte"],
  ["jupiter", "jupiter"],
  ["saturno", "saturno"],
  ["urano", "urano"],
  ["neptuno", "neptuno"],
  ["pluton", "pluton"],
];

type Esperado = (typeof referencias.casos)[number]["esperado"];
type CasasRef = Esperado["casas"]["placidus"];

const lugarExacto = (l: (typeof referencias.casos)[number]["entrada"]["lugar"]): LugarNacimiento => ({
  nombre: l.nombre,
  latitud: l.latitud,
  longitud: l.longitud,
  zonaHoraria: l.zonaHoraria,
  incertidumbreGrados: 0,
  fuente: { tipo: "manual", descripcion: "caso de referencia" },
});

const diff = (a: number, b: number) => Math.abs(diferencia(a, b));

describe("casos de referencia contra Swiss Ephemeris y zoneinfo", () => {
  it("documenta su fuente", () => {
    expect(referencias.fuente.efemerides).toMatch(/Swiss Ephemeris 2\.10/);
    expect(referencias.casos.length).toBeGreaterThanOrEqual(10);
  });

  for (const caso of referencias.casos) {
    describe(caso.titulo, () => {
      const { entrada, esperado } = caso;
      const utcMs = Date.parse(esperado.utc);

      it("convierte la hora local a UT igual que zoneinfo", () => {
        const c = candidatosUtc(entrada.lugar.zonaHoraria, { ...leerFecha(entrada.fecha)!, ...leerHora(entrada.hora)! });
        expect(c.estado).toBe("unica");
        expect(new Date(c.utcMs[0]).toISOString().replace(".000", "")).toBe(esperado.utc);
        expect(c.desfasesSeg[0]).toBe(esperado.desfaseSeg);
      });

      it("posiciones tropicales dentro de 30″ y nodos dentro de 30″", () => {
        for (const [clave, ref] of CUERPOS) {
          const r = esperado.tropical[ref as keyof Esperado["tropical"]];
          expect(diff(motor.longitud(clave, utcMs, "verdadero"), r.longitud), clave).toBeLessThan(TOLERANCIA.planetas);
        }
        expect(diff(motor.longitud("nodo", utcMs, "medio"), esperado.tropical.nodoMedio.longitud)).toBeLessThan(TOLERANCIA.nodos);
        expect(diff(motor.longitud("nodo", utcMs, "verdadero"), esperado.tropical.nodoVerdadero.longitud)).toBeLessThan(TOLERANCIA.nodos);
      });

      it("ARMC, Ascendente, Medio Cielo y cúspides de cada sistema dentro de 20″", () => {
        const e = {
          armc: motor.armc(utcMs, entrada.lugar.longitud),
          latitud: entrada.lugar.latitud,
          oblicuidad: motor.oblicuidad(utcMs),
        };
        const polar = Math.abs(e.latitud) >= limitePolar(e.oblicuidad);
        for (const [sistema, refSistema] of Object.entries(esperado.casas) as [SistemaCasas, CasasRef][]) {
          const r = calcularCasas(e, sistema, "porfirio");
          // Diferencia deliberada: en zona polar no se usan sistemas de horizonte (Swiss Ephemeris invierte MC/IC).
          const respaldoEsperado = !refSistema.definido || (polar && SISTEMAS_NO_POLARES.includes(sistema));
          const ref = respaldoEsperado ? esperado.casas.porfirio : refSistema;
          expect(diff(e.armc, ref.armc)).toBeLessThan(TOLERANCIA.casas);
          expect(diff(r.asc, ref.asc), `${sistema} asc`).toBeLessThan(TOLERANCIA.casas);
          expect(diff(r.mc, ref.mc), `${sistema} mc`).toBeLessThan(TOLERANCIA.casas);
          expect(r.respaldo, `${sistema} respaldo`).toBe(respaldoEsperado);
          r.cuspides.forEach((c, i) => expect(diff(c, ref.cuspides[i]), `${sistema} casa ${i + 1}`).toBeLessThan(TOLERANCIA.casas));
        }
      });

      it("ayanamsas y posiciones siderales", () => {
        for (const [clave, ref] of Object.entries(esperado.siderales) as [ClaveAyanamsa, Esperado["siderales"]["lahiri"]][]) {
          const T = motor.siglosTT(utcMs);
          expect(diff(ayanamsaMedia(clave, T), ref.ayanamsaMedio), clave).toBeLessThan(TOLERANCIA.ayanamsa);
          const r = calcularCartaNatal(
            { fecha: entrada.fecha, hora: entrada.hora, precisionHora: "exacta", lugar: lugarExacto(entrada.lugar) },
            { zodiaco: "sideral", ayanamsa: clave, margenExactaMin: 0, sistemaCasas: "signos-enteros" },
          );
          if (!r.ok) throw new Error(r.errores.join(" "));
          const pos = (k: string) => r.posiciones.find((p) => p.clave === k)!.longitud;
          expect(diff(pos("sol"), ref.sol), `${clave} sol`).toBeLessThan(TOLERANCIA.planetas);
          expect(diff(pos("luna"), ref.luna), `${clave} luna`).toBeLessThan(TOLERANCIA.planetas);
          expect(diff(pos("asc"), ref.asc), `${clave} asc`).toBeLessThan(TOLERANCIA.casas + TOLERANCIA.ayanamsa);
        }
      });

      it("el motor completo reproduce posiciones y casas Placidus", () => {
        const r = calcularCartaNatal(
          { fecha: entrada.fecha, hora: entrada.hora, precisionHora: "exacta", lugar: lugarExacto(entrada.lugar) },
          { margenExactaMin: 0 },
        );
        if (!r.ok) throw new Error(r.errores.join(" "));
        expect(r.tiempo.utc).toBe(esperado.utc);
        for (const [clave, ref] of CUERPOS) {
          const p = r.posiciones.find((x) => x.clave === clave)!;
          expect(diff(p.longitud, esperado.tropical[ref as keyof Esperado["tropical"]].longitud)).toBeLessThan(TOLERANCIA.planetas);
          expect(p.retrogrado).toBe(esperado.tropical[ref as keyof Esperado["tropical"]].velocidad < 0);
        }
        const placidus = esperado.casas.placidus;
        r.casas!.cuspides.forEach((c, i) => expect(diff(c.longitud, placidus.cuspides[i])).toBeLessThan(TOLERANCIA.casas));
        expect(r.casas!.sistemaUsado).toBe(placidus.definido ? "placidus" : "porfirio");
      });
    });
  }
});

describe("casos de zona horaria contra zoneinfo", () => {
  for (const caso of referencias.casosZona) {
    it(caso.titulo, () => {
      const c = candidatosUtc(caso.zonaHoraria, { ...leerFecha(caso.fecha)!, ...leerHora(caso.hora)! });
      expect(c.estado).toBe(caso.esperado.estado);
      expect(c.utcMs.map((u) => new Date(u).toISOString().replace(".000", ""))).toEqual(caso.esperado.utc);
      if ("desfasesSeg" in caso.esperado) expect(c.desfasesSeg).toEqual(caso.esperado.desfasesSeg);
    });
  }
});
