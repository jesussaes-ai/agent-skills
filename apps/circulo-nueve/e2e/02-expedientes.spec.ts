import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, crearCuenta, entrar, estado, salir, supabaseServicio, verificarCodigo } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};

const ANA = { correo: "ana@demo.invalid", nombre: "Ana Consultora", contrasena: "AnaDemo20261" };
const BETO = { correo: "beto@demo.invalid", nombre: "Beto Consultor", contrasena: "BetoDemo20261" };

test.describe.configure({ mode: "serial" });

let expedienteId = "";

test.beforeAll(async () => {
  await crearCuenta(ANA.correo, ANA.nombre, "consultor", ANA.contrasena);
  await crearCuenta(BETO.correo, BETO.nombre, "consultor", BETO.contrasena);
});

test("la consultora crea un expediente; sin consentimiento no se guarda nada", async ({ page }) => {
  await entrar(page, ANA.correo, ANA.contrasena);
  await page.goto("/expedientes");
  await page.getByLabel("Nombre del expediente", { exact: true }).fill("Cliente Demo");
  await page.getByLabel("Contiene datos ficticios de demostración (se marcará en los PDF)", { exact: true }).check();
  await page.getByRole("button", { name: "Crear expediente", exact: true }).click();
  await expect(page).toHaveURL(/\/expedientes\/[0-9a-f-]{36}$/);
  expedienteId = page.url().split("/").pop() ?? "";

  await expect(page.getByText("Para guardar el perfil, primero activa")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar lectura", exact: true })).toBeDisabled();
});

test("consentimientos, perfil y lectura efímera frente a guardada", async ({ page }) => {
  await entrar(page, ANA.correo, ANA.contrasena);
  await page.goto(`/expedientes/${expedienteId}`);
  await page.getByLabel("Guardar el perfil de nacimiento en este expediente.", { exact: true }).check();
  await page.getByLabel("Guardar las lecturas y reportes en el historial del expediente.", { exact: true }).check();
  await page.getByRole("button", { name: "Guardar consentimientos", exact: true }).click();
  await expect(page.getByText("Consentimientos guardados.")).toBeVisible();

  await page.reload();
  await page.getByLabel("Nombre completo de nacimiento", { exact: true }).fill("Ana María Núñez");
  await page.getByLabel("Nombre preferido (opcional)", { exact: true }).fill("Ana");
  await page.getByLabel("Fecha de nacimiento", { exact: true }).fill("1990-07-15");
  await page.getByRole("button", { name: "Guardar perfil", exact: true }).click();
  await expect(page.getByText("Perfil guardado.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Calcular sin guardar", exact: true }).click();
  await expect(page.getByTestId("lectura-efimera").getByTestId("valor-caminoDeVida")).toHaveText("5");
  await expect(page.getByTestId("lectura-guardada")).toHaveCount(0);

  await page.getByRole("button", { name: "Guardar lectura", exact: true }).click();
  await expect(page.getByText("Lectura guardada en el historial.")).toBeVisible();
  await expect(page.getByTestId("lectura-guardada")).toHaveCount(1);
  await expect(page.getByTestId("lectura-guardada").getByTestId("valor-expresion")).toHaveText("3");
});

test("PDF privado: se genera, se descarga con enlace firmado y queda auditado", async ({ page }) => {
  await entrar(page, ANA.correo, ANA.contrasena);
  await page.goto(`/expedientes/${expedienteId}`);
  await page.getByRole("button", { name: "Generar PDF", exact: true }).click();
  await expect(page.getByText(/Reporte CN-\d{8}-[0-9A-F]{8}\.pdf guardado/)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("documento")).toHaveCount(1);
  await captura(page, "01-expediente-consultora");

  const enlace = (await page.getByTestId("documento").getByRole("link", { name: "Descargar", exact: true }).getAttribute("href")) ?? "";
  const respuesta = await page.request.get(enlace, { maxRedirects: 0 });
  expect(respuesta.status()).toBe(303);
  const firmada = respuesta.headers()["location"] ?? "";
  expect(firmada).toMatch(/\/storage\/v1\/object\/sign\/expedientes\/.+token=/);

  const descarga = page.waitForEvent("download");
  await page.getByTestId("documento").getByRole("link", { name: "Descargar", exact: true }).click();
  const archivo = await (await descarga).path();
  expect(readFileSync(archivo).subarray(0, 5).toString()).toBe("%PDF-");

  const { data } = await supabaseServicio().from("audit_log").select("accion").eq("expediente_id", expedienteId);
  expect((data ?? []).filter((e) => e.accion === "descargar").length).toBeGreaterThanOrEqual(1);

  const exportacion = await page.request.get(`/expedientes/${expedienteId}/exportar`);
  expect(exportacion.status()).toBe(200);
  const json = await exportacion.json();
  expect(json.lecturas).toHaveLength(1);
  expect(json.documentos).toHaveLength(1);
  expect(json.perfil.birth_name).toBe("Ana María Núñez");
});

test("otro consultor no ve, no descarga ni exporta el expediente ajeno", async ({ page }) => {
  await entrar(page, BETO.correo, BETO.contrasena);
  await page.goto("/expedientes");
  await expect(page.getByText("No tienes expedientes todavía.")).toBeVisible();
  const detalle = await page.request.get(`/expedientes/${expedienteId}`);
  expect(detalle.status()).toBe(404);
  const { data: docs } = await supabaseServicio().from("documents").select("id").eq("case_file_id", expedienteId);
  const descarga = await page.request.get(`/expedientes/${expedienteId}/documentos/${docs?.[0]?.id}`, { maxRedirects: 0 });
  expect(descarga.status()).toBe(404);
  expect((await page.request.get(`/expedientes/${expedienteId}/exportar`)).status()).toBe(404);
});

test("administración asigna lectura a otro consultor y ve la actividad", async ({ page }) => {
  test.skip(!estado.secretoAdmin, "Requiere la administración creada en cuentas.spec.ts");
  await entrar(page, ADMIN.correo, ADMIN.contrasena);
  await verificarCodigo(page, estado.secretoAdmin);
  await page.goto(`/expedientes/${expedienteId}`);
  const permisos = page.locator("section", { hasText: "Permisos del expediente" });
  await permisos.getByLabel("Persona", { exact: true }).selectOption({ label: BETO.nombre });
  await permisos.getByRole("button", { name: "Asignar permisos", exact: true }).click();
  await expect(page.getByText("Permisos del expediente actualizados.")).toBeVisible();
  await expect(page.getByTestId("auditoria")).toContainText("descargar");
  await captura(page, "02-expediente-administracion");
  await salir(page);

  await entrar(page, BETO.correo, BETO.contrasena);
  await page.goto(`/expedientes/${expedienteId}`);
  await expect(page.getByTestId("mis-permisos")).toHaveText("Ver y listar, Abrir y descargar");
  await expect(page.getByRole("button", { name: "Guardar perfil", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Borrar expediente", exact: true })).toHaveCount(0);
  const descarga = page.waitForEvent("download");
  await page.getByTestId("documento").getByRole("link", { name: "Descargar", exact: true }).click();
  expect(readFileSync(await (await descarga).path()).subarray(0, 5).toString()).toBe("%PDF-");
  await captura(page, "03-expediente-solo-lectura");
});

test("la purga por retención borra archivo y registro vencidos", async () => {
  const servicio = supabaseServicio();
  const { data: docs } = await servicio.from("documents").select("id, storage_path").eq("case_file_id", expedienteId);
  const doc = docs?.[0];
  expect(doc).toBeTruthy();
  await servicio.from("documents").update({ retener_hasta: "2000-01-01" }).eq("id", doc!.id);
  execFileSync("npx", ["tsx", "scripts/purgar-retencion.mts"], { env: process.env, stdio: "pipe" });
  const { data: despues } = await servicio.from("documents").select("id").eq("id", doc!.id);
  expect(despues).toHaveLength(0);
  const { data: objetos } = await servicio.storage.from("expedientes").list(expedienteId);
  expect(objetos ?? []).toHaveLength(0);
});

test("la consultora borra el expediente y sus archivos", async ({ page }) => {
  await entrar(page, ANA.correo, ANA.contrasena);
  await page.goto(`/expedientes/${expedienteId}`);
  await page.getByRole("button", { name: "Generar PDF", exact: true }).click();
  await expect(page.getByText(/guardado en «Documentos»/)).toBeVisible();
  await page.getByLabel("Escribe BORRAR para confirmar", { exact: true }).fill("BORRAR");
  await page.getByRole("button", { name: "Borrar expediente", exact: true }).click();
  await expect(page).toHaveURL(/\/expedientes\?borrado=1$/);
  const servicio = supabaseServicio();
  expect((await servicio.from("case_files").select("id").eq("id", expedienteId)).data).toHaveLength(0);
  expect((await servicio.storage.from("expedientes").list(expedienteId)).data ?? []).toHaveLength(0);
});

test("recuperación de emergencia de la administración (script de servidor)", async () => {
  const salida = execFileSync(
    "npx",
    ["tsx", "scripts/admin-emergencia.mts", "--correo", BETO.correo, "--motivo", "Prueba e2e de recuperación de emergencia", "--quitar-mfa"],
    { env: process.env, stdio: "pipe" },
  ).toString();
  const { usuarioId } = JSON.parse(salida.trim().split("\n").pop() ?? "{}");
  const servicio = supabaseServicio();
  const { data: roles } = await servicio.from("user_roles").select("role_id").eq("user_id", usuarioId);
  expect((roles ?? []).map((r) => r.role_id)).toContain("admin");
  const { data: auditoria } = await servicio.from("audit_log").select("detalle").eq("accion", "recuperacion_emergencia_admin");
  expect(auditoria?.[0]?.detalle).toMatchObject({ motivo: "Prueba e2e de recuperación de emergencia" });
});
