// Pruebas con modelos locales reales (OCR y embeddings). La primera ejecución
// descarga los modelos a .cache/modelos (~150 MB); después funcionan sin red.
import { describe, expect, it } from "vitest";
import { crearEmbeddingsLocales, DIMENSIONES } from "./embeddings";
import { ErrorRequiereOcr, extraerDocumento } from "./extraer";
import { pdfEscaneadoDemo, pngDemo } from "./pruebas/documentos-demo";

const coseno = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

describe("modelos locales", () => {
  it("OCR en español de una imagen de demostración", { timeout: 180_000 }, async () => {
    const d = await extraerDocumento("png", pngDemo());
    expect(d.markdown.toLowerCase()).toContain("ciclo");
    expect(d.segmentos[0].ocrConfianza).toBeGreaterThan(0.5);
  });

  it("PDF escaneado: OCR por página, sin figura duplicada", { timeout: 180_000 }, async () => {
    const d = await extraerDocumento("pdf", await pdfEscaneadoDemo());
    expect(d.segmentos).toHaveLength(1);
    expect(d.segmentos[0].texto.toLowerCase()).toContain("ciclo");
    expect(d.segmentos[0].localizador.paginaArchivo).toBe(1);
    expect(d.segmentos[0].ocrConfianza).toBeGreaterThan(0.5);
    expect(d.figuras).toHaveLength(0);
    expect(d.metodo).toContain("OCR");
  });

  it("sin OCR permitido (app en Vercel), el PDF escaneado y las imágenes se ceden al worker", async () => {
    await expect(extraerDocumento("pdf", await pdfEscaneadoDemo(), undefined, { permitirOcr: false })).rejects.toBeInstanceOf(ErrorRequiereOcr);
    await expect(extraerDocumento("png", pngDemo(), undefined, { permitirOcr: false })).rejects.toBeInstanceOf(ErrorRequiereOcr);
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
