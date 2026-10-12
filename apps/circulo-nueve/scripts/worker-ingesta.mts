/**
 * Worker de ingesta de la biblioteca (ver docs/biblioteca.md).
 *
 *   npm run ingesta:worker               # procesa los pendientes y termina
 *   npm run ingesta:worker -- --continuo # sigue esperando trabajos (cada 10 s)
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, o bien
 * SUPABASE_WORKER_TOKEN con NEXT_PUBLIC_SUPABASE_ANON_KEY (GitHub Actions).
 * INGESTA_MAX_MINUTOS: no empieza trabajos nuevos pasado ese tiempo (el token caduca).
 */
import { clienteServicio, procesarSiguiente } from "../src/modulos/biblioteca/ingesta.ts";

const continuo = process.argv.includes("--continuo");
const maxMinutos = Number(process.env.INGESTA_MAX_MINUTOS) || Infinity;
const inicio = Date.now();
const db = clienteServicio();
let procesados = 0;

while ((Date.now() - inicio) / 60_000 < maxMinutos) {
  const r = await procesarSiguiente(db);
  if (r) {
    procesados++;
    process.stderr.write(`[${r.estado}] ${r.etapa} ${r.fuenteId}: ${r.mensaje}\n`);
    continue;
  }
  if (!continuo) break;
  await new Promise((res) => setTimeout(res, 10_000));
}
process.stdout.write(`${JSON.stringify({ ok: true, procesados })}\n`);
