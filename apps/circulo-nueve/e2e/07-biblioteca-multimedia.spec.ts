import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { EICAR, audioDemo, pdfConFiguraDemo, pptxDemo, xlsxDemo } from "../src/modulos/biblioteca/pruebas/documentos-demo";
import { ADMIN, entrar, estado, supabaseServicio, verificarCodigo } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const carpeta = mkdtempSync(join(tmpdir(), "cn-multimedia-"));
const hayClamav = (() => {
  try {
    execFileSync("clamscan", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

let contexto: BrowserContext;
let page: Page;

test.describe.configure({ mode: "serial", timeout: 600_000 });

test.beforeAll(async ({ browser }) => {
  writeFileSync(join(carpeta, "tabla-demo.xlsx"), await xlsxDemo());
  writeFileSync(join(carpeta, "curso-demo.pptx"), await pptxDemo());
  writeFileSync(join(carpeta, "grabacion-demo.wav"), audioDemo());
  writeFileSync(join(carpeta, "atlas-demo.pdf"), await pdfConFiguraDemo());
  writeFileSync(join(carpeta, "eicar-demo.txt"), EICAR);
  const linea = "DEMO ficticio: línea de relleno para probar la carga directa a Storage de un archivo grande.\n";
  writeFileSync(join(carpeta, "grande-demo.txt"), linea.repeat(Math.ceil((5 * 1024 * 1024) / linea.length)));
  contexto = await browser.newContext();
  page = await contexto.newPage();
  if (estado.secretoAdmin) {
    await entrar(page, ADMIN.correo, ADMIN.contrasena);
    await verificarCodigo(page, estado.secretoAdmin);
  }
});

test.afterAll(async () => contexto?.close());

function requiereAdmin() {
  test.skip(!estado.secretoAdmin, "Requiere la administración creada en 01-cuentas.spec.ts");
}

async function cargar(archivo: string, titulo: string, { derechos = true } = {}) {
  await page.goto("/biblioteca");
  const zona = page.locator("section", { hasText: "Centro de carga" });
  await zona.getByLabel("Archivo", { exact: true }).setInputFiles(join(carpeta, archivo));
  await zona.getByLabel("Título", { exact: true }).fill(titulo);
  await zona.getByLabel("Referencia", { exact: true }).fill("Archivo de pruebas de Círculo Nueve");
  await zona.getByLabel("Licencia o permiso de uso", { exact: true }).fill("Material propio de demostración");
  await zona.getByLabel("Es un documento ficticio de demostración", { exact: true }).check();
  if (derechos) await zona.getByLabel(/Confirmo que tengo derecho/).check();
  await zona.getByRole("button", { name: "Cargar a cuarentena", exact: true }).click();
  return zona;
}

async function procesarTodo() {
  for (let i = 0; i < 10; i++) {
    await page.goto("/biblioteca");
    if ((await page.getByTestId("pendientes").textContent())?.trim() === "0") return;
    await page.getByRole("button", { name: "Procesar pendientes ahora", exact: true }).click();
    await expect(page.getByRole("button", { name: "Procesar pendientes ahora", exact: true })).toBeEnabled({ timeout: 540_000 });
  }
}

async function abrir(titulo: string): Promise<Locator> {
  await page.goto("/biblioteca");
  await page.getByRole("link", { name: titulo, exact: true }).click();
  return page.locator("main");
}

test("el formulario conserva lo escrito si falta la confirmación de derechos", async () => {
  requiereAdmin();
  const zona = await cargar("tabla-demo.xlsx", "Tabla que no se envía (DEMO)", { derechos: false });
  await expect(zona.getByText("Confirma que tienes derecho a usar esta fuente.")).toBeVisible();
  await expect(zona.getByLabel("Título", { exact: true })).toHaveValue("Tabla que no se envía (DEMO)");
  await expect(zona.getByLabel("Licencia o permiso de uso", { exact: true })).toHaveValue("Material propio de demostración");
  await expect(zona.getByText("vuelve a elegir el archivo")).toBeVisible();
});

test("hojas, presentaciones, audio y figuras: extracción con su localizador", async () => {
  requiereAdmin();
  for (const [archivo, titulo] of [
    ["tabla-demo.xlsx", "Tabla ficticia (DEMO)"],
    ["curso-demo.pptx", "Curso ficticio (DEMO)"],
    ["grabacion-demo.wav", "Grabación ficticia (DEMO)"],
    ["atlas-demo.pdf", "Atlas ficticio (DEMO)"],
  ]) {
    await cargar(archivo, titulo);
    await expect(page.getByText("quedó en cuarentena")).toBeVisible();
  }
  await procesarTodo();

  let main = await abrir("Tabla ficticia (DEMO)");
  await expect(main.getByTestId("fragmento").first()).toContainText("hoja «Tabla ficticia», celdas A2:B3");
  main = await abrir("Curso ficticio (DEMO)");
  await expect(main.getByTestId("fragmento").nth(1)).toContainText("diapositiva 2");
  main = await abrir("Grabación ficticia (DEMO)");
  await expect(main.getByTestId("markdown")).toContainText(/\[00:00–00:0\d\]/);
  await expect(main.getByTestId("markdown")).toContainText(/ficticia/i);
  await expect(main.getByText(/Transcripción automática/).first()).toBeVisible();

  main = await abrir("Atlas ficticio (DEMO)");
  const figura = main.getByTestId("figura");
  await expect(figura).toContainText("Figura 1. Diagrama ficticio del ciclo del nueve (DEMO)");
  await expect(figura).toContainText("Descripción generada");
  await expect(figura).toContainText("plantilla-leyenda-ocr-v1");
  const imagen = await page.request.get((await figura.locator("img").getAttribute("src")) ?? "", { maxRedirects: 0 });
  expect(imagen.status()).toBe(303);
  expect((await page.request.get(imagen.headers()["location"] ?? "")).headers()["content-type"]).toContain("image/png");
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/01-revision-figura.png`, fullPage: true });
  await figura.getByLabel("Corrección de la descripción (administración)", { exact: true }).fill("Diagrama circular ficticio con nueve puntos.");
  await figura.getByRole("button", { name: "Guardar corrección", exact: true }).click();
  await expect(page.getByText("Corrección guardada")).toBeVisible();
});

test("el bot cita la figura y abre su imagen con un enlace temporal", async () => {
  requiereAdmin();
  await abrir("Atlas ficticio (DEMO)");
  await page.getByRole("button", { name: "Aprobar e indexar", exact: true }).click();
  await expect(page.getByText(/^Versión aprobada:/)).toBeVisible();
  await procesarTodo();

  await page.goto("/biblioteca/preguntar");
  await page.getByLabel("Tu pregunta", { exact: true }).fill("¿Qué muestra el diagrama ficticio del ciclo del nueve?");
  await page.getByRole("button", { name: "Preguntar a la biblioteca", exact: true }).click();
  const respuesta = page.getByTestId("respuesta-biblioteca");
  await expect(respuesta).toContainText("figura 1", { timeout: 120_000 });
  const enlace = respuesta.getByRole("link", { name: "Ver figura", exact: true }).first();
  const destino = await page.request.get((await enlace.getAttribute("href")) ?? "", { maxRedirects: 0 });
  expect(destino.status()).toBe(303);
  const pasajeFigura = respuesta.locator("li", { has: page.getByRole("link", { name: "Ver figura", exact: true }) }).last();
  await pasajeFigura.getByRole("button", { name: "Ver pasaje", exact: true }).click();
  await expect(pasajeFigura).toContainText("Corrección de la administración: Diagrama circular ficticio");
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/02-bot-figura.png`, fullPage: true });
});

test("archivo grande: carga directa a Storage con URL firmada", async () => {
  requiereAdmin();
  await cargar("grande-demo.txt", "Archivo grande (DEMO)");
  await expect(page.getByText(/subido directamente a la cuarentena/)).toBeVisible({ timeout: 120_000 });
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/03-carga-directa.png`, fullPage: true });
  await procesarTodo();
  const { data } = await supabaseServicio().from("sources").select("estado").eq("titulo", "Archivo grande (DEMO)").single();
  expect(data?.estado).toBe("requiere_revision");
});

test("el antivirus rechaza el archivo de prueba EICAR", async () => {
  requiereAdmin();
  test.skip(!hayClamav, "ClamAV no está instalado en este entorno");
  await cargar("eicar-demo.txt", "Prueba antivirus (DEMO)");
  await expect(page.getByText("quedó en cuarentena")).toBeVisible();
  await procesarTodo();
  await page.goto("/biblioteca");
  await expect(page.getByTestId("fuente-Prueba antivirus (DEMO)")).toContainText(/antivirus detectó contenido malicioso/);
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/04-antivirus.png`, fullPage: true });
});

test("invitación sin correo: la administración comparte un enlace de un solo uso", async ({ browser }) => {
  requiereAdmin();
  const correo = "invitada-enlace@demo.invalid";
  await page.goto("/admin/usuarios");
  await page.getByLabel("Nombre", { exact: true }).fill("Invitada por enlace");
  await page.getByLabel("Correo", { exact: true }).fill(correo);
  await page.getByLabel(/No enviar correo: mostrar el enlace/).check();
  await page.getByRole("button", { name: "Enviar invitación", exact: true }).click();
  const enlace = await page.getByTestId("enlace-generado").first().inputValue();
  expect(enlace).toMatch(/\/auth\/confirmar\?token_hash=.+&type=invite/);
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/05-invitacion-enlace.png`, fullPage: true });

  const otra = await browser.newContext();
  const invitada = await otra.newPage();
  await invitada.goto(enlace);
  await expect(invitada).toHaveURL(/\/cuenta\/contrasena$/);
  await invitada.getByLabel("Contraseña nueva", { exact: true }).fill("Invitada2026x");
  await invitada.getByLabel("Repite la contraseña", { exact: true }).fill("Invitada2026x");
  await invitada.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
  await expect(invitada.getByTestId("mis-roles")).toHaveText("Consultor/a");
  await invitada.goto(enlace);
  await expect(invitada).toHaveURL(/\/entrar\?error=enlace|\/cuenta/);
  await otra.close();

  const { data } = await supabaseServicio().from("audit_log").select("recurso_tipo").eq("recurso_tipo", "enlace_invitacion");
  expect(data?.length).toBeGreaterThan(0);
});
