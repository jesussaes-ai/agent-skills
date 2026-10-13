/**
 * Sube a Storage los archivos de un respaldo descomprimido (carpeta «storage» de
 * scripts/respaldo.sh). No sobrescribe objetos existentes. Requiere la llave de servicio.
 *
 *   npx tsx scripts/restaurar-storage.mts ~/respaldos-circulo-nueve/respaldo-AAAAMMDD-HHMM/storage
 */
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";

const origen = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!origen || !url || !llave) {
  process.stderr.write("Uso: tsx scripts/restaurar-storage.mts <carpeta storage> (con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)\n");
  process.exit(1);
}
const db = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });

async function archivos(carpeta: string): Promise<string[]> {
  const entradas = await readdir(carpeta, { withFileTypes: true });
  const lista = await Promise.all(entradas.map((e) => (e.isDirectory() ? archivos(join(carpeta, e.name)) : [join(carpeta, e.name)])));
  return lista.flat();
}

let subidos = 0;
let omitidos = 0;
for (const archivo of await archivos(origen)) {
  const [bucket, ...resto] = relative(origen, archivo).split(/[\\/]/);
  const { error } = await db.storage.from(bucket).upload(resto.join("/"), await readFile(archivo), { upsert: false });
  if (error && /exists/i.test(error.message)) omitidos++;
  else if (error) throw new Error(`${bucket}/${resto.join("/")}: ${error.message}`);
  else subidos++;
}
process.stderr.write(`Subidos: ${subidos} · ya existían: ${omitidos}\n`);
