import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Secret, TOTP } from "otpauth";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

export const ADMIN = { correo: "admin@demo.invalid", nombre: "Admin Demo", contrasena: "AdminDemo2026" };
/** Estado compartido entre archivos de prueba (mismo proceso, ejecución en orden). */
export const estado = { secretoAdmin: "" };

export function supabaseServicio() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Crea una cuenta activa con rol directamente (sin invitación), para preparar escenarios. */
export async function crearCuenta(correo: string, nombre: string, rol: string, contrasena: string): Promise<string> {
  const admin = supabaseServicio();
  const { data, error } = await admin.auth.admin.createUser({ email: correo, password: contrasena, email_confirm: true });
  if (error || !data.user) throw new Error(`No se pudo crear ${correo}: ${error?.message}`);
  await admin.from("user_profiles").insert({ user_id: data.user.id, display_name: nombre });
  await admin.from("user_roles").insert({ user_id: data.user.id, role_id: rol });
  return data.user.id;
}

/** Consultora creada en 02-expedientes.spec.ts (activa durante el resto de la suite). */
export const ANA = { correo: "ana@demo.invalid", nombre: "Ana Consultora", contrasena: "AnaDemo20261" };

export const CONSULTORA = { correo: "consultora@demo.invalid", nombre: "Consultora Demo", contrasena: "Consultora2026" };

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

/** Espera el último correo para `destinatario` en Mailpit y devuelve el enlace de la app. */
export async function enlaceDeCorreo(destinatario: string, desde: Date): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${destinatario}`)}`);
    const { messages = [] } = (await r.json()) as { messages?: { ID: string; Created: string }[] };
    const reciente = messages.find((m) => new Date(m.Created) >= desde);
    if (reciente) {
      const detalle = (await (await fetch(`${MAILPIT}/api/v1/message/${reciente.ID}`)).json()) as { HTML: string };
      const enlace = /href="([^"]*\/auth\/confirmar[^"]*)"/.exec(detalle.HTML)?.[1];
      if (enlace) return enlace.replaceAll("&amp;", "&");
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`No llegó correo para ${destinatario}`);
}

/** Inicia sesión. Por defecto espera a salir de /entrar; con `esperaError` espera el aviso de credenciales. */
export async function entrar(page: Page, correo: string, contrasena: string, { esperaError = false } = {}) {
  await page.goto("/entrar");
  await page.getByLabel("Correo", { exact: true }).fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  if (esperaError) await expect(page.getByText("Correo o contraseña incorrectos")).toBeVisible();
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
