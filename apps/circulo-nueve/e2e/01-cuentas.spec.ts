import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN, codigoTotp, entrar, estado, salir, verificarCodigo } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};

const ASISTENTE = { usuario: "lucia", nombre: "Lucía Asistente", contrasena: "LuciaPropia2026" };
const CLIENTE = { usuario: "cliente.demo", nombre: "Cliente Demo", contrasena: "ClienteDemo2026" };

// Las pruebas comparten estado (la base se reinicia una vez por ejecución) y van en orden.
test.describe.configure({ mode: "serial" });

let provisionalAsistente = "";
let expedienteId = "";

/** Sesión de administración en un contexto aparte, para no gastar el límite de códigos. */
let admin: Page;
async function sesionAdmin(browser: Browser): Promise<Page> {
  if (!admin) {
    admin = await (await browser.newContext()).newPage();
    await entrar(admin, ADMIN.usuario, ADMIN.contrasena);
    await verificarCodigo(admin, estado.secretoAdmin);
  }
  return admin;
}

test.afterAll(async () => {
  await admin?.context().close();
});

test("no hay registro público", async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const { error } = await supabase.auth.signUp({ email: "intruso@usuarios.circulo-nueve.invalid", password: "Intruso2026xx" });
  expect(error?.message).toMatch(/not allowed/i);
});

test("sin sesión, las rutas protegidas llevan a entrar", async ({ page }) => {
  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fadmin%2Fusuarios/);
});

test("alta inicial: rechaza una clave incorrecta y conserva el usuario", async ({ page }) => {
  await page.goto("/setup");
  await captura(page, "01-alta-inicial");
  await page.getByLabel("Clave de alta", { exact: true }).fill("clave-equivocada-0000000000");
  await page.getByLabel("Usuario de administración", { exact: true }).fill(ADMIN.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN.contrasena);
  await page.getByLabel("Repite la contraseña", { exact: true }).fill(ADMIN.contrasena);
  await page.getByRole("button", { name: "Crear administración", exact: true }).click();
  await expect(page.getByText("La clave de alta no es válida.")).toBeVisible();
  await expect(page.getByLabel("Usuario de administración", { exact: true })).toHaveValue(ADMIN.usuario);
});

test("alta inicial con usuario y contraseña; la verificación en dos pasos es opcional", async ({ page }) => {
  await page.goto("/setup");
  await page.getByLabel("Clave de alta", { exact: true }).fill(process.env.E2E_CLAVE_ALTA ?? "");
  await page.getByLabel("Usuario de administración", { exact: true }).fill(ADMIN.usuario.toUpperCase());
  await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN.contrasena);
  await page.getByLabel("Repite la contraseña", { exact: true }).fill(ADMIN.contrasena);
  await page.getByRole("button", { name: "Crear administración", exact: true }).click();

  await expect(page).toHaveURL(/\/cuenta\?bienvenida=1$/);
  await expect(page.getByTestId("bienvenida")).toBeVisible();
  await expect(page.getByTestId("mi-usuario")).toHaveText(ADMIN.usuario);
  await expect(page.getByTestId("mi-mfa")).toHaveText("No activada");
  await expect(page.locator("body")).not.toContainText(".invalid");
  await captura(page, "02-bienvenida-admin");

  // Sin verificación en dos pasos ya administra.
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Administración de usuarios" })).toBeVisible();
});

test("la administración activa la verificación en dos pasos desde su perfil", async ({ page }) => {
  await entrar(page, ADMIN.usuario, ADMIN.contrasena);
  await page.goto("/cuenta");
  await page.getByRole("link", { name: "Activar verificación en dos pasos", exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta\/verificacion/);
  await page.getByRole("button", { name: "Configurar verificación en dos pasos", exact: true }).click();
  const secreto = (await page.getByTestId("secreto-totp").textContent())?.trim() ?? "";
  expect(secreto).toMatch(/^[A-Z2-7]+=*$/);
  estado.secretoAdmin = secreto;
  await captura(page, "03-activar-verificacion");
  await page.getByLabel("Código de 6 dígitos", { exact: true }).fill(await codigoTotp(secreto));
  await page.getByRole("button", { name: "Activar", exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByTestId("mi-mfa")).toHaveText("Activada");
  await salir(page);

  // Desde ahora, la contraseña sola no basta.
  await entrar(page, ADMIN.usuario, ADMIN.contrasena);
  await expect(page).toHaveURL(/\/entrar\/verificar/);
  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/entrar\/verificar/);
});

test("/setup responde 410 tras el alta", async ({ request }) => {
  const r = await request.get("/setup");
  expect(r.status()).toBe(410);
});

test("la administración crea una asistente con contraseña generada y un cliente con contraseña escrita", async ({ browser }) => {
  const page = await sesionAdmin(browser);
  await page.goto("/admin/usuarios");
  const formulario = page.locator("section", { hasText: "Crear una cuenta" });

  await formulario.getByLabel("Nombre", { exact: true }).fill(ASISTENTE.nombre);
  await formulario.getByLabel("Usuario", { exact: true }).fill(ASISTENTE.usuario);
  await formulario.getByLabel("Tipo de cuenta", { exact: true }).selectOption("consultor");
  await formulario.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByText(`Cuenta «${ASISTENTE.usuario}» creada.`)).toBeVisible();
  provisionalAsistente = await page.getByTestId("contrasena-generada").inputValue();
  expect(provisionalAsistente).toMatch(/^([a-z]{3}\d-){3}[a-z]{3}\d$/);
  await captura(page, "04-cuenta-creada");

  await formulario.getByLabel("Nombre", { exact: true }).fill(CLIENTE.nombre);
  await formulario.getByLabel("Usuario", { exact: true }).fill(CLIENTE.usuario);
  await formulario.getByLabel("Tipo de cuenta", { exact: true }).selectOption("cliente");
  await formulario.getByLabel("Contraseña inicial (opcional)", { exact: true }).fill(CLIENTE.contrasena);
  await formulario.getByLabel(/Pedirle que elija su propia contraseña/).uncheck();
  await formulario.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByText(`Cuenta «${CLIENTE.usuario}» creada.`)).toBeVisible();
  await expect(page.getByTestId("contrasena-generada")).toHaveCount(0);

  const fila = page.getByTestId(`usuario-${ASISTENTE.usuario}`);
  await expect(fila).toContainText("Asistente");
  await expect(fila).toContainText("Pendiente de elegir su contraseña");
  await expect(page.getByTestId(`usuario-${CLIENTE.usuario}`)).toContainText("Cliente");
  await expect(page.getByTestId(`usuario-${ADMIN.usuario}`)).toContainText("Dos pasos: activada");

  // Un usuario repetido se rechaza y el formulario conserva lo escrito.
  await formulario.getByLabel("Nombre", { exact: true }).fill("Otra Lucía");
  await formulario.getByLabel("Usuario", { exact: true }).fill(ASISTENTE.usuario);
  await formulario.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(formulario.getByText("Ese usuario ya existe o no es válido.")).toBeVisible();
  await expect(formulario.getByLabel("Nombre", { exact: true })).toHaveValue("Otra Lucía");
  await captura(page, "05-panel-usuarios");
});

test("la asistente debe elegir su contraseña al entrar por primera vez", async ({ page }) => {
  await entrar(page, ASISTENTE.usuario, provisionalAsistente);
  await expect(page).toHaveURL(/\/cuenta\/contrasena\?obligatorio=1/);
  await expect(page.getByTestId("aviso-cambio-obligatorio")).toBeVisible();
  await captura(page, "06-cambio-obligatorio");

  await page.goto("/expedientes");
  await expect(page).toHaveURL(/\/cuenta\/contrasena\?obligatorio=1/);

  await page.getByLabel("Contraseña nueva", { exact: true }).fill(provisionalAsistente);
  await page.getByLabel("Repite la contraseña", { exact: true }).fill(provisionalAsistente);
  await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
  await expect(page.getByText("No se pudo guardar la contraseña")).toBeVisible();

  await page.getByLabel("Contraseña nueva", { exact: true }).fill(ASISTENTE.contrasena);
  await page.getByLabel("Repite la contraseña", { exact: true }).fill(ASISTENTE.contrasena);
  await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
  await expect(page).toHaveURL(/\/expedientes$/);
  await page.getByLabel("Nombre del expediente", { exact: true }).fill("Expediente de Cliente Demo");
  await page.getByLabel("Contiene datos ficticios de demostración (se marcará en los PDF)", { exact: true }).check();
  await page.getByRole("button", { name: "Crear expediente", exact: true }).click();
  await expect(page).toHaveURL(/\/expedientes\/[0-9a-f-]{36}$/);
  expedienteId = page.url().split("/").pop() ?? "";

  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/sin-permiso$/);
});

test("la asistente sin permisos asignados no ve ni crea expedientes", async ({ browser, page }) => {
  const adminPage = await sesionAdmin(browser);
  await adminPage.goto("/admin/usuarios");
  const fila = adminPage.getByTestId(`usuario-${ASISTENTE.usuario}`);
  await fila.getByLabel(/Crear y gestionar sus propios expedientes/).uncheck();
  await fila.getByRole("button", { name: "Guardar permisos", exact: true }).click();
  await expect(fila.getByText("Permisos actualizados.")).toBeVisible();
  await expect(fila).toContainText("Puede: nada todavía");

  await entrar(page, ASISTENTE.usuario, ASISTENTE.contrasena);
  await page.goto("/expedientes");
  await expect(page.getByText("No tienes expedientes todavía.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear expediente", exact: true })).toHaveCount(0);

  await fila.getByLabel(/Crear y gestionar sus propios expedientes/).check();
  await fila.getByRole("button", { name: "Guardar permisos", exact: true }).click();
  await expect(fila).toContainText("Puede: crear y gestionar");
  await page.reload();
  await expect(page.getByRole("link", { name: "Expediente de Cliente Demo", exact: true })).toBeVisible();
});

test("el cliente solo ve su expediente, en lectura", async ({ browser, page }) => {
  const adminPage = await sesionAdmin(browser);
  await adminPage.goto(`/expedientes/${expedienteId}`);
  await adminPage.getByLabel("Cuenta cliente vinculada (podrá ver y descargar este expediente)", { exact: true }).selectOption({ label: CLIENTE.nombre });
  await adminPage.getByRole("button", { name: "Guardar vínculo", exact: true }).click();
  await expect(adminPage.getByText("Cuenta cliente vinculada.")).toBeVisible();

  await entrar(page, CLIENTE.usuario, CLIENTE.contrasena);
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("link", { name: "Preguntar", exact: true })).toHaveCount(0);
  await page.goto("/expedientes");
  await expect(page.locator("section", { hasText: "Expedientes a los que tienes acceso" }).getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("Tu expediente")).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear expediente", exact: true })).toHaveCount(0);
  await page.goto(`/expedientes/${expedienteId}`);
  await expect(page.getByTestId("mis-permisos")).toHaveText("Ver y listar, Abrir y descargar");
  for (const boton of ["Guardar perfil", "Guardar consentimientos", "Guardar lectura", "Generar PDF", "Borrar expediente"]) {
    await expect(page.getByRole("button", { name: boton, exact: true })).toHaveCount(0);
  }
  await captura(page, "07-cliente-solo-lectura");
  await page.goto("/biblioteca/preguntar");
  await expect(page).toHaveURL(/\/sin-permiso$/);
});

test("la administración restablece una contraseña desde el panel", async ({ browser, page }) => {
  const adminPage = await sesionAdmin(browser);
  await adminPage.goto("/admin/usuarios");
  const fila = adminPage.getByTestId(`usuario-${ASISTENTE.usuario}`);
  await fila.getByLabel("Contraseña nueva (opcional)", { exact: true }).fill("Restablecida2026");
  await fila.getByLabel("Pedir que la cambie al entrar", { exact: true }).uncheck();
  await fila.getByRole("button", { name: "Restablecer contraseña", exact: true }).click();
  await expect(fila.getByText("Contraseña restablecida.")).toBeVisible();

  await entrar(page, ASISTENTE.usuario, ASISTENTE.contrasena, { esperaError: true });
  await entrar(page, ASISTENTE.usuario, "Restablecida2026");
  await expect(page).toHaveURL(/\/cuenta$/);
});

test("la administración suspende la cuenta y la asistente pierde el acceso", async ({ browser, page }) => {
  const adminPage = await sesionAdmin(browser);
  await adminPage.goto("/admin/usuarios");
  const fila = adminPage.getByTestId(`usuario-${ASISTENTE.usuario}`);
  await fila.getByRole("button", { name: "Suspender", exact: true }).click();
  await expect(fila.getByTestId("estado-cuenta")).toHaveText("suspendido");
  await expect(adminPage.getByTestId(`usuario-${ADMIN.usuario}`)).toContainText("No puedes cambiar tu propio estado");

  await entrar(page, ASISTENTE.usuario, "Restablecida2026", { esperaError: true });
});

test("un usuario inexistente recibe el mismo mensaje que una contraseña errónea", async ({ page }) => {
  await entrar(page, "no.existe", "Cualquiera2026", { esperaError: true });
  await page.goto("/recuperar");
  await expect(page.getByText(/^Las cuentas no usan correo/)).toBeVisible();
});

test("los botones nuevos tienen ventana explicativa", async ({ page }) => {
  await page.goto("/entrar");
  const boton = page.getByRole("button", { name: "Entrar", exact: true });
  await boton.focus();
  const id = await boton.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${id}"]`)).toBeVisible();
  await captura(page, "08-entrar-tooltip");
});
