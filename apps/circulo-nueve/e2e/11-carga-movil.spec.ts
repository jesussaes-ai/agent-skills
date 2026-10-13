import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { crearCuenta, entrar, supabaseServicio } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};

const ASISTENTE = { usuario: "carga.asistente", nombre: "Asistente de carga", contrasena: "CargaAsist2026" };
const CLIENTE = { usuario: "carga.cliente", nombre: "Cliente de carga", contrasena: "CargaCliente2026" };
const ADMIN_FUENTES = { usuario: "carga.admin", nombre: "Administración de carga", contrasena: "CargaAdmin2026" };

const PANTALLAS = [
  { nombre: "movil", width: 390, height: 844 },
  { nombre: "tableta", width: 768, height: 1024 },
  { nombre: "tableta-horizontal", width: 1024, height: 1366 },
] as const;

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
const FOTO = readFileSync(join(__dirname, "../src/modulos/biblioteca/pruebas/ocr-demo.png"));

test.describe.configure({ mode: "serial" });

let expedienteId = "";

test.beforeAll(async () => {
  const asistenteId = await crearCuenta(ASISTENTE.usuario, ASISTENTE.nombre, "consultor", ASISTENTE.contrasena);
  const clienteId = await crearCuenta(CLIENTE.usuario, CLIENTE.nombre, "cliente", CLIENTE.contrasena);
  await crearCuenta(ADMIN_FUENTES.usuario, ADMIN_FUENTES.nombre, "admin", ADMIN_FUENTES.contrasena);
  const { data, error } = await supabaseServicio()
    .from("case_files")
    .insert({ display_label: "Expediente para subir (DEMO)", created_by: asistenteId, client_user_id: clienteId, es_demo: true })
    .select("id")
    .single();
  if (error) throw error;
  expedienteId = data.id;
});

async function nuevaSesion(browser: Browser, pantalla: (typeof PANTALLAS)[number], cuenta: { usuario: string; contrasena: string }) {
  const contexto = await browser.newContext({
    viewport: { width: pantalla.width, height: pantalla.height },
    hasTouch: pantalla.width < 1024,
    locale: "es-MX",
  });
  const page = await contexto.newPage();
  await entrar(page, cuenta.usuario, cuenta.contrasena);
  return page;
}

async function sinDesbordeHorizontal(page: Page) {
  const { ancho, visible } = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, visible: window.innerWidth }));
  expect(ancho).toBeLessThanOrEqual(visible);
}

for (const pantalla of PANTALLAS) {
  test(`expediente a ${pantalla.width} px: el botón de subir se ve arriba y sube PDF y fotos con avance`, async ({ browser }) => {
    const page = await nuevaSesion(browser, pantalla, ASISTENTE);
    await page.goto("/expedientes");
    await expect(page.getByTestId("pista-subir")).toBeVisible();
    await page.getByRole("link", { name: "Expediente para subir (DEMO)", exact: true }).click();

    const atajo = page.getByRole("link", { name: "Subir documentos o fotos", exact: true });
    await expect(atajo).toBeInViewport();
    await captura(page, `carga-${pantalla.nombre}-01-expediente-arriba`);
    await atajo.click();
    await expect(page).toHaveURL(/#subir-documentos$/);
    const zona = page.locator("#subir-documentos");
    for (const nombre of ["Elegir archivos", "Tomar foto", "Galería"]) {
      await expect(zona.getByRole("button", { name: nombre, exact: true })).toBeInViewport();
    }
    await sinDesbordeHorizontal(page);

    await expect(zona.getByTestId("entrada-camara")).toHaveAttribute("capture", "environment");
    await expect(zona.getByTestId("entrada-camara")).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    await expect(zona.getByTestId("entrada-galeria")).toHaveAttribute("multiple", "");
    await expect(zona.getByTestId("entrada-archivos")).toHaveAttribute("accept", ".pdf,.jpg,.jpeg,.png,.webp");

    // La ventana explicativa aparece al tocar el botón.
    await zona.getByRole("button", { name: "Tomar foto", exact: true }).hover();
    await expect(page.getByRole("tooltip").filter({ hasText: "Abre la cámara" })).toBeVisible();

    await zona.getByTestId("entrada-archivos").setInputFiles([
      { name: `carta-${pantalla.nombre}.pdf`, mimeType: "application/pdf", buffer: PDF },
      { name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("esto no es un PDF") },
    ]);
    await zona.getByTestId("entrada-camara").setInputFiles({ name: `foto-${pantalla.nombre}.png`, mimeType: "image/png", buffer: FOTO });
    await zona.getByTestId("entrada-galeria").setInputFiles({ name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: FOTO });
    await expect(zona.getByRole("alert").filter({ hasText: "IMG_0001.HEIC" })).toContainText("HEIC no se admiten");
    await expect(zona.getByTestId("archivo-en-cola")).toHaveCount(3);
    await captura(page, `carga-${pantalla.nombre}-02-cola`);

    await zona.getByRole("button", { name: "Subir al expediente", exact: true }).click();
    await expect(zona.getByText(/Subidos 2 de 3/)).toBeVisible({ timeout: 30_000 });
    const filas = zona.getByTestId("archivo-en-cola");
    await expect(filas.filter({ hasText: `carta-${pantalla.nombre}.pdf` }).getByTestId("estado-archivo")).toHaveText("Subido");
    await expect(filas.filter({ hasText: `foto-${pantalla.nombre}.png` }).getByTestId("estado-archivo")).toHaveText("Subido");
    await expect(filas.filter({ hasText: `foto-${pantalla.nombre}.png` }).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    await expect(filas.filter({ hasText: "falso.pdf" })).toContainText(/El contenido real es TXT/);
    await captura(page, `carga-${pantalla.nombre}-03-resultado`);

    const documento = page.getByTestId("documento").filter({ hasText: `foto-${pantalla.nombre}.png` });
    await expect(documento).toContainText("Subido");
    const descarga = await page.request.get((await documento.getByRole("link", { name: "Descargar", exact: true }).getAttribute("href")) ?? "", { maxRedirects: 0 });
    expect(descarga.status()).toBe(303);

    const { data: registro } = await supabaseServicio()
      .from("documents")
      .select("tipo, sha256, storage_path")
      .eq("case_file_id", expedienteId)
      .eq("nombre", `foto-${pantalla.nombre}.png`)
      .single();
    expect(registro?.tipo).toBe("adjunto");
    expect(registro?.sha256).toMatch(/^[0-9a-f]{64}$/);
    // El archivo rechazado no queda en el almacenamiento.
    const { data: objetos } = await supabaseServicio().storage.from("expedientes").list(expedienteId);
    const { count } = await supabaseServicio().from("documents").select("id", { count: "exact", head: true }).eq("case_file_id", expedienteId);
    expect(objetos?.length).toBe(count);

    if (pantalla.width === 390) {
      const { violations } = await new AxeBuilder({ page }).include("#subir-documentos").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(violations.map((v) => v.id)).toEqual([]);
    }
    await page.context().close();
  });
}

test("la cuenta cliente ve sus documentos pero no puede subir", async ({ browser }) => {
  const page = await nuevaSesion(browser, PANTALLAS[0], CLIENTE);
  await page.goto(`/expedientes/${expedienteId}`);
  await expect(page.getByTestId("documento").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Subir documentos o fotos", exact: true })).toHaveCount(0);
  await expect(page.locator("#subir-documentos")).toHaveCount(0);
  await page.context().close();
});

test("biblioteca a 390 px: «Subir archivos» en el menú, fotos de la galería sin título y numeradas", async ({ browser }) => {
  const page = await nuevaSesion(browser, PANTALLAS[0], ADMIN_FUENTES);
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Subir archivos", exact: true }).click();
  await expect(page).toHaveURL(/\/biblioteca#centro-de-carga$/);
  const zona = page.locator("#centro-de-carga");
  await expect(zona.getByRole("button", { name: "Tomar foto", exact: true })).toBeInViewport();
  await sinDesbordeHorizontal(page);
  await captura(page, "carga-movil-04-biblioteca");

  await zona.getByTestId("entrada-galeria").setInputFiles([
    { name: "pagina_1.png", mimeType: "image/png", buffer: FOTO },
    { name: "pagina_2.png", mimeType: "image/png", buffer: FOTO },
  ]);
  await zona.getByLabel("Título", { exact: true }).fill("Apuntes fotografiados (DEMO)");
  await zona.getByLabel("Referencia", { exact: true }).fill("Archivo de pruebas de Círculo Nueve");
  await zona.getByLabel("Licencia o permiso de uso", { exact: true }).fill("Material propio de demostración");
  await zona.getByLabel("Es un documento ficticio de demostración", { exact: true }).check();
  await zona.getByLabel(/Confirmo que tengo derecho/).check();
  await zona.getByRole("button", { name: "Cargar a cuarentena", exact: true }).click();
  await expect(zona.getByText(/^Listo: 2 de 2 en cuarentena/)).toBeVisible({ timeout: 30_000 });
  await expect(zona.getByTestId("estado-archivo")).toHaveText(["Subido", "Subido"]);
  await captura(page, "carga-movil-05-biblioteca-subido");

  const { data: fuentes } = await supabaseServicio().from("sources").select("id, titulo, formato, estado").like("titulo", "Apuntes fotografiados (DEMO)%").order("titulo");
  expect(fuentes?.map((f) => [f.titulo, f.formato, f.estado])).toEqual([
    ["Apuntes fotografiados (DEMO) (1 de 2)", "png", "pendiente"],
    ["Apuntes fotografiados (DEMO) (2 de 2)", "png", "pendiente"],
  ]);
  const { count } = await supabaseServicio().from("ingestion_jobs").select("id", { count: "exact", head: true }).in("source_id", fuentes?.map((f) => f.id) ?? []).eq("formato_detectado", "png");
  expect(count).toBe(2);
  await page.context().close();
});

test("biblioteca en computadora: arrastrar y soltar añade archivos a la lista", async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "es-MX" });
  const page = await contexto.newPage();
  await entrar(page, ADMIN_FUENTES.usuario, ADMIN_FUENTES.contrasena);
  await page.goto("/biblioteca");
  const zona = page.locator("#centro-de-carga").getByTestId("zona-carga");
  await expect(zona).toContainText("arrastra y suelta");
  const datos = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["Texto de prueba para soltar."], "nota-soltada.txt", { type: "text/plain" }));
    dt.items.add(new File(["x"], "programa.exe", { type: "application/octet-stream" }));
    return dt;
  });
  await zona.dispatchEvent("dragover", { dataTransfer: datos });
  await zona.dispatchEvent("drop", { dataTransfer: datos });
  await expect(page.getByTestId("archivo-en-cola")).toHaveCount(1);
  await expect(page.getByTestId("archivo-en-cola")).toContainText("nota-soltada.txt");
  await expect(page.locator("#centro-de-carga").getByRole("alert")).toContainText("programa.exe");
  await contexto.close();
});
