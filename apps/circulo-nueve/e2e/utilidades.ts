import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Secret, TOTP } from "otpauth";

import { correoInterno } from "../src/modulos/auth/usuarios";

export const ADMIN = { usuario: "admin.demo", contrasena: "AdminDemo2026" };
/** Estado compartido entre archivos de prueba (mismo proceso, ejecución en orden). */
export const estado = { secretoAdmin: "" };

export function supabaseServicio() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const PERMISOS_ASISTENTE = ["listar", "abrir_descargar", "cargar", "modificar", "borrar", "compartir"];

/**
 * Crea una cuenta activa directamente con el servicio, para preparar escenarios.
 * Los asistentes reciben el paquete «sus propios expedientes» (y compartirlos).
 */
export async function crearCuenta(usuario: string, nombre: string, rol: string, contrasena: string): Promise<string> {
  const admin = supabaseServicio();
  const { data, error } = await admin.auth.admin.createUser({ email: correoInterno(usuario), password: contrasena, email_confirm: true });
  if (error || !data.user) throw new Error(`No se pudo crear ${usuario}: ${error?.message}`);
  await admin.from("user_profiles").insert({ user_id: data.user.id, display_name: nombre, username: usuario });
  await admin.from("user_roles").insert({ user_id: data.user.id, role_id: rol });
  if (rol === "consultor") {
    await admin.from("user_permissions").insert(PERMISOS_ASISTENTE.map((permission_id) => ({ user_id: data.user.id, permission_id, alcance: "propio" })));
  }
  return data.user.id;
}

/** Asistente creada en 02-expedientes.spec.ts (activa durante el resto de la suite). */
export const ANA = { usuario: "ana", nombre: "Ana Asistente", contrasena: "AnaDemo20261" };

let ultimoCodigo = "";

/** Código TOTP actual; si ya se usó en esta ventana de 30 s, espera a la siguiente (Auth rechaza reutilizarlo). */
export async function codigoTotp(secreto: string): Promise<string> {
  const totp = new TOTP({ secret: Secret.fromBase32(secreto), digits: 6, period: 30 });
  let codigo = totp.generate();
  while (codigo === ultimoCodigo) {
    await new Promise((r) => setTimeout(r, 1000));
    codigo = totp.generate();
  }
  ultimoCodigo = codigo;
  return codigo;
}

/** Inicia sesión. Por defecto espera a salir de /entrar; con `esperaError` espera el aviso de credenciales. */
export async function entrar(page: Page, usuario: string, contrasena: string, { esperaError = false } = {}) {
  await page.goto("/entrar");
  await page.getByLabel("Usuario", { exact: true }).fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  if (esperaError) await expect(page.getByText("Usuario o contraseña incorrectos")).toBeVisible();
  else await expect(page).not.toHaveURL(/\/entrar(\?|$)/);
}

export async function verificarCodigo(page: Page, secreto: string) {
  await expect(page).toHaveURL(/\/entrar\/verificar/);
  await page.getByLabel("Código de 6 dígitos", { exact: true }).fill(await codigoTotp(secreto));
  await page.getByRole("button", { name: "Verificar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar\/verificar/);
}

export async function salir(page: Page) {
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
}
