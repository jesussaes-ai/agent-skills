import { describe, expect, it } from "vitest";
import { calcularNumerologia } from "@/modulos/calculo/numerologia";
import { reporteDeNumerologia } from "./adaptadores/numerologia";
import { DESCRIPCIONES } from "./contenido/descripciones";
import { PENSAMIENTOS, pensamientoDe } from "./contenido/pensamientos";
import { datosMuestraNumerologia } from "./demo/muestra-numerologia";
import { generarReportePdf } from "./generar";
import { calcularProporcion } from "./proporcion";
import type { TipoReporte } from "./tipos";

const TIPOS = Object.keys(PENSAMIENTOS) as TipoReporte[];
const DETERMINISTA = /\b(sin duda|siempre ser[áa]s|tu destino es|est[áa]s destinad|nunca podr[áa]s|ocurrir[áa])\b/i;

describe("contenido editorial", () => {
  it("cada tipo tiene descripción y entre 5 y 8 pensamientos con un recomendado válido", () => {
    for (const tipo of TIPOS) {
      const { lista, recomendado } = PENSAMIENTOS[tipo];
      expect(DESCRIPCIONES[tipo].descripcion.length).toBeGreaterThan(40);
      expect(lista.length).toBeGreaterThanOrEqual(5);
      expect(lista.length).toBeLessThanOrEqual(8);
      expect(lista.some((p) => p.id === recomendado)).toBe(true);
      expect(pensamientoDe(tipo).id).toBe(recomendado);
    }
  });

  it("las citas de dominio público llevan autor y referencia localizable; las propias son de Círculo Nueve", () => {
    const todos = TIPOS.flatMap((t) => PENSAMIENTOS[t].lista);
    expect(new Set(todos.map((p) => p.id)).size).toBe(todos.length);
    for (const p of todos) {
      if (p.origen === "dominio-publico") {
        expect(p.autor).not.toBe("Círculo Nueve");
        expect(p.referencia).toBeTruthy();
      } else {
        expect(p.autor).toBe("Círculo Nueve");
      }
    }
  });

  it("no usa lenguaje determinista", () => {
    const textos = [...TIPOS.flatMap((t) => PENSAMIENTOS[t].lista.map((p) => p.texto)), ...TIPOS.map((t) => DESCRIPCIONES[t].descripcion)];
    for (const t of textos) expect(t).not.toMatch(DETERMINISTA);
  });

  it("falla con un pensamiento desconocido en vez de inventar uno", () => {
    expect(() => pensamientoDe("tarot", "no-existe")).toThrow();
  });
});

describe("proporción de fuentes", () => {
  const fuentes = [
    { id: "a", titulo: "A", referencia: "r", grupo: "aportada" as const },
    { id: "c", titulo: "C", referencia: "r", grupo: "complementaria" as const },
  ];
  const interp = (citas: { fuenteId: string; pagina: string }[]) => ({
    titulo: "t",
    origen: "tradicional" as const,
    parrafos: [],
    citas: citas.map((c) => ({ fuenteId: c.fuenteId, localizador: { paginaImpresa: c.pagina }, tipo: "parafrasis" as const })),
  });

  it("no cuenta dos veces el mismo fragmento", () => {
    const p = calcularProporcion({
      fuentes,
      interpretaciones: [interp([{ fuenteId: "a", pagina: "1" }, { fuenteId: "a", pagina: "1" }]), interp([{ fuenteId: "a", pagina: "1" }, { fuenteId: "c", pagina: "9" }])],
    });
    expect(p).toMatchObject({ aportadas: 1, complementarias: 1, total: 2, proporcionAportadas: 0.5, cumpleObjetivo: false });
  });

  it("sin citas no hay proporción ni cumplimiento", () => {
    const p = calcularProporcion({ fuentes, interpretaciones: [interp([])] });
    expect(p.proporcionAportadas).toBeNull();
    expect(p.cumpleObjetivo).toBeNull();
  });

  it("rechaza citas a fuentes no declaradas", () => {
    expect(() => calcularProporcion({ fuentes, interpretaciones: [interp([{ fuenteId: "x", pagina: "1" }])] })).toThrow();
  });

  it("la muestra cumple el objetivo 80/20", () => {
    const p = calcularProporcion(datosMuestraNumerologia());
    expect(p.proporcionAportadas).toBeGreaterThanOrEqual(0.8);
  });
});

describe("adaptador de numerología", () => {
  it("conserva valores y pasos del motor", () => {
    const r = calcularNumerologia({ nombre: "Ana María Núñez", fecha: "1990-07-15" });
    if (!r.ok) throw new Error("caso de referencia inválido");
    const rep = reporteDeNumerologia(r);
    expect(rep.calculos.map((c) => [c.titulo, c.valor])).toEqual([
      ["Camino de vida", "5"],
      ["Expresión (destino)", "3"],
      ["Alma (impulso del alma)", "3"],
      ["Personalidad", "9"],
    ]);
    expect(rep.calculos[0].pasos.length).toBe(r.indicadores.find((i) => i.clave === "caminoDeVida")!.pasos.length);
    expect(rep.limites[0]).toContain(r.reglasVersion);
  });
});

describe("PDF", () => {
  it("genera un PDF válido de la muestra marcada como demostración", async () => {
    const datos = datosMuestraNumerologia();
    expect(datos.demostracion).toBe(true);
    const pdf = await generarReportePdf(datos);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
  }, 20_000);
});
