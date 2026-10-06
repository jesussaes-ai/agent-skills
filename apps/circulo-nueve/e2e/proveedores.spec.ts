import { createServer, type IncomingMessage, type Server } from "node:http";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { ADMIN, entrar, estado, supabaseServicio, verificarCodigo } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const captura = async (page: Page, nombre: string) => {
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/${nombre}.png`, fullPage: true });
};
const capturaDe = async (zona: Locator, nombre: string) => {
  if (MEDIA) await zona.screenshot({ path: `${MEDIA}/${nombre}.png` });
};

const PUERTO = 4011;
const LLAVE = process.env.LLM_KEY_E2E ?? "";

/** Servidor compatible con OpenAI: la 2.ª solicitud responde 429 para probar el reintento. */
const simulado = { solicitudes: 0, autorizaciones: [] as string[], cuerpos: [] as string[] };
let servidor: Server;

async function leer(req: IncomingMessage): Promise<string> {
  let cuerpo = "";
  for await (const parte of req) cuerpo += parte;
  return cuerpo;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    const cuerpo = await leer(req);
    simulado.solicitudes++;
    simulado.autorizaciones.push(req.headers.authorization ?? "");
    simulado.cuerpos.push(cuerpo);
    if (simulado.solicitudes === 2) {
      res.writeHead(429, { "content-type": "application/json", "retry-after": "0" });
      return res.end(JSON.stringify({ error: { message: "Rate limit exceeded", code: 429 } }));
    }
    const mensajes = (JSON.parse(cuerpo) as { messages: { content: string }[] }).messages;
    const id = /\[([^\]]+)\]/.exec(mensajes[1]?.content ?? "")?.[1];
    const contenido = id
      ? JSON.stringify({ afirmaciones: [{ texto: "Según el Centro de ayuda, la ñ se cuenta igual que la n.", fragmentos: [id] }] })
      : "listo";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ model: "modelo-e2e", choices: [{ message: { content: contenido } }], usage: { prompt_tokens: 50, completion_tokens: 20 } }));
  });
  await new Promise<void>((r) => servidor.listen(PUERTO, "127.0.0.1", r));
});

test.afterAll(async () => {
  await new Promise((r) => servidor.close(r));
});

const VOCES_FALSAS = `
  window.__habladas = [];
  const voces = [
    { voiceURI: "Google español", name: "Google español", lang: "es-ES", localService: false, default: false },
    { voiceURI: "Microsoft Jorge", name: "Microsoft Jorge - Spanish (Mexico)", lang: "es-MX", localService: true, default: false },
    { voiceURI: "Samantha", name: "Samantha", lang: "en-US", localService: true, default: true },
  ];
  const lista = window.__sinEspanol ? voces.slice(2) : voces;
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    getVoices: () => lista,
    speak(u) { window.__habladas.push({ texto: u.text, voz: u.voice && u.voice.name }); setTimeout(() => u.onend && u.onend(), 30); },
    cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
  }});
  window.SpeechSynthesisUtterance = function (t) { this.text = t; this.onend = null; this.onerror = null; };
  window.SpeechRecognition = window.webkitSpeechRecognition = function () {
    this.start = () => setTimeout(() => {
      this.onresult && this.onresult({ results: [Object.assign([{ transcript: "¿Cómo se cuenta la ñ?" }], { isFinal: true })] });
      this.onend && this.onend();
    }, 50);
    this.stop = () => this.onend && this.onend();
    this.abort = () => {};
  };
`;

test("la administración da de alta un proveedor local y prueba la conexión", async ({ page }) => {
  test.skip(!estado.secretoAdmin || !LLAVE, "Requiere la administración de cuentas.spec.ts y LLM_KEY_E2E");
  await entrar(page, ADMIN.correo, ADMIN.contrasena);
  await verificarCodigo(page, estado.secretoAdmin);
  await page.goto("/admin/proveedores");
  await expect(page.getByText("Aún no hay proveedores.")).toBeVisible();

  await page.getByLabel("Tipo de proveedor", { exact: true }).selectOption("openai_compatible");
  await page.getByLabel("Identificador", { exact: true }).fill("local-e2e");
  await page.getByLabel("Nombre visible", { exact: true }).fill("Servidor e2e");
  await page.getByLabel("Endpoint (URL base /v1)", { exact: true }).fill(`http://127.0.0.1:${PUERTO}/v1`);
  await page.getByLabel("Id del modelo (selección manual)", { exact: true }).fill("modelo-e2e");
  await page.getByLabel("Nombre del secreto con la llave", { exact: true }).fill("SUPABASE_SERVICE_ROLE_KEY");
  await page.getByLabel("Resumen de la política", { exact: true }).fill("Servidor de prueba local; no guarda nada.");
  await page.getByLabel("Respuesta en JSON").check();
  await page.getByRole("button", { name: "Crear proveedor", exact: true }).click();
  await expect(page.getByText("El nombre debe empezar con LLM_KEY_")).toBeVisible();

  await page.getByLabel("Nombre del secreto con la llave", { exact: true }).fill("LLM_KEY_E2E");
  await page.getByRole("button", { name: "Crear proveedor", exact: true }).click();
  await expect(page.getByText("Proveedor «Servidor e2e» guardado.")).toBeVisible();
  const tarjeta = page.locator("article", { hasText: "Servidor e2e" });
  await expect(tarjeta.getByText("LLM_KEY_E2E: cargada")).toBeVisible();
  await expect(tarjeta.getByText("Solo demo", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(LLAVE);

  await tarjeta.getByRole("button", { name: "Probar conexión", exact: true }).click();
  await expect(tarjeta.getByText(/Conexión correcta en \d+ ms\. Respondió modelo-e2e\./)).toBeVisible();
  expect(simulado.autorizaciones[0]).toBe(`Bearer ${LLAVE}`);
  await captura(page, "admin-proveedores");
});

test("el asistente pide consentimiento, reintenta el 429 y responde con citas y voz", async ({ page }) => {
  test.skip(!estado.secretoAdmin || !LLAVE, "Requiere el proveedor de la prueba anterior");
  await page.addInitScript(VOCES_FALSAS);
  await page.goto("/ayuda");
  const asistente = page.locator("section", { hasText: "Pregunta sobre la app" });
  await asistente.getByLabel("Cómo responder", { exact: true }).selectOption("local-e2e");
  await expect(asistente.getByText(/Los recibe: El servidor que indiques/)).toBeVisible();
  await expect(asistente.getByRole("button", { name: "Preguntar", exact: true })).toBeDisabled();
  await capturaDe(asistente, "asistente-consentimiento");

  await asistente.getByLabel("Acepto enviar mi pregunta a Servidor e2e en esta sesión.").check();
  await asistente.getByLabel("Tu pregunta", { exact: true }).fill("¿Cómo se cuenta la ñ?");
  await asistente.getByRole("button", { name: "Preguntar", exact: true }).click();
  await expect(asistente.getByText("Según el Centro de ayuda, la ñ se cuenta igual que la n.")).toBeVisible();
  await expect(asistente.getByText(/Respuesta redactada por Servidor e2e \(modelo-e2e\)/)).toBeVisible();
  expect(simulado.solicitudes).toBe(3);
  expect(simulado.cuerpos[2]).toContain("<ayuda>");

  const voz = asistente.getByLabel("Voz", { exact: true });
  await expect(voz.locator("option").first()).toHaveText(/Microsoft Jorge .* es-MX · en el dispositivo · posible voz masculina/);
  await asistente.getByRole("button", { name: "Leer respuesta", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __habladas: { voz: string }[] }).__habladas.length)).toBeGreaterThan(0);
  await capturaDe(asistente, "asistente-respuesta-voz");

  await voz.selectOption("Google español");
  await expect(asistente.getByText("Voz remota.", { exact: false })).toBeVisible();
  await expect(asistente.getByRole("button", { name: "Leer respuesta", exact: true })).toBeDisabled();
  await asistente.getByRole("button", { name: "Probar voz", exact: true }).click();
  await asistente.getByLabel("Acepto que el texto de la respuesta se envíe a ese servicio de voz.").check();
  await expect(asistente.getByRole("button", { name: "Leer respuesta", exact: true })).toBeEnabled();
  await capturaDe(asistente, "voz-remota");

  const antes = simulado.solicitudes;
  await asistente.getByLabel("Tu pregunta", { exact: true }).fill("Nací el 12/03/1990, ¿qué número tengo?");
  await asistente.getByRole("button", { name: "Preguntar", exact: true }).click();
  await expect(asistente.getByText(/parece incluir una fecha.*solo para demo/)).toBeVisible();
  expect(simulado.solicitudes).toBe(antes);
});

test("dictado con aviso previo y aviso cuando no hay voces en español", async ({ page }) => {
  await page.addInitScript("window.__sinEspanol = true;");
  await page.addInitScript(VOCES_FALSAS);
  await page.goto("/ayuda");
  const asistente = page.locator("section", { hasText: "Pregunta sobre la app" });
  await asistente.getByLabel("Cómo responder", { exact: true }).selectOption("demo");
  await asistente.getByRole("button", { name: "Dictar pregunta", exact: true }).click();
  await expect(asistente.getByRole("dialog", { name: "Permiso para dictar" })).toContainText("micrófono");
  await capturaDe(asistente, "dictado-aviso");
  await asistente.getByRole("button", { name: "Permitir micrófono y dictar", exact: true }).click();
  await expect(asistente.getByLabel("Tu pregunta", { exact: true })).toHaveValue("¿Cómo se cuenta la ñ?");
  await asistente.getByRole("button", { name: "Preguntar", exact: true }).click();
  await expect(asistente.getByText("Modo demo: búsqueda en el centro de ayuda")).toBeVisible();
  await expect(asistente.getByText("Ninguna voz instalada coincide con es-MX o es-ES.")).toBeVisible();
  await capturaDe(asistente, "sin-voces");
});

test("el consumo queda registrado sin la pregunta", async ({ page }) => {
  test.skip(!estado.secretoAdmin || !LLAVE, "Requiere las pruebas anteriores");
  const { data } = await supabaseServicio().from("ai_usage").select("*").eq("provider_id", "local-e2e").order("id");
  expect(data?.map((f) => [f.codigo_resultado, f.origen])).toEqual([
    ["ok", "prueba-admin"],
    ["limite_429", "asistente-ayuda"],
    ["ok", "asistente-ayuda"],
  ]);
  expect(JSON.stringify(data)).not.toMatch(/cuenta la ñ|1990/);

  await entrar(page, ADMIN.correo, ADMIN.contrasena);
  await verificarCodigo(page, estado.secretoAdmin);
  await page.goto("/admin/proveedores");
  const consumo = page.locator("section", { hasText: "Consumo del mes" });
  await expect(consumo.getByRole("cell", { name: "limite_429" })).toBeVisible();
  await captura(page, "admin-consumo");
});
