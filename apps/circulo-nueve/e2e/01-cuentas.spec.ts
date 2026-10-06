import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN, CONSULTORA, codigoTotp, enlaceDeCorreo, entrar, estado, salir, verificarCodigo } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: import("@playwright/test").Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};

// Las pruebas comparten estado (la base se reinicia una vez por ejecución) y van en orden.
test.describe.configure({ mode: "serial" });

let secretoAdmin = "";

test("no hay registro público", async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const { error } = await supabase.auth.signUp({ email: "intruso@demo.invalid", password: "Intruso2026xx" });
  expect(error?.message).toMatch(/not allowed/i);
});

test("sin sesión, las rutas protegidas llevan a entrar", async ({ page }) => {
  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fadmin%2Fusuarios/);
});

test("alta inicial: rechaza una clave incorrecta", async ({ page }) => {
  await page.goto("/setup");
  await captura(page, "01-alta-inicial");
  await page.getByLabel("Clave de alta", { exact: true }).fill("clave-equivocada-0000000000");
  await page.getByLabel("Nombre para mostrar", { exact: true }).fill(ADMIN.nombre);
  await page.getByLabel("Correo de administración", { exact: true }).fill(ADMIN.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN.contrasena);
  await page.getByLabel("Repite la contraseña", { exact: true }).fill(ADMIN.contrasena);
  await page.getByRole("button", { name: "Crear administración", exact: true }).click();
  await expect(page.getByText("La clave de alta no es válida.")).toBeVisible();
});

test("alta inicial con la clave correcta y MFA obligatoria", async ({ page }) => {
  await page.goto("/setup");
  await page.getByLabel("Clave de alta", { exact: true }).fill(process.env.E2E_CLAVE_ALTA ?? "");
  await page.getByLabel("Nombre para mostrar", { exact: true }).fill(ADMIN.nombre);
  await page.getByLabel("Correo de administración", { exact: true }).fill(ADMIN.correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN.contrasena);
  await page.getByLabel("Repite la contraseña", { exact: true }).fill(ADMIN.contrasena);
  await page.getByRole("button", { name: "Crear administración", exact: true }).click();

  await expect(page).toHaveURL(/\/cuenta\/verificacion\?/);
  await expect(page.getByText("Para administrar es obligatoria")).toBeVisible();
  await page.getByRole("button", { name: "Configurar verificación en dos pasos", exact: true }).click();
  secretoAdmin = (await page.getByTestId("secreto-totp").textContent())?.trim() ?? "";
  expect(secretoAdmin).toMatch(/^[A-Z2-7]+=*$/);
  estado.secretoAdmin = secretoAdmin;
  await captura(page, "02-configurar-verificacion");
  await page.getByLabel("Código de 6 dígitos", { exact: true }).fill(await codigoTotp(secretoAdmin));
  await page.getByRole("button", { name: "Activar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/usuarios$/);
  await expect(page.getByRole("heading", { name: "Administración de usuarios" })).toBeVisible();
});

test("/setup responde 410 tras el alta", async ({ request }) => {
  const r = await request.get("/setup");
  expect(r.status()).toBe(410);
});

test("administración invita a una consultora", async ({ page }) => {
  await entrar(page, ADMIN.correo, ADMIN.contrasena);
  await verificarCodigo(page, secretoAdmin);
  await page.goto("/admin/usuarios");
  const desde = new Date(Date.now() - 500);
  await page.getByLabel("Nombre", { exact: true }).fill(CONSULTORA.nombre);
  await page.getByLabel("Correo", { exact: true }).fill(CONSULTORA.correo);
  await page.getByLabel("Rol inicial", { exact: true }).selectOption("consultor");
  await page.getByRole("button", { name: "Enviar invitación", exact: true }).click();
  await expect(page.getByText(`Invitación enviada a ${CONSULTORA.correo}.`)).toBeVisible();
  await expect(page.getByTestId(`usuario-${CONSULTORA.correo}`)).toContainText("Consultor/a");
  await captura(page, "03-panel-usuarios");
  await salir(page);

  const enlace = await enlaceDeCorreo(CONSULTORA.correo, desde);
  await page.goto(enlace);
  await expect(page).toHaveURL(/\/cuenta\/contrasena$/);
  await page.getByLabel("Contraseña nueva", { exact: true }).fill(CONSULTORA.contrasena);
  await page.getByLabel("Repite la contraseña", { exact: true }).fill(CONSULTORA.contrasena);
  await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta\?contrasena=actualizada/);
  await expect(page.getByTestId("mis-roles")).toHaveText("Consultor/a");
  await captura(page, "04-cuenta-consultora");
});

test("una consultora no entra a la administración", async ({ page }) => {
  await entrar(page, CONSULTORA.correo, CONSULTORA.contrasena);
  await expect(page).toHaveURL(/\/cuenta$/);
  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/sin-permiso$/);
});

test("recuperación de contraseña por correo", async ({ page }) => {
  const desde = new Date(Date.now() - 500);
  await page.goto("/recuperar");
  await page.getByLabel("Correo de tu cuenta", { exact: true }).fill(CONSULTORA.correo);
  await page.getByRole("button", { name: "Enviar enlace", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Si el correo corresponde a una cuenta");

  const enlace = await enlaceDeCorreo(CONSULTORA.correo, desde);
  await page.goto(enlace);
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("NuevaClave2026x");
  await page.getByLabel("Repite la contraseña", { exact: true }).fill("NuevaClave2026x");
  await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta\?contrasena=actualizada/);
  await salir(page);

  await entrar(page, CONSULTORA.correo, CONSULTORA.contrasena, { esperaError: true });
  await entrar(page, CONSULTORA.correo, "NuevaClave2026x");
  await expect(page).toHaveURL(/\/cuenta$/);
});

test("un enlace de un solo uso no sirve dos veces", async ({ page }) => {
  const desde = new Date(Date.now() - 500);
  await page.goto("/recuperar");
  await page.getByLabel("Correo de tu cuenta", { exact: true }).fill(CONSULTORA.correo);
  await page.getByRole("button", { name: "Enviar enlace", exact: true }).click();
  const enlace = await enlaceDeCorreo(CONSULTORA.correo, desde);
  await page.goto(enlace);
  await expect(page).toHaveURL(/\/cuenta\/contrasena$/);
  await page.context().clearCookies();
  await page.goto(enlace);
  await expect(page).toHaveURL(/\/entrar\?error=enlace/);
});

test("administración suspende la cuenta y la consultora pierde el acceso", async ({ page }) => {
  await entrar(page, ADMIN.correo, ADMIN.contrasena);
  await verificarCodigo(page, secretoAdmin);
  await page.goto("/admin/usuarios");
  const fila = page.getByTestId(`usuario-${CONSULTORA.correo}`);
  await fila.getByRole("button", { name: "Suspender", exact: true }).click();
  await expect(fila.getByTestId("estado-cuenta")).toHaveText("suspendido");
  await expect(page.getByTestId(`usuario-${ADMIN.correo}`)).toContainText("No puedes cambiar tu propio estado");
  await salir(page);

  await entrar(page, CONSULTORA.correo, "NuevaClave2026x", { esperaError: true });
});

test("los botones nuevos tienen ventana explicativa", async ({ page }) => {
  await page.goto("/entrar");
  const boton = page.getByRole("button", { name: "Entrar", exact: true });
  await boton.focus();
  const id = await boton.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${id}"]`)).toBeVisible();
  await captura(page, "05-entrar-tooltip");
});
