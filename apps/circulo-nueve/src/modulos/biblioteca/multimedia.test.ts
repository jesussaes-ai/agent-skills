import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { extraerDocumento } from "./extraer";
import { describirConVision, describirSinVision } from "./figuras";
import { detectarFormato, revisarContenidoActivo } from "./formatos";
import { hojaASegmentos, indiceColumna, letraColumna } from "./hojas";
import { antivirus } from "./ingesta";
import { agruparTranscripcion, marcaTiempo } from "./multimedia";
import { CSV_DEMO, EICAR, audioDemo, odsDemo, pdfConFiguraDemo, pptxDemo, videoDemo, xlsxDemo } from "./pruebas/documentos-demo";

const hayClamav = (() => {
  try {
    execFileSync("clamscan", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();
const hayFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
})();

describe("hojas de cálculo", () => {
  it("convierte letras de columna", () => {
    expect([0, 25, 26, 701].map(letraColumna)).toEqual(["A", "Z", "AA", "ZZ"]);
    expect(indiceColumna("AA")).toBe(26);
  });

  it("parte en bloques sin cortar filas y repite el encabezado", () => {
    const filas = [["n", "v"], ...Array.from({ length: 65 }, (_, i) => [String(i), `v${i}`])];
    const { segmentos } = hojaASegmentos("Datos", filas);
    expect(segmentos.map((s) => s.localizador.celda)).toEqual(["A2:B31", "A32:B61", "A62:B66"]);
    expect(segmentos.every((s) => s.texto.includes("| n | v |"))).toBe(true);
  });

  it("XLSX: hoja, celdas y texto compartido", async () => {
    const x = await xlsxDemo();
    expect(await detectarFormato(x, "tabla.xlsx")).toMatchObject({ ok: true, formato: "xlsx" });
    const d = await extraerDocumento("xlsx", x);
    expect(d.segmentos[0].localizador).toEqual({ hoja: "Tabla ficticia", celda: "A2:B3" });
    expect(d.markdown).toContain("| 9 | Cierre de ciclo |");
    expect((await revisarContenidoActivo("xlsx", await xlsxDemo({ conMacros: true }))).rechazar).toBe(true);
  });

  it("ODS: celdas repetidas sin explotar el tamaño", async () => {
    const o = await odsDemo();
    expect(await detectarFormato(o, "tabla.ods")).toMatchObject({ ok: true, formato: "ods" });
    const d = await extraerDocumento("ods", o);
    expect(d.segmentos).toHaveLength(1);
    expect(d.segmentos[0].localizador.hoja).toBe("Correspondencias");
    expect(d.markdown).toContain("| Luna | 2 |");
  });

  it("CSV: el nombre del archivo es la hoja", async () => {
    const c = new TextEncoder().encode(CSV_DEMO);
    expect(await detectarFormato(c, "numeros.csv")).toMatchObject({ ok: true, formato: "csv" });
    const d = await extraerDocumento("csv", c, "numeros.csv");
    expect(d.segmentos[0].localizador).toEqual({ hoja: "numeros", celda: "A2:C4" });
  });
});

describe("presentaciones", () => {
  it("PPTX: texto y notas por diapositiva en orden", async () => {
    const p = await pptxDemo();
    expect(await detectarFormato(p, "curso.pptx")).toMatchObject({ ok: true, formato: "pptx" });
    const d = await extraerDocumento("pptx", p);
    expect(d.segmentos.map((s) => s.localizador.diapositiva)).toEqual([1, 2]);
    expect(d.segmentos[1].texto).toContain("Notas: Nota del ponente ficticio");
    expect(d.segmentos[1].jerarquia).toEqual(["El número siete"]);
  });
});

describe("figuras de PDF", () => {
  it("extrae la imagen incrustada con su leyenda y página", async () => {
    const d = await extraerDocumento("pdf", await pdfConFiguraDemo());
    expect(d.figuras).toHaveLength(1);
    expect(d.figuras![0]).toMatchObject({ numero: 1, pagina: 1, leyenda: "Figura 1. Diagrama ficticio del ciclo del nueve (DEMO)" });
    expect(Buffer.from(d.figuras![0].png.subarray(1, 4)).toString()).toBe("PNG");
  });

  it("sin visión, la descripción sale de la leyenda y el OCR y lo dice", () => {
    const r = describirSinVision({ numero: 2, pagina: 5, leyenda: "Figura 2. Esquema", ocr: "ciclo  nueve", confianzaOcr: 0.91 });
    expect(r.modelo).toBe("plantilla-leyenda-ocr-v1");
    expect(r.descripcion).toContain("Leyenda: «Figura 2. Esquema»");
    expect(r.descripcion).toContain("confianza 91 %");
    expect(r.descripcion).toContain("no se usó un modelo de visión");
  });

  it("con visión envía la imagen como image_url, neutraliza enlaces y registra el consumo", async () => {
    let cuerpo: { messages: { content: unknown }[] } | undefined;
    const registros: { codigo: string }[] = [];
    const r = await describirConVision(
      new Uint8Array([137, 80, 78, 71]),
      {
        proveedor: {
          id: "vision", tipo: "openai_compatible", nombre: "Visión de prueba", endpoint: "http://vision.invalid/v1", modelo: "vlm-demo", modelosAlternos: [],
          destinatarios: "prueba", capacidades: { json: false, herramientas: false, vision: true, audio: false },
          politicaDatos: { permiteDatosReales: false, descripcion: "" }, limites: { maxTokensSalida: 300, tiempoMaximoMs: 5000, reintentos: 0 },
          costo: { entradaUsdPorMillon: 0, salidaUsdPorMillon: 0 }, activo: true, prioridad: 1, origen: "base-de-datos",
        },
        llave: "llave",
      },
      { leyenda: "Figura 1" },
      {
        fetch: (async (_u: string, init: RequestInit) => {
          cuerpo = JSON.parse(String(init.body));
          return new Response(JSON.stringify({ model: "vlm-demo", choices: [{ message: { content: "Un diagrama circular con nueve puntos. Más en https://x.invalid" } }] }));
        }) as typeof fetch,
        registrar: async (x) => {
          registros.push(x);
        },
      },
    );
    expect(JSON.stringify(cuerpo?.messages[1].content)).toContain("data:image/png;base64,");
    expect(r.descripcion).toContain("[enlace omitido]");
    expect(r.descripcion).toContain("Descripción generada por Visión de prueba");
    expect(registros[0].codigo).toBe("ok");
  });
});

describe("audio y video", () => {
  it("marcas de tiempo y agrupación por minuto", () => {
    expect([0, 65, 3725].map(marcaTiempo)).toEqual(["00:00", "01:05", "1:02:05"]);
    const s = agruparTranscripcion(
      [
        { timestamp: [0, 30], text: " Uno." },
        { timestamp: [30, 59], text: " Dos." },
        { timestamp: [61, 70], text: " Tres." },
      ],
      70,
    );
    expect(s.map((x) => x.localizador.marcaTiempo)).toEqual(["00:00–00:59", "01:01–01:10"]);
  });

  it("detecta audio y video por su contenido", async () => {
    expect(await detectarFormato(audioDemo(), "voz.wav")).toMatchObject({ ok: true, formato: "wav" });
    expect(await detectarFormato(videoDemo(), "clase.webm")).toMatchObject({ ok: true, formato: "webm" });
    expect((await detectarFormato(audioDemo(), "voz.mp3")).ok).toBe(false);
  });

  it.runIf(hayFfmpeg)("transcribe en local con marcas de tiempo (audio ficticio)", { timeout: 600_000 }, async () => {
    const d = await extraerDocumento("wav", audioDemo());
    expect(d.markdown.toLowerCase()).toMatch(/grabaci[oó]n ficticia/);
    expect(d.segmentos[0].localizador.marcaTiempo).toMatch(/^00:00–00:0\d$/);
  });

  it.runIf(hayFfmpeg)("del video transcribe el audio y lo advierte", { timeout: 600_000 }, async () => {
    const d = await extraerDocumento("webm", videoDemo());
    expect(d.markdown.toLowerCase()).toContain("ficticia");
    expect(d.advertencias.join(" ")).toContain("no se extraen fotogramas");
  });
});

describe("antivirus", () => {
  it("sin ClamAV: advierte, o rechaza si es obligatorio", async () => {
    const ausente = async () => {
      throw new Error("no existe");
    };
    expect(await antivirus(new Uint8Array([1]), { ejecutar: ausente })).toContain("no disponible");
    await expect(antivirus(new Uint8Array([1]), { ejecutar: ausente, obligatorio: true })).rejects.toThrow(/obligatorio/);
  });

  it("interpreta el código 1 de ClamAV como amenaza", async () => {
    const infectado = async (_p: string, a: string[]) => {
      if (a[0] === "--version") return { stdout: "ClamAV 1.5" };
      throw Object.assign(new Error("FOUND"), { code: 1, stdout: "/tmp/x: Eicar-Signature FOUND" });
    };
    await expect(antivirus(new Uint8Array([1]), { ejecutar: infectado })).rejects.toThrow(/Eicar-Signature/);
  });

  it.runIf(hayClamav)("ClamAV real detecta el archivo de prueba EICAR", { timeout: 120_000 }, async () => {
    await expect(antivirus(new TextEncoder().encode(EICAR))).rejects.toThrow(/malicioso/);
    expect(await antivirus(new TextEncoder().encode("texto ficticio limpio"))).toBeNull();
  });
});
