/**
 * Purga por retención dentro de Supabase (equivale a scripts/purgar-retencion.mts).
 * La llama pg_cron a diario con la llave pública y la cabecera x-purga-token, que se
 * compara con el secreto «cn_purga_token» de Vault. Ver docs/despliegue.md, paso 6.
 *
 *   POST /functions/v1/purga-retencion            # borra
 *   POST /functions/v1/purga-retencion?simular=1  # solo cuenta lo que borraría
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "método no permitido" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: valido } = await admin.rpc("purga_token_valido", { p_token: req.headers.get("x-purga-token") ?? "" });
  if (valido !== true) return json({ ok: false, error: "no autorizado" }, 401);

  const simular = new URL(req.url).searchParams.get("simular") === "1";
  let documentos = 0;
  for (let ronda = 0; ronda < 100; ronda++) {
    const { data: vencidos, error } = await admin.rpc("documentos_vencidos", { p_limite: 200 });
    if (error) return json({ ok: false, error: error.message }, 500);
    const lista = (vencidos ?? []) as { id: string; storage_path: string }[];
    if (!lista.length) break;
    if (simular) {
      documentos = lista.length;
      break;
    }
    const { error: errorArchivos } = await admin.storage.from("expedientes").remove(lista.map((d) => d.storage_path));
    if (errorArchivos) return json({ ok: false, error: `archivos: ${errorArchivos.message}` }, 500);
    const ids = lista.map((d) => d.id);
    await admin.from("documents").delete().in("id", ids);
    await admin.from("audit_log").insert(ids.map((id) => ({ accion: "purga_retencion", recurso_tipo: "documents", recurso_id: id })));
    documentos += ids.length;
  }

  let registros: Record<string, number> = {};
  if (!simular) {
    const { data, error } = await admin.rpc("purgar_registros_vencidos");
    if (error) return json({ ok: false, error: `registros: ${error.message}` }, 500);
    registros = (data ?? {}) as Record<string, number>;
  }
  return json({ ok: true, simulado: simular, documentos, ...registros });
});
