import { createHash, randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, entrar, estado, supabaseServicio, verificarCodigo } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};

/** WCAG 2.0, 2.1 y 2.2, niveles A y AA. */
const ETIQUETAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function revisar(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.waitForLoadState("load");
  await expect(page.locator("main#contenido")).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();
  const resumen = violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(resumen, `Problemas de accesibilidad en ${ruta}`).toEqual([]);
}

let enlaceValido = "";
let expedienteId = "";

test.beforeAll(async () => {
  const servicio = supabaseServicio();
  const { data: documento } = await servicio.from("documents").select("id, case_file_id").limit(1).maybeSingle();
  const { data: expediente } = await servicio.from("case_files").select("id").limit(1).maybeSingle();
  expedienteId = documento?.case_file_id ?? expediente?.id ?? "";
  if (!documento) return;
  const { data: creador } = await servicio.from("case_files").select("created_by").eq("id", documento.case_file_id).single();
  const token = randomBytes(32).toString("base64url");
  await servicio.from("share_links").insert({
    case_file_id: documento.case_file_id,
    document_id: documento.id,
    alcance: "documento",
    token_hash: createHash("sha256").update(token).digest("hex"),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    created_by: creador?.created_by,
  });
  enlaceValido = `/compartido/${token}`;
});

for (const ruta of ["/", "/ayuda", "/entrar", "/recuperar", "/sin-permiso", "/compartido/enlace-inexistente", "/pagina-que-no-existe"]) {
  test(`pantalla pública sin barreras: ${ruta}`, async ({ page }) => {
    await revisar(page, ruta);
  });
}

test("página de un enlace compartido vigente", async ({ page }) => {
  test.skip(!enlaceValido, "Requiere un PDF generado en las pruebas anteriores");
  await revisar(page, enlaceValido);
});

test("pantallas con sesión de administración", async ({ page }) => {
  test.skip(!estado.secretoAdmin, "Requiere la administración creada en 01-cuentas.spec.ts");
  await entrar(page, ADMIN.usuario, ADMIN.contrasena);
  await verificarCodigo(page, estado.secretoAdmin);
  const rutas = ["/expedientes", "/cuenta", "/cuenta/contrasena", "/admin/usuarios", "/admin/ajustes", "/admin/proveedores", "/biblioteca", "/biblioteca/preguntar"];
  if (expedienteId) rutas.push(`/expedientes/${expedienteId}`);
  for (const ruta of rutas) await revisar(page, ruta);
  if (expedienteId) await captura(page, "06-expediente-accesible");
});

test("la navegación con teclado muestra el foco y el salto al contenido", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const enfocado = page.locator(":focus");
  await expect(enfocado).toHaveText("Saltar al contenido");
  await expect(enfocado).toBeInViewport();
  const contorno = await enfocado.evaluate((el) => {
    const estilo = getComputedStyle(el);
    return `${estilo.outlineStyle} ${estilo.outlineWidth} ${estilo.boxShadow}`;
  });
  expect(contorno).not.toBe("none 0px none");
  await page.keyboard.press("Enter");
  await expect(page.locator("main#contenido")).toBeFocused();
});
