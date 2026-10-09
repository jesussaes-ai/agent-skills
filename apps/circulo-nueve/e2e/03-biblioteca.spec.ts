import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { HTML_DEMO, MD_DEMO, MD_INYECCION } from "../src/modulos/biblioteca/pruebas/documentos-demo";
import { ADMIN, entrar, estado, supabaseServicio, verificarCodigo } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};

const PUERTO_WEB = 3998;
const carpeta = mkdtempSync(join(tmpdir(), "cn-biblioteca-"));
let servidor: Server;
let contexto: BrowserContext;
let page: Page;

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeAll(async ({ browser }) => {
  writeFileSync(join(carpeta, "manual-demo.md"), MD_DEMO);
  writeFileSync(join(carpeta, "nota-inyeccion.md"), MD_INYECCION);
  writeFileSync(join(carpeta, "falso.pdf"), "Esto es texto, no un PDF.");
  servidor = createServer((req, res) => {
    if (req.url === "/robots.txt") return res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\nAllow: /\n");
    if (req.url === "/articulo-demo") return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(HTML_DEMO);
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => servidor.listen(PUERTO_WEB, "127.0.0.1", r));
  // Una sola sesión de administración para todo el archivo: la verificación en dos
  // pasos tiene un límite de intentos y cada código TOTP solo sirve una vez.
  contexto = await browser.newContext();
  page = await contexto.newPage();
  if (estado.secretoAdmin) {
    await entrar(page, ADMIN.usuario, ADMIN.contrasena);
    await verificarCodigo(page, estado.secretoAdmin);
  }
});

test.afterAll(async () => {
  servidor?.close();
  await contexto?.close();
});

async function entrarAdmin(_: Page) {
  test.skip(!estado.secretoAdmin, "Requiere la administración creada en 01-cuentas.spec.ts");
}

async function completarMetadatos(zona: Locator, titulo: string, grupo: "aportada" | "complementaria") {
  await zona.getByLabel("Título", { exact: true }).fill(titulo);
  await zona.getByLabel("Referencia", { exact: true }).fill("Archivo de pruebas de Círculo Nueve");
  await zona.getByLabel("Grupo", { exact: true }).selectOption(grupo);
  await zona.getByLabel("Licencia o permiso de uso", { exact: true }).fill("Texto propio de demostración");
  await zona.getByLabel("Es un documento ficticio de demostración", { exact: true }).check();
  await zona.getByLabel(/Confirmo que tengo derecho/).check();
}

async function procesar(page: Page, esperado: RegExp) {
  await page.goto("/biblioteca");
  await page.getByRole("button", { name: "Procesar pendientes ahora", exact: true }).click();
  await expect(page.getByText(esperado).first()).toBeVisible({ timeout: 150_000 });
}

async function aprobar(page: Page, titulo: string) {
  await page.goto("/biblioteca");
  await page.getByRole("link", { name: titulo, exact: true }).click();
  await expect(page.getByTestId("fragmento").first()).toBeVisible();
  await page.getByRole("button", { name: "Aprobar e indexar", exact: true }).click();
  await expect(page.getByText(/^Versión aprobada:/)).toBeVisible();
}

test("el centro de carga rechaza un archivo con formato falso", async () => {
  await entrarAdmin(page);
  await page.goto("/biblioteca");
  const zona = page.locator("section", { hasText: "Centro de carga" });
  await zona.getByLabel("Archivo", { exact: true }).setInputFiles(join(carpeta, "falso.pdf"));
  await completarMetadatos(zona, "Falso PDF (DEMO)", "aportada");
  await zona.getByRole("button", { name: "Cargar a cuarentena", exact: true }).click();
  await expect(zona.getByText(/El contenido real es TXT, pero el nombre termina en «\.pdf»/)).toBeVisible();
});

test("fuente aportada: carga, extracción, revisión e indexado", async () => {
  await entrarAdmin(page);
  await page.goto("/biblioteca");
  const zona = page.locator("section", { hasText: "Centro de carga" });
  await zona.getByLabel("Archivo", { exact: true }).setInputFiles(join(carpeta, "manual-demo.md"));
  await completarMetadatos(zona, "Manual ficticio (DEMO)", "aportada");
  await zona.getByRole("button", { name: "Cargar a cuarentena", exact: true }).click();
  await expect(page.getByText("quedó en cuarentena")).toBeVisible();

  await procesar(page, /requiere_revision: \d+ fragmentos listos para revisión/);
  await page.getByRole("link", { name: "Manual ficticio (DEMO)", exact: true }).click();
  await expect(page.getByTestId("markdown")).toContainText("Los números maestros");
  await expect(page.getByTestId("fragmento").filter({ hasText: "números maestros 11, 22 y 33" })).toContainText("secc. «Los números maestros»");
  await captura(page, "01-revision-fuente");
  await page.getByRole("button", { name: "Aprobar e indexar", exact: true }).click();
  await expect(page.getByText(/^Versión aprobada:/)).toBeVisible();

  await procesar(page, /indexado: \d+ fragmentos indexados con Xenova\/multilingual-e5-small/);
  await expect(page.getByTestId("fuente-Manual ficticio (DEMO)").getByTestId("estado-fuente")).toHaveText("Indexado");
});

test("la inyección se marca en la revisión y se puede excluir", async () => {
  await entrarAdmin(page);
  await page.goto("/biblioteca");
  const zona = page.locator("section", { hasText: "Centro de carga" });
  await zona.getByLabel("Archivo", { exact: true }).setInputFiles(join(carpeta, "nota-inyeccion.md"));
  await completarMetadatos(zona, "Nota con inyección (DEMO)", "aportada");
  await zona.getByRole("button", { name: "Cargar a cuarentena", exact: true }).click();
  await expect(page.getByText("quedó en cuarentena")).toBeVisible();
  await procesar(page, /marcados como posible instrucción incrustada/);

  await page.getByRole("link", { name: "Nota con inyección (DEMO)", exact: true }).click();
  const sospechoso = page.getByTestId("fragmento").filter({ hasText: "Posible instrucción incrustada" });
  await expect(sospechoso).toHaveCount(1);
  await sospechoso.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(sospechoso).toContainText("Excluido");
  await captura(page, "02-inyeccion-marcada");
  await page.getByRole("button", { name: "Aprobar e indexar", exact: true }).click();
  await expect(page.getByText(/^Versión aprobada:/)).toBeVisible();
  await procesar(page, /indexado: 0 fragmentos indexados/);
});

test("página web complementaria: robots, Markdown, metadatos e indexado", async () => {
  await entrarAdmin(page);
  await page.goto("/biblioteca");
  const zona = page.locator("section", { hasText: "Añadir una página web" });
  await zona.getByLabel("Dirección de la página", { exact: true }).fill(`http://127.0.0.1:${PUERTO_WEB}/articulo-demo`);
  await completarMetadatos(zona, "Página ficticia (DEMO)", "complementaria");
  await zona.getByRole("button", { name: "Añadir página web", exact: true }).click();
  await expect(page.getByText("Página añadida")).toBeVisible();
  await procesar(page, /requiere_revision/);

  await page.getByRole("link", { name: "Página ficticia (DEMO)", exact: true }).click();
  await expect(page.getByTestId("markdown")).toContainText("introspección");
  await expect(page.getByTestId("markdown")).not.toContainText("Menú que no debe aparecer");
  await expect(page.getByText(`http://127.0.0.1:${PUERTO_WEB}/articulo-demo`, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Aprobar e indexar", exact: true }).click();
  await expect(page.getByText(/^Versión aprobada:/)).toBeVisible();
  await procesar(page, /indexado: \d+ fragmentos indexados/);

  const { data } = await supabaseServicio().from("sources").select("autor, fecha_publicacion, fecha_consulta").eq("titulo", "Página ficticia (DEMO)").single();
  expect(data).toMatchObject({ autor: "Redacción ficticia", fecha_publicacion: "2026-01-15" });
  expect(data?.fecha_consulta).toBeTruthy();
});

test("bot: responde con citas de fuentes aportadas y mide la proporción", async () => {
  await entrarAdmin(page);
  await page.goto("/biblioteca/preguntar");
  await page.getByLabel("Tu pregunta", { exact: true }).fill("¿Qué son los números maestros?");
  await page.getByRole("button", { name: "Preguntar a la biblioteca", exact: true }).click();
  const respuesta = page.getByTestId("respuesta-biblioteca");
  await expect(respuesta).toContainText("11, 22 y 33", { timeout: 120_000 });
  await expect(respuesta).toContainText("Manual ficticio (DEMO)");
  await expect(respuesta).toContainText("secc. «Los números maestros»");
  await expect(respuesta).not.toContainText("tendrá suerte");
  await expect(page.getByTestId("proporcion")).toContainText("100 %");
  await respuesta.getByRole("button", { name: "Ver pasaje", exact: true }).first().click();
  await expect(respuesta.locator("blockquote").first()).toBeVisible();
  await captura(page, "03-bot-citas");
});

test("bot: sin respaldo en aportadas pide autorización para complementarias", async () => {
  await entrarAdmin(page);
  await page.goto("/biblioteca/preguntar");
  await page.getByLabel("Tu pregunta", { exact: true }).fill("¿Qué dice sobre la introspección?");
  await page.getByRole("button", { name: "Preguntar a la biblioteca", exact: true }).click();
  await expect(page.getByTestId("sin-respaldo")).toContainText("No encontré respaldo en las fuentes aportadas", { timeout: 120_000 });
  await page.getByRole("button", { name: "Buscar también en complementarias", exact: true }).click();
  const respuesta = page.getByTestId("respuesta-biblioteca");
  await expect(respuesta).toContainText("Página ficticia (DEMO)");
  await expect(respuesta).toContainText("Complementaria");
  await expect(page.getByTestId("proporcion")).toContainText("No cumple");
  await captura(page, "04-bot-complementarias");
});

test("bot: una pregunta ajena no inventa respaldo", async () => {
  await entrarAdmin(page);
  await page.goto("/biblioteca/preguntar");
  await page.getByLabel("Tu pregunta", { exact: true }).fill("¿Cuál es la capital de Francia?");
  await page.getByLabel("Incluir también fuentes complementarias", { exact: true }).check();
  await page.getByRole("button", { name: "Preguntar a la biblioteca", exact: true }).click();
  await expect(page.getByTestId("sin-respaldo")).toContainText("No encontré fragmentos", { timeout: 120_000 });
});

test("retirar una fuente borra fragmentos y archivos", async () => {
  await entrarAdmin(page);
  const servicio = supabaseServicio();
  const { data: fuente } = await servicio.from("sources").select("id").eq("titulo", "Página ficticia (DEMO)").single();
  await page.goto(`/biblioteca/fuentes/${fuente!.id}`);
  await page.getByLabel("Escribe RETIRAR para confirmar", { exact: true }).fill("RETIRAR");
  await page.getByRole("button", { name: "Retirar fuente", exact: true }).click();
  await expect(page).toHaveURL(/\/biblioteca\?retirada=1$/);
  expect((await servicio.from("source_versions").select("id").eq("source_id", fuente!.id)).data).toHaveLength(0);
  expect((await servicio.storage.from("biblioteca-derivados").list(fuente!.id)).data ?? []).toHaveLength(0);
  const { data: estadoFuente } = await servicio.from("sources").select("estado").eq("id", fuente!.id).single();
  expect(estadoFuente?.estado).toBe("retirado");
});
