import { expect, type Page } from "@playwright/test";
import { Secret, TOTP } from "otpauth";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

export const ADMIN = { correo: "admin@demo.invalid", nombre: "Admin Demo", contrasena: "AdminDemo2026" };
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

export async function entrar(page: Page, correo: string, contrasena: string) {
  await page.goto("/entrar");
  await page.getByLabel("Correo", { exact: true }).fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
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
