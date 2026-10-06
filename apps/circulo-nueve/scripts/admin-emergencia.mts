/**
 * Recuperación de emergencia de la administración (ver docs/recuperacion-emergencia.md).
 *
 *   npm run admin:emergencia -- --correo persona@dominio --motivo "Texto del motivo" [--quitar-mfa] [--crear]
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno de
 * quien lo ejecuta (nunca en el navegador). Deja la acción en la auditoría.
 */
import { createClient } from "@supabase/supabase-js";

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const bandera = (nombre: string) => process.argv.includes(`--${nombre}`);
const fallar = (mensaje: string): never => {
  process.stderr.write(`Error: ${mensaje}\n`);
  process.exit(1);
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const sitio = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://127.0.0.1:3000").replace(/\/+$/, "");
const correo = argumento("correo")?.trim().toLowerCase();
const motivo = argumento("motivo")?.trim();

if (!url || !llave) fallar("faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
if (!correo) fallar("indica --correo.");
if (!motivo || motivo.length < 10) fallar('indica --motivo "…" (mínimo 10 caracteres).');

const admin = createClient(url!, llave!, { auth: { persistSession: false, autoRefreshToken: false } });

async function buscarUsuario(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fallar(`no se pudo listar cuentas (${error.message}).`);
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

let usuario = await buscarUsuario(correo!);
const pasos: string[] = [];

if (!usuario) {
  if (!bandera("crear")) fallar("no existe una cuenta con ese correo. Usa --crear para invitarla.");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(correo!, { redirectTo: `${sitio}/cuenta/contrasena` });
  if (error || !data.user) fallar(`no se pudo invitar (${error?.message}).`);
  usuario = data.user;
  pasos.push("invitación enviada");
}

const { error: errorBan } = await admin.auth.admin.updateUserById(usuario!.id, { ban_duration: "none" });
if (errorBan) fallar(`no se pudo desbloquear la cuenta (${errorBan.message}).`);
pasos.push("cuenta desbloqueada en Auth");

if (bandera("quitar-mfa")) {
  const { data: factores } = await admin.auth.admin.mfa.listFactors({ userId: usuario!.id });
  for (const f of factores?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId: usuario!.id, id: f.id });
  }
  pasos.push(`factores de verificación eliminados: ${factores?.factors?.length ?? 0}`);
}

const { error: errorRpc } = await admin.rpc("recuperacion_emergencia_admin", { p_user_id: usuario!.id, p_motivo: motivo });
if (errorRpc) fallar(`no se pudo asignar la administración (${errorRpc.message}).`);
pasos.push("rol admin asignado, cuenta activa y acción auditada");

if (pasos[0] !== "invitación enviada") {
  const { error } = await admin.auth.resetPasswordForEmail(correo!, { redirectTo: `${sitio}/cuenta/contrasena` });
  pasos.push(error ? `no se pudo enviar el correo de recuperación (${error.message})` : "correo de recuperación enviado");
}

process.stderr.write(`Recuperación de emergencia completada para ${correo}:\n- ${pasos.join("\n- ")}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, usuarioId: usuario!.id, pasos })}\n`);
