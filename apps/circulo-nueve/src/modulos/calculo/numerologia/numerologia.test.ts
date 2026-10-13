import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CASOS_REFERENCIA } from "./casos-referencia";
import {
  CONFIG_POR_DEFECTO,
  MOTOR,
  MOTOR_VERSION,
  REGLAS_VERSION,
  TABLA_PITAGORICA,
  calcularNumerologia,
  crearConfig,
  normalizarNombre,
  reducir,
  validarFecha,
  type ResultadoNumerologia,
} from "./index";

function ok(r: ReturnType<typeof calcularNumerologia>): ResultadoNumerologia {
  if (!r.ok) throw new Error(`Se esperaba éxito: ${r.errores.join("; ")}`);
  return r;
}

function valores(r: ResultadoNumerologia) {
  return Object.fromEntries(r.indicadores.map((i) => [i.clave, i.valor]));
}

const raizDigital = (n: number) => ((n - 1) % 9) + 1;

describe("tabla pitagórica", () => {
  it("asigna 1–9 en filas de nueve", () => {
    expect(TABLA_PITAGORICA.A).toBe(1);
    expect(TABLA_PITAGORICA.I).toBe(9);
    expect(TABLA_PITAGORICA.J).toBe(1);
    expect(TABLA_PITAGORICA.R).toBe(9);
    expect(TABLA_PITAGORICA.S).toBe(1);
    expect(TABLA_PITAGORICA.Z).toBe(8);
    expect(Object.keys(TABLA_PITAGORICA)).toHaveLength(26);
  });
});

describe("casos de referencia", () => {
  for (const caso of CASOS_REFERENCIA) {
    it(caso.titulo, () => {
      const r = ok(calcularNumerologia({ nombre: caso.nombre, fecha: caso.fecha }, crearConfig(caso.config)));
      expect(valores(r)).toMatchObject(caso.esperado);
    });
  }
});

describe("reglas de normalización", () => {
  it("quita acentos y diéresis y registra el cambio", () => {
    const r = normalizarNombre("Zoë Ángel Güell", CONFIG_POR_DEFECTO);
    expect(r.ok && r.palabras).toEqual(["ZOE", "ANGEL", "GUELL"]);
    expect(r.ok && r.cambios.map((c) => c.original)).toEqual(["ë", "Á", "ü"]);
  });

  it("cuenta la ñ como N por defecto", () => {
    const r = normalizarNombre("Ñuño", CONFIG_POR_DEFECTO);
    expect(r.ok && r.palabras).toEqual(["NUNO"]);
  });

  it("rechaza la ñ si la regla es «rechazar»", () => {
    const r = normalizarNombre("Ñuño", crearConfig({ enye: "rechazar" }));
    expect(r.ok).toBe(false);
  });

  it("separa palabras por espacios y guiones e ignora apóstrofos y puntos", () => {
    const r = normalizarNombre("  Jean-Luc   O'Brien J. ", CONFIG_POR_DEFECTO);
    expect(r.ok && r.palabras).toEqual(["JEAN", "LUC", "OBRIEN", "J"]);
  });

  it.each([
    ["Ζωή", "alfabeto latino"],
    ["Ana3", "dígito"],
    ["Ana@", "símbolo"],
    ["   ", "vacío"],
  ])("rechaza «%s» (%s)", (nombre) => {
    expect(normalizarNombre(nombre, CONFIG_POR_DEFECTO).ok).toBe(false);
  });
});

describe("reducción", () => {
  it("muestra cada paso", () => {
    const r = reducir(57, CONFIG_POR_DEFECTO);
    expect(r.valor).toBe(3);
    expect(r.pasos.map((p) => p.operacion)).toEqual(["57 → 5 + 7 = 12", "12 → 1 + 2 = 3"]);
  });

  it("se detiene en un maestro intermedio", () => {
    const r = reducir(29, CONFIG_POR_DEFECTO);
    expect(r.valor).toBe(11);
    expect(r.pasos.at(-1)?.operacion).toContain("número maestro");
  });

  it("respeta la lista de maestros configurada", () => {
    expect(reducir(33, crearConfig({ maestros: [11, 22] })).valor).toBe(6);
  });
});

describe("validación de fecha", () => {
  it.each(["2023-02-29", "1990-13-01", "15/07/1990", "1990-7-15", ""])("rechaza «%s»", (f) => {
    expect(validarFecha(f).ok).toBe(false);
  });
  it("acepta un 29 de febrero bisiesto", () => {
    expect(validarFecha("2024-02-29").ok).toBe(true);
  });
});

describe("calcularNumerologia", () => {
  it("exige al menos nombre o fecha", () => {
    expect(calcularNumerologia({}).ok).toBe(false);
  });

  it("no inventa indicadores si falta un dato", () => {
    const r = ok(calcularNumerologia({ fecha: "1990-07-15" }));
    expect(r.indicadores.map((i) => i.clave)).toEqual(["caminoDeVida"]);
    expect(r.advertencias.join(" ")).toContain("Sin nombre");
  });

  it("registra motor, versión, reglas y entradas normalizadas", () => {
    const r = ok(calcularNumerologia({ nombre: "Ana María Núñez", fecha: "1990-07-15" }));
    expect(r.motor).toBe(MOTOR);
    expect(r.motorVersion).toBe(MOTOR_VERSION);
    expect(r.reglasVersion).toBe(REGLAS_VERSION);
    expect(r.reglas).toEqual(CONFIG_POR_DEFECTO);
    expect(r.entradas.nombreNormalizado).toBe("ANA MARIA NUNEZ");
    for (const i of r.indicadores) expect(i.pasos.length).toBeGreaterThan(0);
  });

  it("devuelve todos los errores juntos", () => {
    const r = calcularNumerologia({ nombre: "Ana3", fecha: "1990-02-30" });
    expect(!r.ok && r.errores).toHaveLength(2);
  });
});

describe("propiedades", () => {
  const letras = fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzáéíóúñü".split(""));
  const palabra = fc.array(letras, { minLength: 1, maxLength: 12 }).map((a) => a.join(""));
  const nombre = fc.array(palabra, { minLength: 1, maxLength: 4 }).map((a) => a.join(" "));
  const config = fc.record({
    numerosMaestros: fc.boolean(),
    y: fc.constantFrom("consonante" as const, "vocal" as const),
    metodoNombre: fc.constantFrom("total" as const, "por-palabra" as const),
  });

  it("los valores están en 1–9 o son maestros configurados", () => {
    fc.assert(
      fc.property(nombre, config, (n, c) => {
        const cfg = crearConfig(c);
        for (const i of ok(calcularNumerologia({ nombre: n }, cfg)).indicadores) {
          expect((i.valor >= 1 && i.valor <= 9) || (cfg.numerosMaestros && cfg.maestros.includes(i.valor))).toBe(true);
        }
      }),
    );
  });

  it("expresión ≡ alma + personalidad (mód. 9)", () => {
    fc.assert(
      fc.property(nombre, config, (n, c) => {
        const v = valores(ok(calcularNumerologia({ nombre: n }, crearConfig(c))));
        if (v.alma === undefined || v.personalidad === undefined) return;
        expect(raizDigital(v.expresion)).toBe(raizDigital(v.alma + v.personalidad));
      }),
    );
  });

  it("es determinista y no depende de mayúsculas ni acentos", () => {
    fc.assert(
      fc.property(nombre, (n) => {
        const a = valores(ok(calcularNumerologia({ nombre: n })));
        const b = valores(ok(calcularNumerologia({ nombre: n.toUpperCase() })));
        const c = valores(ok(calcularNumerologia({ nombre: n.normalize("NFD").replace(/\p{M}/gu, "") })));
        expect(b).toEqual(a);
        expect(c).toEqual(a);
      }),
    );
  });
});
