/**
 * Credencial temporal para el worker de ingesta en GitHub Actions (ver docs/biblioteca.md).
 * El workflow presenta su token OIDC de GitHub; si viene del workflow de tareas en `main`
 * del repositorio autorizado, se devuelve un JWT de servicio que caduca en 3 horas.
 * Así no hace falta guardar la llave de servicio como secreto de Actions.
 *
 *   POST /functions/v1/credencial-worker   Authorization: Bearer <token OIDC, audience circulo-nueve-worker>
 *
 * Secretos de la función (no van en el repositorio):
 *   CN_JWT_LEGADO          secreto JWT del proyecto (HS256), con el que se firma el token.
 *   CN_WORKER_REPOSITORIO  «propietario/repo» autorizado.
 *   CN_WORKER_REPO_ID      id numérico del repositorio (evita que otro repo con el mismo nombre lo suplante).
 * Se despliega con verify_jwt = false: quien llama no tiene sesión de Supabase.
 */
import { createRemoteJWKSet, jwtVerify, SignJWT } from "npm:jose@5";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMISOR = "https://token.actions.githubusercontent.com";
const AUDIENCIA = "circulo-nueve-worker";
const WORKFLOWS = [".github/workflows/circulo-nueve-tareas.yml", ".github/workflows/tareas.yml"];
const EVENTOS = ["schedule", "workflow_dispatch", "push"];
const DURACION_S = 3 * 60 * 60;
const claves = createRemoteJWKSet(new URL(`${EMISOR}/.well-known/jwks`));

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "método no permitido" }, 405);
  const repositorio = Deno.env.get("CN_WORKER_REPOSITORIO");
  const repoId = Deno.env.get("CN_WORKER_REPO_ID");
  const secreto = Deno.env.get("CN_JWT_LEGADO");
  if (!repositorio || !repoId || !secreto) return json({ ok: false, error: "función sin configurar" }, 503);

  const oidc = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!oidc) return json({ ok: false, error: "no autorizado" }, 401);
  let c: Record<string, unknown>;
  try {
    ({ payload: c } = await jwtVerify(oidc, claves, { issuer: EMISOR, audience: AUDIENCIA }));
  } catch {
    return json({ ok: false, error: "no autorizado" }, 401);
  }
  const permitido =
    c.repository === repositorio &&
    String(c.repository_id) === repoId &&
    c.ref === "refs/heads/main" &&
    c.runner_environment === "github-hosted" &&
    EVENTOS.includes(String(c.event_name)) &&
    WORKFLOWS.some((w) => c.job_workflow_ref === `${repositorio}/${w}@refs/heads/main`);
  if (!permitido) {
    console.warn("credencial-worker rechazada", { repository: c.repository, ref: c.ref, workflow: c.job_workflow_ref, evento: c.event_name });
    return json({ ok: false, error: "no autorizado" }, 403);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const ref = new URL(url).hostname.split(".")[0];
  const ahora = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ role: "service_role", ref, iss: "supabase", worker_run: String(c.run_id ?? "") })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(ahora)
    .setExpirationTime(ahora + DURACION_S)
    .sign(new TextEncoder().encode(secreto));

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: pendientes } = await admin.rpc("trabajos_ingesta_pendientes");
  console.log("credencial-worker emitida", { run: c.run_id, evento: c.event_name });
  return json({ ok: true, url, llave_publica: Deno.env.get("SUPABASE_ANON_KEY"), token, caduca: ahora + DURACION_S, pendientes: pendientes ?? null });
});
