// Regenera src/content/ayuda/guia-botones.json con las descripciones de todos los botones.
// Uso: npx tsx scripts/generar-guia-botones.mts   (la prueba de la interfaz avisa si quedó vieja)
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { armarGuia } from "../src/modulos/ayuda/guia-botones";

const SRC = join(import.meta.dirname, "..", "src");
const tsx = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? tsx(ruta) : n.endsWith(".tsx") ? [ruta] : [];
  });
const archivos = tsx(SRC).map((r) => ({ ruta: relative(SRC, r).replaceAll("\\", "/"), codigo: readFileSync(r, "utf8") }));
const guia = armarGuia(archivos);
writeFileSync(join(SRC, "content", "ayuda", "guia-botones.json"), `${JSON.stringify(guia, null, 2)}\n`);
console.log(`Guía de botones: ${guia.reduce((n, g) => n + g.botones.length, 0)} botones en ${guia.length} pantallas.`);
