import { execFileSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { correoInterno } from "../src/modulos/auth/usuarios";
import { ADMIN, crearCuenta, entrar, estado, supabaseServicio, verificarCodigo } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};

const CARLA = { usuario: "elena", nombre: "Elena Asistente", contrasena: "ElenaDemo20261" };
const DORA = { usuario: "dora", nombre: "Dora Asistente", contrasena: "DoraDemo20261" };

test.describe.configure({ mode: "serial" });

let expedienteId = "";
let carlaId = "";
const enlaces = { revocar: "", vencer: "", agotar: "" };

/** Visitante sin cuenta: contexto nuevo, sin cookies de sesión. */
async function visitante(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

async function crearEnlace(page: Page, opciones: { vence?: string; maximo?: string; nota?: string } = {}): Promise<string> {
  await page.goto(`/expedientes/${expedienteId}`);
  const seccion = page.locator("section", { hasText: "Enlaces para compartir" });
  if (opciones.vence) await seccion.getByLabel("Vence en", { exact: true }).selectOption({ label: opciones.vence });
  if (opciones.maximo) await seccion.getByLabel("Máximo de descargas (opcional)", { exact: true }).fill(opciones.maximo);
  if (opciones.nota) await seccion.getByLabel("Nota para quien lo recibe (opcional)", { exact: true }).fill(opciones.nota);
  await seccion.getByRole("button", { name: "Crear enlace", exact: true }).click();
  await expect(page.getByText("Enlace creado. Cópialo ahora")).toBeVisible();
  const enlace = await page.getByTestId("enlace-nuevo").inputValue();
  expect(enlace).toMatch(/\/compartido\/[A-Za-z0-9_-]{43}$/);
  return new URL(enlace).pathname;
}

async function idDocumento(): Promise<string> {
  const { data } = await supabaseServicio().from("documents").select("id").eq("case_file_id", expedienteId);
  return data?.[0]?.id ?? "";
}

test.beforeAll(async () => {
  carlaId = await crearCuenta(CARLA.usuario, CARLA.nombre, "consultor", CARLA.contrasena);
  await crearCuenta(DORA.usuario, DORA.nombre, "consultor", DORA.contrasena);
});

test("la asistente prepara un expediente con un PDF", async ({ page }) => {
  await entrar(page, CARLA.usuario, CARLA.contrasena);
  await page.goto("/expedientes");
  await page.getByLabel("Nombre del expediente", { exact: true }).fill("Cliente Compartido");
  await page.getByLabel("Contiene datos ficticios de demostración (se marcará en los PDF)", { exact: true }).check();
  await page.getByRole("button", { name: "Crear expediente", exact: true }).click();
  await expect(page).toHaveURL(/\/expedientes\/[0-9a-f-]{36}$/);
  expedienteId = page.url().split("/").pop() ?? "";

  await expect(page.getByText("Nada que compartir todavía")).toBeVisible();
  await page.getByLabel("Guardar el perfil de nacimiento en este expediente.", { exact: true }).check();
  await page.getByLabel("Guardar las lecturas y reportes en el historial del expediente.", { exact: true }).check();
  await page.getByRole("button", { name: "Guardar consentimientos", exact: true }).click();
  await expect(page.getByText("Consentimientos guardados.")).toBeVisible();
  await page.reload();
  await page.getByLabel("Nombre completo de nacimiento", { exact: true }).fill("Elena Pérez Ruiz");
  await page.getByLabel("Fecha de nacimiento", { exact: true }).fill("1988-03-21");
  await page.getByRole("button", { name: "Guardar perfil", exact: true }).click();
  await expect(page.getByText("Perfil guardado.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Guardar lectura", exact: true }).click();
  await expect(page.getByText("Lectura guardada en el historial.")).toBeVisible();
  await page.getByRole("button", { name: "Generar PDF", exact: true }).click();
  await expect(page.getByText(/guardado en «Documentos»/)).toBeVisible();
});

test("crea un enlace y quien lo recibe descarga el PDF sin cuenta", async ({ page, browser }) => {
  await entrar(page, CARLA.usuario, CARLA.contrasena);
  enlaces.revocar = await crearEnlace(page, { nota: "Tu reporte de prueba" });
  await captura(page, "01-crear-enlace");
  await page.reload();
  await expect(page.getByTestId("enlace")).toHaveCount(1);
  await expect(page.getByTestId("enlace")).toContainText("Vigente");
  await expect(page.getByTestId("enlace-nuevo")).toHaveCount(0);

  const otra = await visitante(browser);
  await otra.goto(enlaces.revocar);
  await expect(otra.getByRole("heading", { name: "Documento compartido" })).toBeVisible();
  await expect(otra.getByTestId("documento-compartido")).toHaveCount(1);
  await expect(otra.getByText("Nota: Tu reporte de prueba")).toBeVisible();
  await captura(otra, "02-enlace-publico");

  const href = (await otra.getByRole("link", { name: "Descargar PDF", exact: true }).getAttribute("href")) ?? "";
  const redireccion = await otra.request.get(href, { maxRedirects: 0 });
  expect(redireccion.status()).toBe(303);
  expect(redireccion.headers()["location"]).toMatch(/\/storage\/v1\/object\/sign\/expedientes\/.+token=/);
  const pdf = await otra.request.get(redireccion.headers()["location"] ?? "");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await otra.context().close();

  const { data } = await supabaseServicio().from("share_links").select("accesos, token_hash").eq("case_file_id", expedienteId);
  expect(data?.[0]?.accesos).toBe(1);
  expect(data?.[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(enlaces.revocar).not.toContain(data?.[0]?.token_hash ?? "-");
});

test("sin permiso de compartir no hay enlaces: ni en pantalla ni directo a la base", async ({ page }) => {
  await supabaseServicio()
    .from("case_file_grants")
    .insert({ case_file_id: expedienteId, user_id: (await supabaseServicio().from("user_profiles").select("user_id").eq("username", DORA.usuario).single()).data?.user_id, permissions: ["listar", "abrir_descargar"], granted_by: carlaId });
  await entrar(page, DORA.usuario, DORA.contrasena);
  await page.goto(`/expedientes/${expedienteId}`);
  await expect(page.getByTestId("mis-permisos")).toHaveText("Ver y listar, Abrir y descargar");
  await expect(page.getByRole("heading", { name: "Enlaces para compartir" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Crear enlace", exact: true })).toHaveCount(0);

  const dora = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });
  await dora.auth.signInWithPassword({ email: correoInterno(DORA.usuario), password: DORA.contrasena });
  const { data: user } = await dora.auth.getUser();
  const intento = await dora.from("share_links").insert({
    case_file_id: expedienteId,
    document_id: await idDocumento(),
    token_hash: "a".repeat(64),
    alcance: "documento",
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    created_by: user.user?.id,
  });
  expect(intento.error).not.toBeNull();
  const { data: visibles } = await dora.from("share_links").select("id").eq("case_file_id", expedienteId);
  expect(visibles ?? []).toHaveLength(0);
  const revocar = await dora.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("case_file_id", expedienteId).select("id");
  expect(revocar.data ?? []).toHaveLength(0);
});

test("al revocar, el enlace deja de funcionar de inmediato", async ({ page, browser }) => {
  await entrar(page, CARLA.usuario, CARLA.contrasena);
  await page.goto(`/expedientes/${expedienteId}`);
  await page.getByTestId("enlace").getByRole("button", { name: "Revocar", exact: true }).click();
  await expect(page.getByTestId("enlace")).toContainText("Revocado");
  await page.reload();
  await expect(page.getByTestId("enlace")).toContainText("Revocado");
  await expect(page.getByTestId("enlace").getByRole("button", { name: "Revocar", exact: true })).toHaveCount(0);
  await captura(page, "03-enlace-revocado");

  const otra = await visitante(browser);
  await otra.goto(enlaces.revocar);
  await expect(otra.getByTestId("enlace-no-disponible")).toBeVisible();
  await expect(otra.getByTestId("documento-compartido")).toHaveCount(0);
  await captura(otra, "04-enlace-no-disponible");
  const descarga = await otra.request.get(`${enlaces.revocar}/${await idDocumento()}`, { maxRedirects: 0 });
  expect(descarga.status()).toBe(410);
  await otra.context().close();
});

test("un enlace vencido o sin descargas restantes deja de funcionar", async ({ page, browser }) => {
  await entrar(page, CARLA.usuario, CARLA.contrasena);
  enlaces.vencer = await crearEnlace(page, { vence: "1 hora" });
  enlaces.agotar = await crearEnlace(page, { maximo: "1" });
  const documento = await idDocumento();

  const servicio = supabaseServicio();
  const { data: filas } = await servicio.from("share_links").select("id, created_at").eq("case_file_id", expedienteId).order("created_at");
  const vencer = filas?.[1]?.id ?? "";
  const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();
  await servicio.from("share_links").update({ created_at: hace(120), expires_at: hace(60) }).eq("id", vencer);

  const otra = await visitante(browser);
  await otra.goto(enlaces.vencer);
  await expect(otra.getByTestId("enlace-no-disponible")).toBeVisible();
  expect((await otra.request.get(`${enlaces.vencer}/${documento}`, { maxRedirects: 0 })).status()).toBe(410);

  expect((await otra.request.get(`${enlaces.agotar}/${documento}`, { maxRedirects: 0 })).status()).toBe(303);
  expect((await otra.request.get(`${enlaces.agotar}/${documento}`, { maxRedirects: 0 })).status()).toBe(410);
  await otra.goto(enlaces.agotar);
  await expect(otra.getByTestId("documento-compartido")).toContainText("Sin descargas disponibles");
  await expect(otra.getByRole("link", { name: "Descargar PDF", exact: true })).toHaveCount(0);

  await otra.goto("/compartido/token-que-no-existe");
  await expect(otra.getByTestId("enlace-no-disponible")).toBeVisible();
  expect((await otra.request.get(`/compartido/${"x".repeat(43)}/${documento}`, { maxRedirects: 0 })).status()).toBe(404);
  await otra.context().close();

  await page.reload();
  await expect(page.getByTestId("enlace").filter({ hasText: "Vencido" })).toHaveCount(1);
  await expect(page.getByTestId("enlace").filter({ hasText: "Sin descargas disponibles" })).toHaveCount(1);
});

test("todo queda auditado y la auditoría no guarda el token", async () => {
  const { data } = await supabaseServicio().from("audit_log").select("accion, detalle").eq("expediente_id", expedienteId);
  const acciones = (data ?? []).map((e) => e.accion);
  for (const accion of ["crear_enlace", "abrir_enlace", "descargar_enlace", "revocar_enlace"]) expect(acciones).toContain(accion);
  const texto = JSON.stringify(data);
  for (const enlace of Object.values(enlaces)) expect(texto).not.toContain(enlace.split("/").pop());
  const { data: hashes } = await supabaseServicio().from("share_links").select("token_hash").eq("case_file_id", expedienteId);
  for (const h of hashes ?? []) expect(texto).not.toContain(h.token_hash);
});

test("la administración ajusta la vigencia máxima y la retención", async ({ page }) => {
  test.skip(!estado.secretoAdmin, "Requiere la administración creada en 01-cuentas.spec.ts");
  await entrar(page, ADMIN.usuario, ADMIN.contrasena);
  await verificarCodigo(page, estado.secretoAdmin);
  await page.goto("/admin/ajustes");
  await page.getByLabel("Vigencia máxima de los enlaces para compartir (días)", { exact: true }).fill("3");
  await page.getByLabel("Conservar el registro de enlaces vencidos o revocados (días)", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Guardar ajustes", exact: true }).click();
  await expect(page.getByText(/^Ajustes guardados\./)).toBeVisible();
  await captura(page, "05-ajustes-retencion");

  await page.goto(`/expedientes/${expedienteId}`);
  const vence = page.locator("section", { hasText: "Enlaces para compartir" }).getByLabel("Vence en", { exact: true });
  await expect(vence.locator("option")).toHaveText(["1 hora", "1 día", "3 días"]);
});

test("la purga borra los enlaces vencidos o revocados fuera de plazo", async () => {
  const servicio = supabaseServicio();
  const { data: filas } = await servicio.from("share_links").select("id").eq("case_file_id", expedienteId).not("revoked_at", "is", null);
  const revocado = filas?.[0]?.id ?? "";
  await servicio
    .from("share_links")
    .update({ created_at: "2000-01-01T00:00:00Z", expires_at: "2000-01-02T00:00:00Z", revoked_at: "2000-01-01T12:00:00Z" })
    .eq("id", revocado);
  const salida = execFileSync("npx", ["tsx", "scripts/purgar-retencion.mts"], { env: process.env, stdio: "pipe" }).toString();
  const resumen = JSON.parse(salida.trim().split("\n").pop() ?? "{}");
  expect(resumen.enlaces).toBeGreaterThanOrEqual(1);
  expect((await servicio.from("share_links").select("id").eq("id", revocado)).data).toHaveLength(0);
  expect((await servicio.from("share_links").select("id").eq("case_file_id", expedienteId)).data?.length).toBe(2);
});
