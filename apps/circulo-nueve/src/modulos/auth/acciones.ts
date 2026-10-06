"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verificarClaveAlta } from "./clave-alta";
import { leerConfigSupabase, rutaInternaSegura } from "./config";
import {
  datosDe,
  erroresDe,
  esquemaAlta,
  esquemaCodigoMfa,
  esquemaEntrar,
  esquemaEstado,
  esquemaInvitar,
  esquemaNuevaContrasena,
  esquemaRecuperar,
  esquemaRol,
  type EstadoFormulario,
} from "./esquemas";
import { LIMITES, mensajeLimite } from "./limite-intentos";
import { esAdmin, obtenerSesion } from "./sesion";
import { clienteSupabaseAdmin, clienteSupabaseServidor } from "./supabase-servidor";

const ERROR_GENERICO = "No se pudo completar la operación. Inténtalo de nuevo.";

async function ipCliente(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function sinConfiguracion(): EstadoFormulario | null {
  return leerConfigSupabase().configurado ? null : { mensaje: "Supabase no está configurado en este entorno." };
}

// ---------------------------------------------------------------- alta inicial

export async function accionAltaInicial(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const falta = sinConfiguracion();
  if (falta) return falta;
  const limite = LIMITES.alta.registrar(await ipCliente());
  if (!limite.permitido) return { mensaje: mensajeLimite(limite.reintentarEnMs) };

  const datos = esquemaAlta.safeParse(datosDe(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };

  if (!(await verificarClaveAlta(datos.data.clave, process.env.ADMIN_SETUP_KEY_HASH))) {
    return { errores: { clave: "La clave de alta no es válida." } };
  }

  const admin = clienteSupabaseAdmin();
  const { data: setup } = await admin.from("app_setup").select("completed_at").single();
  if (setup?.completed_at) return { mensaje: "El alta inicial ya se completó." };

  const { data: creado, error } = await admin.auth.admin.createUser({
    email: datos.data.correo,
    password: datos.data.contrasena,
    email_confirm: true,
  });
  if (error || !creado.user) return { mensaje: "No se pudo crear la cuenta de administración. Revisa el correo y la contraseña." };

  const { error: errorAlta } = await admin.rpc("completar_alta_admin", {
    p_user_id: creado.user.id,
    p_display_name: datos.data.nombre,
  });
  if (errorAlta) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { mensaje: "El alta inicial ya se completó." };
  }

  const supabase = await clienteSupabaseServidor();
  await supabase.auth.signInWithPassword({ email: datos.data.correo, password: datos.data.contrasena });
  redirect("/cuenta/verificacion?obligatoria=1&next=/admin/usuarios");
}

// ---------------------------------------------------------------- entrar / salir

export async function accionEntrar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const falta = sinConfiguracion();
  if (falta) return falta;
  const datos = esquemaEntrar.safeParse(datosDe(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const limite = LIMITES.entrar.registrar(`${await ipCliente()}|${datos.data.correo}`);
  if (!limite.permitido) return { mensaje: mensajeLimite(limite.reintentarEnMs) };

  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: datos.data.correo, password: datos.data.contrasena });
  if (error) return { mensaje: "Correo o contraseña incorrectos, o la cuenta no está activa." };

  const destino = rutaInternaSegura(String(form.get("next") ?? ""));
  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivel?.nextLevel === "aal2" && nivel.currentLevel !== "aal2") {
    redirect(`/entrar/verificar?next=${encodeURIComponent(destino)}`);
  }
  redirect(destino);
}

export async function accionSalir(): Promise<void> {
  if (leerConfigSupabase().configurado) {
    const supabase = await clienteSupabaseServidor();
    await supabase.auth.signOut();
  }
  redirect("/");
}

// ---------------------------------------------------------------- verificación en dos pasos

export async function accionVerificarMfa(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const datos = esquemaCodigoMfa.safeParse(datosDe(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const supabase = await clienteSupabaseServidor();
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) redirect("/entrar");
  const limite = LIMITES.mfa.registrar(usuario.user.id);
  if (!limite.permitido) return { mensaje: mensajeLimite(limite.reintentarEnMs) };

  const { data: factores } = await supabase.auth.mfa.listFactors();
  const factor = (factores?.totp ?? []).find((f) => f.status === "verified");
  if (!factor) redirect("/cuenta/verificacion?obligatoria=1");

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: datos.data.codigo });
  if (error) return { errores: { codigo: "El código no es correcto o ya caducó." } };
  redirect(rutaInternaSegura(String(form.get("next") ?? "")));
}

export interface InscripcionMfa {
  factorId?: string;
  qr?: string;
  secreto?: string;
  mensaje?: string;
}

export async function accionIniciarInscripcionMfa(): Promise<InscripcionMfa> {
  const supabase = await clienteSupabaseServidor();
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) return { mensaje: "Tu sesión terminó. Vuelve a entrar." };

  const { data: factores } = await supabase.auth.mfa.listFactors();
  for (const f of factores?.all ?? []) {
    if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  if ((factores?.totp ?? []).some((f) => f.status === "verified")) {
    return { mensaje: "Ya tienes la verificación en dos pasos activada." };
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Círculo Nueve" });
  if (error || !data) return { mensaje: ERROR_GENERICO };
  return { factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret };
}

export async function accionConfirmarInscripcionMfa(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const datos = esquemaCodigoMfa.safeParse(datosDe(form));
  if (!datos.success || !datos.data.factorId) return { errores: datos.success ? { codigo: "Vuelve a empezar la configuración." } : erroresDe(datos.error) };
  const supabase = await clienteSupabaseServidor();
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) redirect("/entrar");
  const limite = LIMITES.mfa.registrar(usuario.user.id);
  if (!limite.permitido) return { mensaje: mensajeLimite(limite.reintentarEnMs) };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: datos.data.factorId, code: datos.data.codigo });
  if (error) return { errores: { codigo: "El código no es correcto o ya caducó." } };
  redirect(rutaInternaSegura(String(form.get("next") ?? ""), "/cuenta"));
}

// ---------------------------------------------------------------- recuperación y contraseña

export async function accionRecuperar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const falta = sinConfiguracion();
  if (falta) return falta;
  const datos = esquemaRecuperar.safeParse(datosDe(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const limite = LIMITES.recuperar.registrar(await ipCliente());
  if (!limite.permitido) return { mensaje: mensajeLimite(limite.reintentarEnMs) };

  const supabase = await clienteSupabaseServidor();
  await supabase.auth.resetPasswordForEmail(datos.data.correo, {
    redirectTo: `${leerConfigSupabase().urlSitio}/cuenta/contrasena`,
  });
  return { ok: true, mensaje: "Si el correo corresponde a una cuenta, te enviamos un enlace para elegir una contraseña nueva." };
}

export async function accionCambiarContrasena(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const datos = esquemaNuevaContrasena.safeParse(datosDe(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const supabase = await clienteSupabaseServidor();
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) redirect("/entrar");
  const { error } = await supabase.auth.updateUser({ password: datos.data.contrasena });
  if (error) return { mensaje: "No se pudo guardar la contraseña. Usa una distinta de la anterior." };
  redirect("/cuenta?contrasena=actualizada");
}

// ---------------------------------------------------------------- administración de usuarios

async function exigirAdministracion(): Promise<{ ok: true; usuarioId: string } | { ok: false; estado: EstadoFormulario }> {
  const sesion = await obtenerSesion();
  if (!sesion || !esAdmin(sesion) || !sesion.acceso.aal2 || !sesion.acceso.permisos.includes("admin_usuarios")) {
    return { ok: false, estado: { mensaje: "No tienes permiso para administrar usuarios." } };
  }
  return { ok: true, usuarioId: sesion.usuarioId };
}

export async function accionInvitar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const permiso = await exigirAdministracion();
  if (!permiso.ok) return permiso.estado;
  const datos = esquemaInvitar.safeParse(datosDe(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };

  const admin = clienteSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(datos.data.correo, {
    redirectTo: `${leerConfigSupabase().urlSitio}/cuenta/contrasena`,
  });
  if (error || !data.user) return { mensaje: "No se pudo enviar la invitación. ¿El correo ya tiene cuenta?" };

  const supabase = await clienteSupabaseServidor();
  const { error: errorPerfil } = await supabase
    .from("user_profiles")
    .insert({ user_id: data.user.id, display_name: datos.data.nombre });
  const { error: errorRol } = errorPerfil
    ? { error: errorPerfil }
    : await supabase.from("user_roles").insert({ user_id: data.user.id, role_id: datos.data.rol, granted_by: permiso.usuarioId });
  if (errorPerfil || errorRol) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { mensaje: ERROR_GENERICO };
  }
  revalidatePath("/admin/usuarios");
  return { ok: true, mensaje: `Invitación enviada a ${datos.data.correo}.` };
}

export async function accionCambiarEstado(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const permiso = await exigirAdministracion();
  if (!permiso.ok) return permiso.estado;
  const datos = esquemaEstado.safeParse(datosDe(form));
  if (!datos.success) return { mensaje: ERROR_GENERICO };

  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase
    .from("user_profiles")
    .update({ status: datos.data.estado })
    .eq("user_id", datos.data.usuarioId)
    .select("user_id");
  if (error || !data?.length) return { mensaje: "No se puede cambiar el estado de esta cuenta." };

  await clienteSupabaseAdmin().auth.admin.updateUserById(datos.data.usuarioId, {
    ban_duration: datos.data.estado === "activo" ? "none" : "876000h",
  });
  revalidatePath("/admin/usuarios");
  return { ok: true, mensaje: "Estado actualizado." };
}

export async function accionCambiarRol(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const permiso = await exigirAdministracion();
  if (!permiso.ok) return permiso.estado;
  const datos = esquemaRol.safeParse(datosDe(form));
  if (!datos.success) return { mensaje: ERROR_GENERICO };

  const supabase = await clienteSupabaseServidor();
  const resultado =
    datos.data.operacion === "asignar"
      ? await supabase
          .from("user_roles")
          .insert({ user_id: datos.data.usuarioId, role_id: datos.data.rol, granted_by: permiso.usuarioId })
          .select("user_id")
      : await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", datos.data.usuarioId)
          .eq("role_id", datos.data.rol)
          .select("user_id");
  if (resultado.error || !resultado.data?.length) return { mensaje: "No se puede cambiar ese rol (no se permite sobre la propia cuenta)." };
  revalidatePath("/admin/usuarios");
  return { ok: true, mensaje: "Roles actualizados." };
}
