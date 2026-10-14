import { expect, test, type Page } from "@playwright/test";
import { crearCuenta, supabaseServicio } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};

const PANTALLAS = [
  { nombre: "movil", width: 390, height: 844 },
  { nombre: "tableta", width: 768, height: 1024 },
] as const;

const menu = (page: Page) => page.getByRole("navigation", { name: "Principal" });

test.describe.configure({ mode: "serial" });

for (const pantalla of PANTALLAS) {
  test(`sin sesión a ${pantalla.width} px: «Subir archivos» y «Entrar» se ven en el menú y en el inicio`, async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: pantalla.width, height: pantalla.height }, hasTouch: true, locale: "es-MX" });
    const page = await contexto.newPage();
    await page.goto("/");
    await expect(menu(page).getByRole("link", { name: "Subir archivos", exact: true })).toBeInViewport();
    await expect(menu(page).getByRole("link", { name: "Entrar", exact: true })).toBeInViewport();
    await expect(page.getByTestId("acceso-rapido").getByRole("link", { name: "Entrar para subir archivos", exact: true })).toBeInViewport();
    await captura(page, `subir-visible-${pantalla.nombre}-sin-sesion`);
    await contexto.close();
  });

  test(`dueño con contraseña provisional a ${pantalla.width} px: entra desde «Subir archivos», elige contraseña y llega al Centro de carga`, async ({ browser }) => {
    const cuenta = { usuario: `dueno.${pantalla.nombre}`, provisional: "Provisional2026x", nueva: "DuenoPropia2026x" };
    const id = await crearCuenta(cuenta.usuario, "Dueño de prueba", "admin", cuenta.provisional);
    const sb = supabaseServicio();
    const { error } = await sb.rpc("exigir_cambio_contrasena", { p_user_id: id });
    expect(error).toBeNull();
    const { data: expediente } = await sb
      .from("case_files")
      .insert({ display_label: `Expediente del dueño ${pantalla.nombre} (DEMO)`, created_by: id, es_demo: true })
      .select("id")
      .single();

    const contexto = await browser.newContext({ viewport: { width: pantalla.width, height: pantalla.height }, hasTouch: true, locale: "es-MX" });
    const page = await contexto.newPage();
    await page.goto("/");
    await menu(page).getByRole("link", { name: "Subir archivos", exact: true }).tap();
    await expect(page).toHaveURL(/\/entrar\?next=%2Fbiblioteca%23centro-de-carga$/);
    await page.getByLabel("Usuario", { exact: true }).fill(cuenta.usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(cuenta.provisional);
    await page.getByRole("button", { name: "Entrar", exact: true }).tap();

    await expect(page).toHaveURL(/\/cuenta\/contrasena\?obligatorio=1/);
    await expect(page.getByTestId("aviso-cambio-obligatorio")).toContainText("«Subir archivos»");
    await expect(menu(page).getByRole("link", { name: "Elegir contraseña", exact: true })).toBeVisible();
    await expect(menu(page).getByRole("link", { name: "Subir archivos", exact: true })).toBeVisible();
    await expect(menu(page).getByRole("link", { name: "Biblioteca", exact: true })).toBeVisible();
    await captura(page, `subir-visible-${pantalla.nombre}-contrasena-provisional`);

    await page.getByLabel("Contraseña nueva", { exact: true }).fill(cuenta.nueva);
    await page.getByLabel("Repite la contraseña", { exact: true }).fill(cuenta.nueva);
    await page.getByRole("button", { name: "Guardar contraseña", exact: true }).tap();
    await expect(page).toHaveURL(/\/biblioteca(#centro-de-carga)?$/);
    await expect(page.locator("#centro-de-carga").getByRole("button", { name: "Tomar foto", exact: true })).toBeVisible();
    await expect(menu(page).getByRole("link", { name: "Elegir contraseña", exact: true })).toHaveCount(0);
    await expect(menu(page).getByRole("link", { name: "Subir archivos", exact: true })).toBeVisible();

    await page.goto("/");
    await expect(page.getByTestId("acceso-rapido").getByRole("link", { name: "Subir archivos o fotos", exact: true })).toBeInViewport();

    await page.goto(`/expedientes/${expediente?.id}`);
    await expect(page.getByRole("link", { name: "Subir documentos o fotos", exact: true })).toBeInViewport();
    await captura(page, `subir-visible-${pantalla.nombre}-expediente`);
    await contexto.close();
  });
}

test("al volver a la app con una versión nueva publicada, recarga sola y no entra en bucle", async ({ page }) => {
  await page.clock.install();
  let remota = "version-nueva-de-prueba";
  await page.route("**/api/version", (ruta) => ruta.fulfill({ json: { version: remota } }));
  await page.goto("/");
  const volverALaApp = async () => {
    await page.clock.fastForward("01:00");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  };

  const recarga = page.waitForEvent("load");
  await volverALaApp();
  await recarga;
  expect(await page.evaluate(() => sessionStorage.getItem("circulo-nueve:recargada-para"))).toBe(remota);

  // Si tras recargar el servidor sigue anunciando otra versión, avisa en lugar de recargar otra vez.
  await volverALaApp();
  const aviso = page.getByTestId("aviso-version");
  await expect(aviso).toContainText("Hay una versión nueva");
  await expect(aviso.getByRole("button", { name: "Actualizar ahora", exact: true })).toBeVisible();

  const real = await page.request.get("/api/version");
  expect(((await real.json()) as { version: string }).version).toBeTruthy();
  expect(real.headers()["cache-control"]).toContain("no-store");
});
