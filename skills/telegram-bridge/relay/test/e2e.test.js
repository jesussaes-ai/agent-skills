// Prueba de punta a punta: scripts bash reales + relay + Telegram y Cursor simulados en localhost.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";

const run = promisify(execFile);
const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts");
const TOKEN = "123:ABC";
const SECRET = "e2e_secret_abcdefghijkl";
const JESUS = 424242;
const AGENT = "bc-11111111-2222-3333-4444-555555555555";

const hasEdge = (() => {
  try {
    execFileSync("python3", ["-c", "import edge_tts"], { stdio: "ignore" });
    execFileSync("curl", ["-sfI", "--max-time", "5", "https://speech.platform.bing.com"], { stdio: "ignore" });
    return true;
  } catch (e) {
    return e.status === 22;
  }
})();

const hasVoice = (() => {
  try {
    execFileSync("python3", ["-c", "import piper, faster_whisper"], { stdio: "ignore" });
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

class MemoryKV {
  constructor() { this.map = new Map(); }
  async get(k) { return this.map.has(k) ? this.map.get(k) : null; }
  async put(k, v) { this.map.set(k, v); }
  async delete(k) { this.map.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.map.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }; }
}

const tgCalls = [];
const cursorRuns = [];
const files = new Map();
let server, base, env, nextId = 100;

// Telegram entrega message.text sin etiquetas HTML y con entidades decodificadas.
const htmlToText = (s) => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function parseMultipart(buf, contentType) {
  const boundary = contentType.split("boundary=")[1];
  const out = {};
  for (const part of buf.toString("latin1").split(`--${boundary}`)) {
    const name = part.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    const value = part.slice(part.indexOf("\r\n\r\n") + 4, part.lastIndexOf("\r\n"));
    out[name] = name === "voice" ? Buffer.from(value, "latin1") : Buffer.from(value, "latin1").toString("utf8");
  }
  return out;
}

before(async () => {
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const raw = await readBody(req);
    const send = (status, obj) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

    if (url.pathname.startsWith("/relay/")) {
      const r = await worker.fetch(new Request(`https://relay${url.pathname.slice(6)}`, {
        method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : raw,
      }), env);
      res.writeHead(r.status, { "Content-Type": "application/json" });
      return res.end(await r.text());
    }
    if (url.pathname.startsWith("/cursor/v1/agents/")) {
      cursorRuns.push({ path: url.pathname, auth: req.headers.authorization, body: JSON.parse(raw) });
      return send(201, { run: { id: "run-e2e", status: "CREATING" } });
    }
    if (url.pathname.startsWith(`/tg/file/bot${TOKEN}/`)) {
      const f = files.get(url.pathname.split("/").pop());
      if (!f) return send(404, {});
      res.writeHead(200);
      return res.end(f);
    }
    if (url.pathname.startsWith(`/tg/bot${TOKEN}/`)) {
      const method = url.pathname.split("/").pop();
      const ct = req.headers["content-type"] || "";
      let params;
      if (ct.startsWith("multipart/")) params = parseMultipart(raw, ct);
      else if (ct.includes("json")) params = JSON.parse(raw || "{}");
      else params = Object.fromEntries(new URLSearchParams(raw.toString()));
      tgCalls.push({ method, params });
      if (method === "getFile") {
        return send(200, { ok: true, result: { file_id: params.file_id, file_path: `voice/${params.file_id}.oga` } });
      }
      if (method === "sendVoice") files.set(`voz${nextId + 1}.oga`, params.voice);
      return send(200, { ok: true, result: { message_id: ++nextId, chat: { id: Number(params.chat_id) } } });
    }
    send(404, { ok: false });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  env = {
    TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: String(JESUS), TELEGRAM_WEBHOOK_SECRET: SECRET,
    CURSOR_API_KEY: "key_e2e", TELEGRAM_API_BASE: `${base}/tg`, CURSOR_API_BASE: `${base}/cursor`, BRIDGE_KV: new MemoryKV(),
  };
});

after(() => server.close());

const scriptEnv = () => ({
  ...process.env,
  TELEGRAM_API_BASE: `${base}/tg`, TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: String(JESUS),
  TELEGRAM_WEBHOOK_SECRET: SECRET, TELEGRAM_RELAY_URL: `${base}/relay`, CURSOR_CONVERSATION_ID: AGENT,
  TELEGRAM_PROJECT: "Proyecto Demo",
});

const script = (name, args, extra = {}) =>
  run("bash", [path.join(SCRIPTS, name), ...args], { env: { ...scriptEnv(), ...extra }, timeout: 300000 });

function pressButton(data, messageText) {
  return worker.fetch(new Request("https://relay/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": SECRET },
    body: JSON.stringify({ update_id: 1, callback_query: { id: "cq", from: { id: JESUS }, data, message: { message_id: 7, chat: { id: JESUS }, text: messageText } } }),
  }), env);
}

test("notify.sh envía un aviso con proyecto, agente y pie legible por el relay", async () => {
  const { stdout } = await script("notify.sh", ["--status", "done", "--title", "Reporte listo", "--summary", "El PDF <muestra> & portada quedaron listos."]);
  const out = JSON.parse(stdout);
  assert.equal(out.kind, "aviso");
  assert.equal(out.agent, AGENT);
  const msg = tgCalls.findLast((c) => c.method === "sendMessage").params;
  assert.equal(msg.parse_mode, "HTML");
  assert.match(msg.text, /&lt;muestra&gt; &amp; portada/);
  const text = htmlToText(msg.text);
  assert.match(text, /✅ Tarea terminada/);
  assert.match(text, new RegExp(`ref: ${out.ref} · agente: ${AGENT}$`));
  assert.match(text, /proyecto: Proyecto Demo/);
});

test("request-approval.sh + botón Aprobar + wait-decision.sh (agente esperando en su turno)", async () => {
  const { stdout } = await script("request-approval.sh", ["--summary", "¿Publico el reporte de muestra en la carpeta compartida?"]);
  const out = JSON.parse(stdout);
  assert.equal(out.kind, "aprobacion");
  const msg = tgCalls.findLast((c) => c.method === "sendMessage").params;
  const kb = JSON.parse(msg.reply_markup).inline_keyboard.flat().map((b) => b.callback_data);
  assert.deepEqual(kb, [`ap:${out.ref}`, `rj:${out.ref}`, `rp:${out.ref}`]);
  assert.ok(kb.every((d) => Buffer.byteLength(d) <= 64));

  const waiting = script("wait-decision.sh", [out.ref, "--timeout", "20", "--interval", "1"]);
  await new Promise((r) => setTimeout(r, 1500));
  await pressButton(`ap:${out.ref}`, htmlToText(msg.text));
  const decision = JSON.parse((await waiting).stdout);
  assert.equal(decision.status, "decided");
  assert.equal(decision.decision, "approved");
  assert.equal(cursorRuns.at(-1).path, `/cursor/v1/agents/${AGENT}/runs`);
});

test("request-approval.sh marca crítica una acción de producción y exige frase", async () => {
  const { stdout } = await script("request-approval.sh", ["--summary", "Aplicar migración en producción", "--confirm-text", "MIGRAR PROD"]);
  const out = JSON.parse(stdout);
  assert.equal(out.kind, "aprobacion-critica");
  const text = htmlToText(tgCalls.findLast((c) => c.method === "sendMessage").params.text);
  assert.match(text, /frase: MIGRAR PROD/);
  const before = cursorRuns.length;
  await pressButton(`ap:${out.ref}`, text);
  assert.equal(cursorRuns.length, before);
});

test("wait-decision.sh devuelve timeout (código 2) si no hay respuesta", async () => {
  await assert.rejects(script("wait-decision.sh", ["NADA0000", "--timeout", "1", "--interval", "1"]), (e) => e.code === 2);
});

test("sanitize_for_voice oculta secretos, URLs, correos e ids", async () => {
  const { stdout } = await run("bash", ["-c", `source ${SCRIPTS}/common.sh; sanitize_for_voice "$1"`, "_",
    "Token crsr_abcdefghijklmnop y ghp_1234567890abcdef en https://x.y/z?k=1, correo jesus@ejemplo.com, API_KEY=xyz, agente bc-1234-5678, tel 55 1234 5678"]);
  for (const bad of ["crsr_", "ghp_", "https", "jesus@", "xyz", "bc-1234", "1234 5678"]) assert.ok(!stdout.includes(bad), `${bad} en ${stdout}`);
});

test("voz: si edge-tts falla, notify.sh --voice cae a Piper y la transcripción local lo entiende", { skip: !hasVoice && "sin piper/faster-whisper" }, async () => {
  const { stdout, stderr } = await script("notify.sh", ["--status", "done", "--summary", "El reporte de carta natal ya está listo.", "--voice"],
    { TELEGRAM_TTS_ENGINE: "", TELEGRAM_TTS_VOICE: "", TELEGRAM_TTS_EDGE_TIMEOUT: "0.01" });
  assert.match(stderr, /Voz usada: piper es_MX-claude-high \(respaldo\)/);
  const out = JSON.parse(stdout);
  assert.equal(out.voice, true);
  const voice = tgCalls.findLast((c) => c.method === "sendVoice").params;
  assert.equal(voice.voice.subarray(0, 4).toString(), "OggS");
  assert.ok(voice.voice.includes(Buffer.from("OpusHead")));
  assert.match(voice.caption, new RegExp(`ref: ${out.ref} · agente: ${AGENT}`));

  const fileId = [...files.keys()].at(-1).replace(".oga", "");
  const { stdout: tr } = await script("transcribe-voice.sh", ["--file-id", fileId, "--ref", out.ref, "--echo"]);
  const t = JSON.parse(tr);
  assert.match(t.text.toLowerCase(), /reporte/);
  assert.match(t.text.toLowerCase(), /listo/);
  assert.match(tgCalls.findLast((c) => c.method === "sendMessage").params.text, /Entendí tu nota de voz/);
});

test("voz: por defecto usa edge-tts es-MX-JorgeNeural", { skip: !hasEdge && "sin edge-tts o sin red" }, async () => {
  const { stdout, stderr } = await script("notify.sh", ["--summary", "Prueba de voz.", "--voice"], { TELEGRAM_TTS_ENGINE: "", TELEGRAM_TTS_VOICE: "" });
  assert.match(stderr, /Voz usada: edge es-MX-JorgeNeural/);
  assert.equal(JSON.parse(stdout).voice, true);
  assert.equal(tgCalls.findLast((c) => c.method === "sendVoice").params.voice.subarray(0, 4).toString(), "OggS");
});
