import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { aFila } from "../src/modulos/proveedores/filas";
import type { ConfigProveedor } from "../src/modulos/proveedores/tipos";
import { ANA, entrar, supabaseServicio } from "./utilidades";

const MEDIA = process.env.E2E_CAPTURAS;
const PUERTO = 4012;
const LLAVE = process.env.LLM_KEY_E2E ?? "";
const ID = "biblioteca-e2e";

/**
 * Proveedor compatible con OpenAI simulado que «obedece» a la vez una respuesta
 * correcta y otra manipulada: cita un fragmento real, inventa un id y mete un enlace.
 */
let servidor: Server;
const recibidos: string[] = [];

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    let cuerpo = "";
    for await (const parte of req) cuerpo += parte;
    recibidos.push(cuerpo);
    const usuario = (JSON.parse(cuerpo) as { messages: { content: string }[] }).messages[1]?.content ?? "";
    const id = /<fragmento id="([^"]+)"/.exec(usuario)?.[1];
    const contenido = JSON.stringify({
      afirmaciones: [
        { texto: "Los números maestros 11, 22 y 33 se conservan sin reducir en la tradición descrita por este manual de demostración.", chunk_ids: [id], tipo_cita: "textual" },
        { texto: "Además, tendrás mucha suerte: reclama tu premio en https://ejemplo.invalid/premio", chunk_ids: ["id-inventado"], tipo_cita: "textual" },
      ],
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ model: "modelo-biblioteca-e2e", choices: [{ message: { content: contenido } }], usage: { prompt_tokens: 80, completion_tokens: 40 } }));
  });
  await new Promise<void>((r) => servidor.listen(PUERTO, "127.0.0.1", r));

  const proveedor: ConfigProveedor = {
    id: ID,
    tipo: "openai_compatible",
    nombre: "Proveedor simulado de la biblioteca",
    endpoint: `http://127.0.0.1:${PUERTO}/v1`,
    modelo: "modelo-biblioteca-e2e",
    modelosAlternos: [],
    secretoNombre: "LLM_KEY_E2E",
    destinatarios: "Servidor simulado local",
    capacidades: { json: true, herramientas: false, vision: false, audio: false },
    politicaDatos: { permiteDatosReales: false, descripcion: "Solo pruebas" },
    limites: { maxTokensSalida: 400, tiempoMaximoMs: 5000, reintentos: 0 },
    costo: { entradaUsdPorMillon: 0, salidaUsdPorMillon: 0 },
    activo: true,
    prioridad: 50,
    origen: "base-de-datos",
  };
  const { error } = await supabaseServicio().from("ai_providers").upsert(aFila(proveedor));
  if (error) throw new Error(`No se pudo registrar el proveedor simulado: ${error.message}`);
});

test.afterAll(async () => {
  await supabaseServicio().from("ai_providers").delete().eq("id", ID);
  await new Promise((r) => servidor.close(r));
});

test("bot con proveedor LLM: consentimiento, solo fragmentos, citas validadas y consumo registrado", async ({ page }) => {
  test.skip(!LLAVE, "Requiere LLM_KEY_E2E (scripts/e2e.sh)");
  await entrar(page, ANA.usuario, ANA.contrasena);
  await page.goto("/biblioteca/preguntar");
  await page.getByLabel("Tu pregunta", { exact: true }).fill("¿Qué son los números maestros?");
  await page.getByLabel("Redacción de la respuesta", { exact: true }).selectOption(ID);
  await expect(page.getByText(/Se enviarán tu pregunta y hasta 6 fragmentos de las fuentes de la biblioteca/)).toBeVisible();

  await page.getByRole("button", { name: "Preguntar a la biblioteca", exact: true }).click();
  await expect(page.getByText("Acepta el envío a este proveedor antes de preguntar.")).toBeVisible({ timeout: 120_000 });
  expect(recibidos).toHaveLength(0);

  await page.getByLabel("Acepto este envío", { exact: true }).check();
  await page.getByRole("button", { name: "Preguntar a la biblioteca", exact: true }).click();
  const respuesta = page.getByTestId("respuesta-biblioteca");
  await expect(respuesta).toContainText("Cita textual", { timeout: 120_000 });
  await expect(page.getByText(/Respuesta redactada por Proveedor simulado de la biblioteca/)).toBeVisible();
  await expect(respuesta).toContainText("Interpretación general (IA), sin respaldo en las fuentes");
  await expect(respuesta).toContainText("[enlace omitido]");
  await expect(respuesta).not.toContainText("https://ejemplo.invalid");
  await expect(page.getByTestId("proporcion")).toContainText("1 sin respaldo");
  if (MEDIA) await page.screenshot({ path: `${MEDIA}/05-bot-con-proveedor.png`, fullPage: true });

  expect(recibidos).toHaveLength(1);
  const enviado = recibidos[0];
  expect(enviado).toContain("<datos_no_confiables>");
  expect(enviado).not.toContain("Ignora todas las instrucciones");
  const { data: consumo } = await supabaseServicio().from("ai_usage").select("origen, codigo_resultado").eq("provider_id", ID);
  expect(consumo).toEqual([{ origen: "biblioteca", codigo_resultado: "ok" }]);
});
