import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { entrar } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};

// Va al final: agota límites compartidos (por IP) que otras pruebas necesitan.
test.describe.configure({ mode: "serial" });

test("tras 10 intentos fallidos, entrar pide esperar (aunque la contraseña sea correcta o no)", async ({ page }) => {
  const usuario = `intruso.${Date.now()}`;
  for (let i = 0; i < 10; i++) await entrar(page, usuario, `ClaveFalsa${i}xx`, { esperaError: true });
  await page.getByLabel("Contraseña", { exact: true }).fill("OtraClaveFalsa1");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText(/^Demasiados intentos\. Vuelve a intentarlo en \d+ (segundos?|minutos)\./)).toBeVisible();
  await captura(page, "07-limite-entrar");
});

test("los enlaces públicos responden 429 cuando alguien prueba tokens en masa", async ({ request }) => {
  let estado = 0;
  let reintentar = "";
  for (let i = 0; i < 90 && estado !== 429; i++) {
    const r = await request.get(`/compartido/${"y".repeat(43)}/${randomUUID()}`, { maxRedirects: 0 });
    estado = r.status();
    reintentar = r.headers()["retry-after"] ?? "";
  }
  expect(estado).toBe(429);
  expect(Number(reintentar)).toBeGreaterThan(0);
});
