/**
 * Borra los documentos cuya fecha de retención ya pasó: primero el archivo del
 * almacenamiento privado y después su registro. Pensado para ejecutarse a diario
 * (cron del hosting o tarea programada) con la llave de servicio.
 *
 *   npm run retencion:purgar            # borra
 *   npm run retencion:purgar -- --simular   # solo lista lo que borraría
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !llave) {
  process.stderr.write("Error: faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n");
  process.exit(1);
}
const simular = process.argv.includes("--simular");
const admin = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });

let borrados = 0;
for (let ronda = 0; ronda < 100; ronda++) {
  const { data: vencidos, error } = await admin.rpc("documentos_vencidos", { p_limite: 200 });
  if (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  }
  const lista = (vencidos ?? []) as { id: string; storage_path: string }[];
  if (!lista.length) break;
  if (simular) {
    for (const d of lista) process.stderr.write(`Vencido: ${d.id}\n`);
    borrados = lista.length;
    break;
  }
  const { error: errorArchivos } = await admin.storage.from("expedientes").remove(lista.map((d) => d.storage_path));
  if (errorArchivos) {
    process.stderr.write(`Error al borrar archivos: ${errorArchivos.message}\n`);
    process.exit(1);
  }
  const ids = lista.map((d) => d.id);
  await admin.from("documents").delete().in("id", ids);
  await admin.from("audit_log").insert(ids.map((id) => ({ accion: "purga_retencion", recurso_tipo: "documents", recurso_id: id })));
  borrados += ids.length;
}

process.stderr.write(`${simular ? "Se borrarían" : "Documentos purgados"}: ${borrados}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, simulado: simular, documentos: borrados })}\n`);
