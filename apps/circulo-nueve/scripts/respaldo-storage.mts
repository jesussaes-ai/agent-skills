/**
 * Descarga todos los objetos de los buckets privados a una carpeta local
 * (lo usa scripts/respaldo.sh). Requiere la llave de servicio.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const destino = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!destino || !url || !llave) {
  process.stderr.write("Uso: tsx scripts/respaldo-storage.mts <carpeta> (con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)\n");
  process.exit(1);
}
const db = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKETS = ["expedientes", "biblioteca-originales", "biblioteca-derivados"];

async function recorrer(bucket: string, prefijo: string): Promise<string[]> {
  const rutas: string[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefijo, { limit: 1000, offset: desde });
    if (error) throw new Error(`${bucket}/${prefijo}: ${error.message}`);
    for (const o of data ?? []) {
      const ruta = prefijo ? `${prefijo}/${o.name}` : o.name;
      if (o.id === null) rutas.push(...(await recorrer(bucket, ruta)));
      else rutas.push(ruta);
    }
    if ((data ?? []).length < 1000) return rutas;
  }
}

let total = 0;
for (const bucket of BUCKETS) {
  for (const ruta of await recorrer(bucket, "")) {
    const { data, error } = await db.storage.from(bucket).download(ruta);
    if (error || !data) throw new Error(`No se pudo descargar ${bucket}/${ruta}`);
    const archivo = join(destino, bucket, ruta);
    await mkdir(dirname(archivo), { recursive: true });
    await writeFile(archivo, Buffer.from(await data.arrayBuffer()));
    total++;
  }
}
process.stderr.write(`Archivos descargados: ${total}\n`);
