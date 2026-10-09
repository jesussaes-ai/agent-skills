// Pruebas con modelos locales reales (OCR y embeddings). La primera ejecución
// descarga los modelos a .cache/modelos (~150 MB); después funcionan sin red.
import { describe, expect, it } from "vitest";
import { crearEmbeddingsLocales, DIMENSIONES } from "./embeddings";
import { extraerDocumento } from "./extraer";
import { pngDemo } from "./pruebas/documentos-demo";

const coseno = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

describe("modelos locales", () => {
  it("OCR en español de una imagen de demostración", { timeout: 180_000 }, async () => {
    const d = await extraerDocumento("png", pngDemo());
    expect(d.markdown.toLowerCase()).toContain("ciclo");
    expect(d.segmentos[0].ocrConfianza).toBeGreaterThan(0.5);
  });

  it("embeddings multilingües: 384 dimensiones y orden por relevancia", { timeout: 300_000 }, async () => {
    const e = crearEmbeddingsLocales();
    const [relevante, ajeno] = await e.embeberPasajes([
      "El camino de vida se calcula a partir de la fecha de nacimiento.",
      "La receta de la sopa lleva tomate y cebolla.",
    ]);
    const consulta = await e.embeberConsulta("¿Cómo se calcula el camino de vida?");
    expect(consulta).toHaveLength(DIMENSIONES);
    expect(coseno(consulta, relevante)).toBeGreaterThan(coseno(consulta, ajeno));
  });
});
