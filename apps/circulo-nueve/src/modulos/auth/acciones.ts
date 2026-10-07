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
  esquemaCrearCuenta,
  esquemaNuevaContrasena,
  esquemaPaquetes,
  esquemaRestablecer,
  esquemaRol,
  PAQUETES_PERMISOS,
  type EstadoFormulario,
  type PaquetePermisos,
} from "./esquemas";
import { correoInterno, generarContrasenaInicial } from "./usuarios";
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

  const valores = { usuario: String(form.get("usuario") ?? "") };
  const datos = esquemaAlta.safeParse(datosDe(form));
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  if (!(await verificarClaveAlta(datos.data.clave, process.env.ADMIN_SETUP_KEY_HASH))) {
    return { errores: { clave: "La clave de alta no es válida." }, valores };
  }

  const admin = clienteSupabaseAdmin();
  const { data: setup } = await admin.from("app_setup").select("completed_at").single();
  if (setup?.completed_at) return { mensaje: "El alta inicial ya se completó." };

  const correo = correoInterno(datos.data.usuario);
  const { data: creado, error } = await admin.auth.admin.createUser({
    email: correo,
    password: datos.data.contrasena,
    email_confirm: true,
    user_metadata: { usuario: datos.data.usuario },
  });
  if (error || !creado.user) return { mensaje: "No se pudo crear la cuenta de administración. Prueba con otro usuario o contraseña." };

  const { error: errorAlta } = await admin.rpc("completar_alta_admin", {
    p_user_id: creado.user.id,
    p_display_name: datos.data.usuario,
    p_username: datos.data.usuario,
  });
  if (errorAlta) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { mensaje: "El alta inicial ya se completó." };
  }

  const supabase = await clienteSupabaseServidor();
  await supabase.auth.signInWithPassword({ email: correo, password: datos.data.contrasena });
  redirect("/cuenta?bienvenida=1");
}

// ---------------------------------------------------------------- entrar / salir

export async function accionEntrar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const falta = sinConfiguracion();
  if (falta) return falta;
  const datos = esquemaEntrar.safeParse(datosDe(form));
  if (!datos.success) return { errores: erroresDe(datos.error), valores: { usuario: String(form.get("usuario") ?? "") } };
  const limite = LIMITES.entrar.registrar(`${await ipCliente()}|${datos.data.usuario}`);
  if (!limite.permitido) return { mensaje: mensajeLimite(limite.reintentarEnMs) };

  const rechazo = { mensaje: "Usuario o contraseña incorrectos, o la cuenta no está activa.", valores: { usuario: datos.data.usuario } };
  // El correo interno lo resuelve solo el servidor; la respuesta es la misma exista o no el usuario.
  const { data: correo } = await clienteSupabaseAdmin().rpc("correo_de_usuario", { p_username: datos.data.usuario });
  if (!correo) return rechazo;
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: correo as string, password: datos.data.contrasena });
  if (error) return rechazo;

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
  if (!factor) redirect("/cuenta");

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

export async function accionCambiarContrasena(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const datos = esquemaNuevaContrasena.safeParse(datosDe(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const supabase = await clienteSupabaseServidor();
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) redirect("/entrar");
  const { error } = await supabase.auth.updateUser({ password: datos.data.contrasena });
  if (error) return { mensaje: "No se pudo guardar la contraseña. Usa una distinta de la anterior." };
  // Libera el cambio obligatorio; la base solo lo acepta si el hash de la contraseña cambió.
  await supabase.rpc("confirmar_cambio_contrasena");
  redirect(rutaInternaSegura(String(form.get("next") ?? ""), "/cuenta?contrasena=actualizada"));
}

export async function accionDesactivarMfa(): Promise<EstadoFormulario> {
  const supabase = await clienteSupabaseServidor();
  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivel?.currentLevel !== "aal2") return { mensaje: "Para desactivarla, entra con tu código de verificación." };
  const { data: factores } = await supabase.auth.mfa.listFactors();
  for (const f of factores?.all ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
  revalidatePath("/cuenta");
  return { ok: true, mensaje: "Verificación en dos pasos desactivada. Te recomendamos volver a activarla." };
}

// ---------------------------------------------------------------- administración de usuarios

async function exigirAdministracion(): Promise<{ ok: true; usuarioId: string } | { ok: false; estado: EstadoFormulario }> {
  const sesion = await obtenerSesion();
  if (!sesion || !esAdmin(sesion) || !sesion.acceso.permisos.includes("admin_usuarios")) {
    return { ok: false, estado: { mensaje: "No tienes permiso para administrar usuarios." } };
  }
  return { ok: true, usuarioId: sesion.usuarioId };
}

function filasPermisos(usuarioId: string, paquetes: PaquetePermisos[], otorgadoPor: string) {
  const mapa = new Map<string, "propio" | "global">();
  for (const p of paquetes) {
    for (const [permiso, alcance] of PAQUETES_PERMISOS[p].permisos) {
      if (mapa.get(permiso) !== "global") mapa.set(permiso, alcance);
    }
  }
  return [...mapa].map(([permission_id, alcance]) => ({ user_id: usuarioId, permission_id, alcance, granted_by: otorgadoPor }));
}

/**
 * La administración crea la cuenta con usuario y contraseña inicial (que ella
 * entrega). Si no escribe una, se genera y se muestra una sola vez.
 */
export async function accionCrearCuenta(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const permiso = await exigirAdministracion();
  if (!permiso.ok) return permiso.estado;
  const base = datosDe(form);
  const valores = { nombre: base.nombre ?? "", usuario: base.usuario ?? "", rol: base.rol ?? "" };
  const datos = esquemaCrearCuenta.safeParse({ ...base, paquetes: form.getAll("paquetes").map(String) });
  if (!datos.success) return { errores: erroresDe(datos.error), valores };
  const d = datos.data;
  const contrasena = d.contrasena ?? generarContrasenaInicial();

  const admin = clienteSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: correoInterno(d.usuario),
    password: contrasena,
    email_confirm: true,
    user_metadata: { usuario: d.usuario },
  });
  if (error || !data.user) return { errores: { usuario: "Ese usuario ya existe o no es válido." }, valores };

  const supabase = await clienteSupabaseServidor();
  const pasos = [
    () => supabase.from("user_profiles").insert({ user_id: data.user.id, display_name: d.nombre, username: d.usuario }),
    () => supabase.from("user_roles").insert({ user_id: data.user.id, role_id: d.rol, granted_by: permiso.usuarioId }),
    () => (d.rol === "consultor" && d.paquetes.length ? supabase.from("user_permissions").insert(filasPermisos(data.user.id, d.paquetes, permiso.usuarioId)) : Promise.resolve({ error: null })),
  ];
  for (const paso of pasos) {
    const { error: fallo } = await paso();
    if (fallo) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { mensaje: fallo.code === "23505" ? "Ese usuario ya existe." : ERROR_GENERICO, valores };
    }
  }
  if (d.forzarCambio === "on") await admin.rpc("exigir_cambio_contrasena", { p_user_id: data.user.id });
  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    contrasena: d.contrasena ? undefined : contrasena,
    mensaje: `Cuenta «${d.usuario}» creada.${d.forzarCambio === "on" ? " Deberá elegir su propia contraseña al entrar por primera vez." : ""} Entrégale el usuario y la contraseña en persona o por un canal privado.`,
  };
}

/** Restablece la contraseña desde el panel (la escribe la administración o se genera). */
export async function accionRestablecerContrasena(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const permiso = await exigirAdministracion();
  if (!permiso.ok) return permiso.estado;
  const datos = esquemaRestablecer.safeParse(datosDe(form));
  if (!datos.success) return { errores: erroresDe(datos.error) };
  const d = datos.data;
  if (d.usuarioId === permiso.usuarioId) return { mensaje: "Tu propia contraseña se cambia desde «Mi cuenta»." };
  const contrasena = d.contrasena ?? generarContrasenaInicial();
  const admin = clienteSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(d.usuarioId, { password: contrasena });
  if (error) return { mensaje: ERROR_GENERICO };
  if (d.forzarCambio === "on") await admin.rpc("exigir_cambio_contrasena", { p_user_id: d.usuarioId });
  await admin.from("audit_log").insert({ actor_id: permiso.usuarioId, accion: "modificar", recurso_tipo: "contrasena", recurso_id: d.usuarioId });
  revalidatePath("/admin/usuarios");
  return { ok: true, contrasena: d.contrasena ? undefined : contrasena, mensaje: `Contraseña restablecida.${d.forzarCambio === "on" ? " Deberá cambiarla al entrar." : ""}` };
}

/** Reemplaza los permisos individuales de un asistente por los paquetes marcados. */
export async function accionPaquetesPermisos(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const permiso = await exigirAdministracion();
  if (!permiso.ok) return permiso.estado;
  const datos = esquemaPaquetes.safeParse({ usuarioId: form.get("usuarioId"), paquetes: form.getAll("paquetes").map(String) });
  if (!datos.success) return { mensaje: ERROR_GENERICO };
  const supabase = await clienteSupabaseServidor();
  const { error: errorBorrar } = await supabase.from("user_permissions").delete().eq("user_id", datos.data.usuarioId);
  if (errorBorrar) return { mensaje: ERROR_GENERICO };
  const filas = filasPermisos(datos.data.usuarioId, datos.data.paquetes, permiso.usuarioId);
  if (filas.length) {
    const { error } = await supabase.from("user_permissions").insert(filas);
    if (error) return { mensaje: "No se pueden cambiar tus propios permisos." };
  }
  revalidatePath("/admin/usuarios");
  return { ok: true, mensaje: "Permisos actualizados." };
}

function enlaceConfirmacion(tokenHash: string, tipo: "invite" | "recovery"): string {
  return `${leerConfigSupabase().urlSitio}/auth/confirmar?token_hash=${encodeURIComponent(tokenHash)}&type=${tipo}&next=/cuenta/contrasena`;
}

async function auditarEnlace(actor: string, recurso: string, usuarioId: string) {
  await clienteSupabaseAdmin().from("audit_log").insert({ actor_id: actor, accion: "compartir", recurso_tipo: recurso, recurso_id: usuarioId });
}

/** Enlace de recuperación de un solo uso para una cuenta, para compartir sin correo. */
export async function accionEnlaceRecuperacion(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const permiso = await exigirAdministracion();
  if (!permiso.ok) return permiso.estado;
  const usuarioId = String(form.get("usuarioId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(usuarioId) || usuarioId === permiso.usuarioId) return { mensaje: "No se puede generar un enlace para esta cuenta." };
  const admin = clienteSupabaseAdmin();
  const { data: cuenta } = await admin.auth.admin.getUserById(usuarioId);
  if (!cuenta.user?.email) return { mensaje: ERROR_GENERICO };
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: cuenta.user.email });
  if (error || !data.properties) return { mensaje: ERROR_GENERICO };
  await auditarEnlace(permiso.usuarioId, "enlace_recuperacion", usuarioId);
  return { ok: true, enlace: enlaceConfirmacion(data.properties.hashed_token, "recovery"), mensaje: "Enlace para elegir contraseña nueva: sirve una vez y caduca en 1 hora." };
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
