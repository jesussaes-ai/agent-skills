import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { crearCuenta, entrar, supabaseServicio } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};

const CARLA = { usuario: "carla", nombre: "Carla Asistente", contrasena: "CarlaDemo20261" };

test.describe.configure({ mode: "serial" });

let expedienteId = "";

test.beforeAll(async () => {
  await crearCuenta(CARLA.usuario, CARLA.nombre, "consultor", CARLA.contrasena);
});

test("sin consentimiento de historial la carta se calcula pero no se guarda", async ({ page }) => {
  await entrar(page, CARLA.usuario, CARLA.contrasena);
  await page.goto("/expedientes");
  await page.getByLabel("Nombre del expediente", { exact: true }).fill("Carta Demo");
  await page.getByLabel("Contiene datos ficticios de demostración (se marcará en los PDF)", { exact: true }).check();
  await page.getByRole("button", { name: "Crear expediente", exact: true }).click();
  await expect(page).toHaveURL(/\/expedientes\/[0-9a-f-]{36}$/);
  expedienteId = page.url().split("/").pop() ?? "";

  await page.getByLabel("Guardar el perfil de nacimiento en este expediente.", { exact: true }).check();
  await page.getByRole("button", { name: "Guardar consentimientos", exact: true }).click();
  await expect(page.getByText("Consentimientos guardados.")).toBeVisible();
  await page.reload();
  await page.getByLabel("Nombre preferido (opcional)", { exact: true }).fill("Vale");
  await page.getByLabel("Fecha de nacimiento", { exact: true }).fill("1988-11-23");
  await page.getByLabel("Precisión de la hora", { exact: true }).selectOption("exacta");
  await page.getByLabel("Hora local", { exact: true }).fill("06:40");
  await page.getByLabel("Lugar de nacimiento", { exact: true }).fill("Guadalajara, Jalisco");
  await page.getByRole("button", { name: "Guardar perfil", exact: true }).click();
  await expect(page.getByText("Perfil guardado.")).toBeVisible();

  await page.reload();
  const carta = page.locator("section").filter({ has: page.getByRole("heading", { name: "Carta natal", exact: true }) });
  await carta.getByRole("button", { name: "Buscar lugar", exact: true }).click();
  await carta.getByRole("button", { name: /^Guadalajara, Jalisco, México/ }).click();
  await expect(carta.getByText("GeoNames, id")).toBeVisible();
  await expect(carta.getByRole("caption").filter({ hasText: "Posiciones calculadas" })).toBeVisible();
  await expect(carta.getByText("Para guardar la carta, activa")).toBeVisible();
  await expect(carta.getByRole("button", { name: "Guardar carta natal", exact: true })).toBeDisabled();
});

test("con consentimiento se guarda recalculada en el servidor, con versiones, ajustes y huella", async ({ page }) => {
  await entrar(page, CARLA.usuario, CARLA.contrasena);
  await page.goto(`/expedientes/${expedienteId}`);
  await page.getByLabel("Guardar las lecturas y reportes en el historial del expediente.", { exact: true }).check();
  await page.getByRole("button", { name: "Guardar consentimientos", exact: true }).click();
  await expect(page.getByText("Consentimientos guardados.")).toBeVisible();
  await page.reload();

  const carta = page.locator("section").filter({ has: page.getByRole("heading", { name: "Carta natal", exact: true }) });
  await carta.getByRole("button", { name: "Buscar lugar", exact: true }).click();
  await carta.getByRole("button", { name: /^Guadalajara, Jalisco, México/ }).click();
  await carta.getByRole("button", { name: "Ajustes de cálculo (zodiaco, casas, aspectos)", exact: true }).click();
  await carta.getByRole("combobox", { name: "Sistema de casas", exact: true }).selectOption("koch");
  await carta.getByRole("button", { name: "Guardar carta natal", exact: true }).click();
  await expect(page.getByText("Carta natal guardada en el historial, recalculada en el servidor.")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("carta-guardada")).toHaveCount(1);
  await page.getByTestId("carta-guardada").getByRole("button", { name: "Ver carta completa", exact: true }).click();
  await expect(page.getByTestId("carta-guardada").getByText("Cúspides de las casas · Koch")).toBeVisible();
  await captura(page, "carta-natal-expediente");

  const { data } = await supabaseServicio()
    .from("readings")
    .select("sistema, motor, motor_version, reglas_version, entradas_hash, resultado_calculado")
    .eq("case_file_id", expedienteId);
  expect(data).toHaveLength(1);
  const fila = data![0];
  expect(fila).toMatchObject({ sistema: "carta_natal", motor: "circulo-nueve/astrologia", motor_version: "1.0.0", reglas_version: "carta-natal-2026.10" });
  expect(fila.entradas_hash).toMatch(/^[0-9a-f]{64}$/);
  const r = fila.resultado_calculado;
  expect(r.config.sistemaCasas).toBe("koch");
  expect(r.efemerides).toMatch(/astronomy-engine 2\.1\.19/);
  expect(r.tiempo).toMatchObject({ zonaHoraria: "America/Mexico_City", utc: "1988-11-23T12:40:00Z" });
  expect(r.tiempo.versionTzdb).toMatch(/^tzdb \d{4}[a-z] \(ICU de Node\.js\)$/);
  expect(r.entradas).toMatchObject({ fecha: "1988-11-23", hora: "06:40", precisionHora: "exacta" });
  expect(r.entradas.lugar.fuente).toMatchObject({ tipo: "geonames", geonameId: 4005539 });
});

test("el servidor no acepta un lugar inventado ni guarda sin permiso de modificar", async ({ page }) => {
  await entrar(page, CARLA.usuario, CARLA.contrasena);
  await page.goto(`/expedientes/${expedienteId}`);
  const carta = page.locator("section").filter({ has: page.getByRole("heading", { name: "Carta natal", exact: true }) });
  await expect(carta.getByText("GeoNames, id")).toBeVisible();
  await carta.locator('input[name="geonameId"]').evaluate((el: HTMLInputElement) => (el.value = "999999999"));
  await carta.getByRole("button", { name: "Guardar carta natal", exact: true }).click();
  await expect(page.getByText("Ese lugar no está en el catálogo GeoNames de la app.")).toBeVisible();
  const { data } = await supabaseServicio().from("readings").select("id").eq("case_file_id", expedienteId);
  expect(data).toHaveLength(1);
});

test("la carta guardada genera su PDF privado en Documentos", async ({ page }) => {
  await entrar(page, CARLA.usuario, CARLA.contrasena);
  await page.goto(`/expedientes/${expedienteId}`);
  await page.getByTestId("lectura-guardada").getByRole("button", { name: "Generar PDF", exact: true }).click();
  await expect(page.getByText(/Reporte CN-\d{8}-[0-9A-F]{8}\.pdf guardado/)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("documento")).toHaveCount(1);
  const descarga = page.waitForEvent("download");
  await page.getByTestId("documento").getByRole("link", { name: "Descargar", exact: true }).click();
  const pdf = readFileSync(await (await descarga).path());
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  const { data: docs } = await supabaseServicio().from("documents").select("reading_id").eq("case_file_id", expedienteId);
  expect(docs?.[0]?.reading_id).toBeTruthy();
});
