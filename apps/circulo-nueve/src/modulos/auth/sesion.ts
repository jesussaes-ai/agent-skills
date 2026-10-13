import "server-only";
import { redirect } from "next/navigation";
import { leerConfigSupabase } from "./config";
import { clienteSupabaseServidor } from "./supabase-servidor";

export interface Acceso {
  activo: boolean;
  aal2: boolean;
  /** Tiene la verificación en dos pasos activada (entonces toda sesión debe ser aal2). */
  mfaActivo: boolean;
  /** Debe elegir una contraseña nueva antes de usar la app. */
  debeCambiar: boolean;
  usuario: string | null;
  roles: string[];
  permisos: string[];
  estado: string | null;
  nombre: string | null;
}

export interface Sesion {
  usuarioId: string;
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
    acceso: (acceso as Acceso | null) ?? {
      activo: false,
      aal2: false,
      mfaActivo: false,
      debeCambiar: false,
      usuario: null,
      roles: [],
      permisos: [],
      estado: null,
      nombre: null,
    },
    nivelActual: nivel?.currentLevel ?? null,
    nivelSiguiente: nivel?.nextLevel ?? null,
    tieneFactorVerificado: (factores?.totp ?? []).some((f) => f.status === "verified"),
  };
}

export function esAdmin(sesion: Sesion): boolean {
  return sesion.acceso.roles.includes("admin");
}

export function esSoloCliente(sesion: Sesion): boolean {
  return sesion.acceso.roles.length > 0 && sesion.acceso.roles.every((r) => r === "cliente") && sesion.acceso.permisos.length === 0;
}

/**
 * Exige sesión. Si la cuenta tiene verificación en dos pasos, pide el código;
 * si tiene un cambio de contraseña pendiente, lleva a elegirla antes de seguir.
 */
export async function exigirSesion(destino: string): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect(`/entrar?next=${encodeURIComponent(destino)}`);
  if (sesion.nivelSiguiente === "aal2" && sesion.nivelActual !== "aal2") {
    redirect(`/entrar/verificar?next=${encodeURIComponent(destino)}`);
  }
  if (sesion.acceso.debeCambiar && !destino.startsWith("/cuenta/contrasena")) {
    redirect(`/cuenta/contrasena?obligatorio=1&next=${encodeURIComponent(destino)}`);
  }
  return sesion;
}

/** Exige el rol admin con la cuenta activa. La verificación en dos pasos es opcional y recomendada. */
export async function exigirAdmin(destino: string): Promise<Sesion> {
  const sesion = await exigirSesion(destino);
  if (!esAdmin(sesion) || !sesion.acceso.activo || !sesion.acceso.permisos.includes("admin_usuarios")) redirect("/sin-permiso");
  return sesion;
}

/** Exige la cuenta activa con un permiso concreto (propio o asignado por la administración). */
export async function exigirPermiso(destino: string, permiso: string): Promise<Sesion> {
  const sesion = await exigirSesion(destino);
  if (!sesion.acceso.activo || !sesion.acceso.permisos.includes(permiso)) redirect("/sin-permiso");
  return sesion;
}
