/**
 * Credencial temporal para el worker de ingesta de la DGX Spark (ver docs/biblioteca.md).
 * La Spark presenta su secreto; si su SHA-256 coincide con una fila activa de
 * `worker_credenciales`, se devuelve un JWT de servicio que caduca en 6 horas
 * (una transcripción larga puede durar varias horas).
 *
 *   POST /functions/v1/credencial-spark   x-worker-nombre: dgx-spark   x-worker-secreto: <secreto>
 *
 * Secretos de la función: CN_JWT_LEGADO (el mismo de credencial-worker).
 * Se despliega con verify_jwt = false: quien llama no tiene sesión de Supabase.
 */
import { SignJWT } from "npm:jose@5";
import { createClient } from "npm:@supabase/supabase-js@2";

const DURACION_S = 6 * 60 * 60;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

async function sha256(texto: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function igualesEnTiempoConstante(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "método no permitido" }, 405);
  const secretoJwt = Deno.env.get("CN_JWT_LEGADO");
  if (!secretoJwt) return json({ ok: false, error: "función sin configurar" }, 503);
  const nombre = req.headers.get("x-worker-nombre") ?? "";
  const secreto = req.headers.get("x-worker-secreto") ?? "";
  if (!/^[a-z0-9-]{3,40}$/.test(nombre) || secreto.length < 32) return json({ ok: false, error: "no autorizado" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: fila } = await admin.from("worker_credenciales").select("huella_sha256, activa").eq("nombre", nombre).maybeSingle();
  if (!fila?.activa || !igualesEnTiempoConstante(fila.huella_sha256, await sha256(secreto))) {
    console.warn("credencial-spark rechazada", { nombre });
    return json({ ok: false, error: "no autorizado" }, 403);
  }
  await admin.from("worker_credenciales").update({ ultimo_uso_at: new Date().toISOString() }).eq("nombre", nombre);

  const ref = new URL(url).hostname.split(".")[0];
  const ahora = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ role: "service_role", ref, iss: "supabase", worker: nombre })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(ahora)
    .setExpirationTime(ahora + DURACION_S)
    .sign(new TextEncoder().encode(secretoJwt));
  return json({ ok: true, url, llave_publica: Deno.env.get("SUPABASE_ANON_KEY"), token, caduca: ahora + DURACION_S });
});
