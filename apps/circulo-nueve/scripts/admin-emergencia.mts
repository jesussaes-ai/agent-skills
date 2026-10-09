/**
 * Recuperación de emergencia de la administración (ver docs/recuperacion-emergencia.md).
 *
 *   npm run admin:emergencia -- --usuario nombre --motivo "Texto del motivo" [--quitar-mfa] [--crear]
 *
 * Pone una contraseña provisional (se muestra una sola vez en esta terminal) que
 * deberá cambiarse al entrar. Requiere NEXT_PUBLIC_SUPABASE_URL y
 * SUPABASE_SERVICE_ROLE_KEY en el entorno de quien lo ejecuta (nunca en el
 * navegador). Deja la acción en la auditoría.
 */
import { createClient } from "@supabase/supabase-js";
import { PATRON_USUARIO, correoInterno, generarContrasenaInicial, normalizarUsuario } from "../src/modulos/auth/usuarios";

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
const nombreUsuario = normalizarUsuario(argumento("usuario") ?? "");
const motivo = argumento("motivo")?.trim();

if (!url || !llave) fallar("faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
if (!PATRON_USUARIO.test(nombreUsuario)) fallar("indica --usuario (3 a 32 caracteres: letra inicial; letras, números, punto, guion o guion bajo).");
if (!motivo || motivo.length < 10) fallar('indica --motivo "…" (mínimo 10 caracteres).');

const admin = createClient(url!, llave!, { auth: { persistSession: false, autoRefreshToken: false } });
const contrasena = generarContrasenaInicial();
const pasos: string[] = [];

const { data: correo } = await admin.rpc("correo_de_usuario", { p_username: nombreUsuario });
let usuarioId: string;
if (correo) {
  const { data } = await admin.from("user_profiles").select("user_id").eq("username", nombreUsuario).single();
  usuarioId = data!.user_id;
  const { error } = await admin.auth.admin.updateUserById(usuarioId, { password: contrasena, ban_duration: "none" });
  if (error) fallar(`no se pudo restablecer la cuenta (${error.message}).`);
  pasos.push("cuenta desbloqueada y contraseña provisional puesta");
} else {
  if (!bandera("crear")) fallar("no existe una cuenta con ese usuario. Usa --crear para crearla.");
  const { data, error } = await admin.auth.admin.createUser({
    email: correoInterno(nombreUsuario),
    password: contrasena,
    email_confirm: true,
    user_metadata: { usuario: nombreUsuario },
  });
  if (error || !data.user) fallar(`no se pudo crear la cuenta (${error?.message}).`);
  usuarioId = data.user!.id;
  pasos.push("cuenta creada con contraseña provisional");
}

if (bandera("quitar-mfa")) {
  const { data: factores } = await admin.auth.admin.mfa.listFactors({ userId: usuarioId });
  for (const f of factores?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId: usuarioId, id: f.id });
  }
  pasos.push(`factores de verificación eliminados: ${factores?.factors?.length ?? 0}`);
}

const { error: errorRpc } = await admin.rpc("recuperacion_emergencia_admin", { p_user_id: usuarioId, p_motivo: motivo });
if (errorRpc) fallar(`no se pudo asignar la administración (${errorRpc.message}).`);
await admin.from("user_profiles").update({ username: nombreUsuario }).eq("user_id", usuarioId).is("username", null);
const { error: errorCambio } = await admin.rpc("exigir_cambio_contrasena", { p_user_id: usuarioId });
if (errorCambio) fallar(`no se pudo exigir el cambio de contraseña (${errorCambio.message}).`);
pasos.push("rol admin asignado, cuenta activa, cambio de contraseña exigido y acción auditada");

process.stderr.write(
  `Recuperación de emergencia completada para «${nombreUsuario}»:\n- ${pasos.join("\n- ")}\n\n` +
    `Contraseña provisional (se muestra solo ahora; entrégala en persona): ${contrasena}\n`,
);
process.stdout.write(`${JSON.stringify({ ok: true, usuarioId, pasos })}\n`);
