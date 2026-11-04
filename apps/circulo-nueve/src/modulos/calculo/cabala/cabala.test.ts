import { describe, expect, it } from "vitest";
import { calcularCabala, proponerTransliteracion, reducirCabala, transliterarPalabra } from ".";

describe("transliteración propuesta (translit-es-1)", () => {
  it.each([
    ["Ana", "אנה"],
    ["María", "מריה"],
    ["Carlos", "קרלוס"],
    ["José", "חוסה"],
    ["Óscar", "אוסקר"],
    ["Jesús", "חסוס"],
    ["Miriam", "מירים"],
    ["Guillermo", "גיירמו"],
    ["Peña", "פניה"],
  ])("%s → %s", (es, he) => {
    expect(transliterarPalabra(es).hebreo).toBe(he);
  });

  it("separa por palabras y guiones e ignora signos", () => {
    expect(proponerTransliteracion("Ana-María  López").map((p) => p.hebreo)).toEqual(["אנה", "מריה", "לופס"]);
  });
});

describe("gematría", () => {
  it("שלום = 376 (caso clásico) con mem final 600 en Gadol", () => {
    const r = calcularCabala({ hebreo: "שלום" });
    if (!r.ok) throw new Error("debía calcular");
    expect(r.totales.hejraji).toBe(376);
    expect(r.totales.gadol).toBe(936);
    expect(r.totales.katan).toBe(3 + 3 + 6 + 4);
    expect(r.reduccion.valor).toBe(7);
    expect(r.correspondencias[0].sefira.nombre).toBe("Nétsaj");
  });

  it("חי = 18 y אמת = 441", () => {
    const a = calcularCabala({ hebreo: "חי" });
    const b = calcularCabala({ hebreo: "אמת" });
    expect(a.ok && a.totales.hejraji).toBe(18);
    expect(b.ok && b.totales.hejraji).toBe(441);
  });

  it("relaciona números maestros reduciéndolos y lo explica", () => {
    const r = calcularCabala({ hebreo: "אנה", numeros: [{ origen: "Camino de vida", valor: 22 }] });
    if (!r.ok) throw new Error("debía calcular");
    const c = r.correspondencias.find((x) => x.origen === "Camino de vida")!;
    expect(c.numeroSefira).toBe(4);
    expect(c.sefira.nombre).toBe("Jésed");
    expect(c.nota).toContain("22");
  });

  it("sin letras hebreas no inventa nada", () => {
    expect(calcularCabala({ hebreo: "Ana" }).ok).toBe(false);
  });

  it("reducción visible", () => {
    expect(reducirCabala(376)).toEqual({
      valor: 7,
      pasos: [
        { descripcion: "Reducción", operacion: "3 + 7 + 6 = 16" },
        { descripcion: "Reducción", operacion: "1 + 6 = 7" },
      ],
    });
  });
});
