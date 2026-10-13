import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SECCIONES_AYUDA } from "@/content/ayuda";

const RAIZ = join(__dirname, "..");
const PERMITIDOS = new Set(["ui/componentes/Boton.tsx", "ui/componentes/EnlaceBoton.tsx"]);

function archivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivosTsx(ruta) : n.endsWith(".tsx") ? [ruta] : [];
  });
}

const archivos = archivosTsx(RAIZ).map((ruta) => ({
  ruta: relative(RAIZ, ruta).replaceAll("\\", "/"),
  codigo: readFileSync(ruta, "utf8"),
}));

describe("convenciones de la interfaz", () => {
  it("todos los botones y enlaces pasan por Boton/EnlaceBoton (con descripción obligatoria)", () => {
    const infractores = archivos
      .filter((a) => !PERMITIDOS.has(a.ruta))
      .filter((a) => /<(button|a|Link|summary)[\s>]/.test(a.codigo))
      .map((a) => a.ruta);
    expect(infractores).toEqual([]);
  });

  it("ningún Boton o EnlaceBoton tiene descripción vacía", () => {
    for (const a of archivos) {
      expect(a.codigo, a.ruta).not.toMatch(/descripcion=(""|\{""\}|\{``\})/);
    }
  });

  it("cada ayuda contextual apunta a una sección existente", () => {
    const ids = new Set(SECCIONES_AYUDA.map((s) => s.id));
    const usados = archivos.flatMap((a) => [...a.codigo.matchAll(/\b(?:ayuda|seccion)="([^"]+)"/g)].map((m) => m[1]));
    expect(usados.length).toBeGreaterThan(0);
    for (const id of usados) expect(ids.has(id), id).toBe(true);
  });
});

describe("contenido de ayuda", () => {
  it("tiene ids únicos y todos los campos rellenos", () => {
    const ids = SECCIONES_AYUDA.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SECCIONES_AYUDA) {
      expect(s.titulo && s.resumen && s.deQueTrata, s.id).toBeTruthy();
      expect(s.datosQueUsa.length && s.comoSeUsa.length && s.palabrasClave.length, s.id).toBeTruthy();
      expect(["disponible", "demo", "pendiente"]).toContain(s.estado);
    }
  });
});
