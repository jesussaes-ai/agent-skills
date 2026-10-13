// Genera public/datos/lugares-geonames.json a partir de los volcados públicos de
// GeoNames (CC BY 4.0, https://www.geonames.org/). Incluye todas las ciudades
// del mundo con ≥15 000 habitantes y las de México con ≥1 000.
//
// Uso: node scripts/generar-lugares.mjs [carpeta-de-descarga]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://download.geonames.org/export/dump/";
const carpeta = process.argv[2] ?? "/tmp/geonames";
mkdirSync(carpeta, { recursive: true });

async function descargar(nombre) {
  const ruta = join(carpeta, nombre);
  if (!existsSync(ruta)) {
    const r = await fetch(BASE + nombre);
    if (!r.ok) throw new Error(`No se pudo descargar ${nombre}: HTTP ${r.status}`);
    writeFileSync(ruta, Buffer.from(await r.arrayBuffer()));
  }
  if (nombre.endsWith(".zip")) execFileSync("unzip", ["-oq", ruta, "-d", carpeta]);
  return join(carpeta, nombre.replace(".zip", ".txt"));
}

const normalizar = (s) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const esLatino = (s) => /^[\p{Script=Latin}\p{M} .'’-]+$/u.test(s);

const filas = (ruta) =>
  readFileSync(ruta, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("\t"));

const admin1 = new Map(filas(await descargar("admin1CodesASCII.txt")).map((c) => [c[0], c[1]]));
const mundo = filas(await descargar("cities15000.zip"));
const mexico = filas(await descargar("cities1000.zip")).filter((c) => c[8] === "MX");

const vistos = new Set();
const lugares = [];
for (const c of [...mundo, ...mexico]) {
  const id = Number(c[0]);
  if (vistos.has(id)) continue;
  vistos.add(id);
  const [nombre, ascii, alternos] = [c[1], c[2], c[3]];
  const poblacion = Number(c[14]) || 0;
  const principal = normalizar(nombre);
  const claves = new Set([normalizar(ascii)]);
  // Los exónimos (p. ej. «Ciudad de México», «Nueva York») solo importan en ciudades grandes.
  if (poblacion >= 200_000) {
    for (const a of alternos ? alternos.split(",") : []) {
      if (a.length > 3 && a.length < 40 && esLatino(a)) claves.add(normalizar(a));
    }
  }
  claves.delete(principal);
  lugares.push([
    id,
    nombre,
    [...claves].filter(Boolean).join("|"),
    admin1.get(`${c[8]}.${c[10]}`) ?? "",
    c[8],
    Number(Number(c[4]).toFixed(4)),
    Number(Number(c[5]).toFixed(4)),
    c[17],
    poblacion,
  ]);
}
lugares.sort((a, b) => b[8] - a[8]);

const salida = {
  fuente: "GeoNames",
  licencia: "CC BY 4.0",
  atribucion: "Datos de lugares: GeoNames (geonames.org), licencia CC BY 4.0.",
  descargado: new Date().toISOString().slice(0, 10),
  cobertura: "Ciudades del mundo con ≥15 000 habitantes (cities15000) y de México con ≥1 000 (cities1000).",
  campos: ["geonameId", "nombre", "otrosNombres", "region", "pais", "latitud", "longitud", "zonaHoraria", "poblacion"],
  lugares,
};
const destino = fileURLToPath(new URL("../public/datos/lugares-geonames.json", import.meta.url));
mkdirSync(fileURLToPath(new URL("../public/datos/", import.meta.url)), { recursive: true });
writeFileSync(destino, JSON.stringify(salida));
console.error(`Escrito ${destino}: ${lugares.length} lugares.`);
