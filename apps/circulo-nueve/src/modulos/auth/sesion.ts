import "server-only";
import { redirect } from "next/navigation";
import { leerConfigSupabase } from "./config";
import { clienteSupabaseServidor } from "./supabase-servidor";

export interface Acceso {
  activo: boolean;
  aal2: boolean;
  roles: string[];
  permisos: string[];
  estado: string | null;
  nombre: string | null;
}

export interface Sesion {
  usuarioId: string;
  correo: string;
  acceso: Acceso;
  nivelActual: string | null;
  nivelSiguiente: string | null;
  tieneFactorVerificado: boolean;
}

/** Sesión verificada con el servidor de Auth (getUser), o null. */
export async function obtenerSesion(): Promise<Sesion | null> {
  if (!leerConfigSupabase().configurado) return null;
  const supabase = await clienteSupabaseServidor();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const [{ data: acceso }, { data: nivel }, { data: factores }] = await Promise.all([
    supabase.rpc("mi_acceso"),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  return {
    usuarioId: data.user.id,
    correo: data.user.email ?? "",
    acceso: (acceso as Acceso | null) ?? { activo: false, aal2: false, roles: [], permisos: [], estado: null, nombre: null },
    nivelActual: nivel?.currentLevel ?? null,
    nivelSiguiente: nivel?.nextLevel ?? null,
    tieneFactorVerificado: (factores?.totp ?? []).some((f) => f.status === "verified"),
  };
}

export function esAdmin(sesion: Sesion): boolean {
  return sesion.acceso.roles.includes("admin");
}

/** Exige sesión; si tiene un factor pendiente de verificar, lo pide antes de seguir. */
export async function exigirSesion(destino: string): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect(`/entrar?next=${encodeURIComponent(destino)}`);
  if (sesion.nivelSiguiente === "aal2" && sesion.nivelActual !== "aal2") {
    redirect(`/entrar/verificar?next=${encodeURIComponent(destino)}`);
  }
  return sesion;
}

/** Exige rol admin con verificación en dos pasos; si no la tiene configurada, lleva a configurarla. */
export async function exigirAdmin(destino: string): Promise<Sesion> {
  const sesion = await exigirSesion(destino);
  if (!esAdmin(sesion)) redirect("/sin-permiso");
  if (!sesion.tieneFactorVerificado) redirect(`/cuenta/verificacion?obligatoria=1&next=${encodeURIComponent(destino)}`);
  if (!sesion.acceso.aal2) redirect(`/entrar/verificar?next=${encodeURIComponent(destino)}`);
  if (!sesion.acceso.activo) redirect("/sin-permiso");
  return sesion;
}
