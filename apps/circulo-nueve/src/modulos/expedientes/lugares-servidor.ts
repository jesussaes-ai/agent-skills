import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { aLugarNacimiento, type CatalogoLugares, type LugarNacimiento } from "@/modulos/calculo/astrologia";

let catalogo: Promise<CatalogoLugares> | null = null;

/** Lee del disco el mismo catálogo GeoNames que usa el navegador (incluido en las trazas del servidor). */
function cargar(): Promise<CatalogoLugares> {
  catalogo ??= readFile(join(process.cwd(), "public/datos/lugares-geonames.json"), "utf8").then((t) => JSON.parse(t) as CatalogoLugares);
  catalogo.catch(() => (catalogo = null));
  return catalogo;
}

/** Resuelve en el servidor un id de GeoNames; no se fía de las coordenadas que mande el cliente. */
export async function lugarPorGeonameId(id: number): Promise<LugarNacimiento | null> {
  const c = await cargar();
  const fila = c.lugares.find((f) => f[0] === id);
  return fila ? aLugarNacimiento(fila, c) : null;
}
