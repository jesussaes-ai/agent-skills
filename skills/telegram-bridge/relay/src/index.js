// Relay Telegram -> Cursor Cloud Agents (Cloudflare Worker, plan gratuito).
// Recibe el webhook del bot, valida secret_token y lista blanca de chat_id,
// y reenvía la decisión al agente con POST /v1/agents/{id}/runs.
// Nunca registra textos de mensajes, tokens ni resúmenes: solo eventos y códigos.

const TELEGRAM_API = "https://api.telegram.org";
const CURSOR_API = "https://api.cursor.com";
const DECISION_TTL = 7 * 24 * 3600;
const PENDING_TTL = 24 * 3600;
const DONE_TTL = 30 * 24 * 3600;
const MAX_RETRIES_PER_CRON = 10;
const MAX_REPLY_CHARS = 3500;

const REF_RE = /ref: ([A-Z0-9]{8}) · agente: (bc-[A-Za-z0-9-]{1,80})/g;
const KIND_RE = /^tipo: (aprobacion-critica|aprobacion|aviso)$/m;
const PROJECT_RE = /^proyecto: (.{1,120})$/m;
const PHRASE_RE = /^frase: (.{1,120})$/m;
const PROMPT_RE = /^(confirmar|responder)-ref: ([A-Z0-9]{8})$/m;

export const DESTRUCTIVE_RE =
  /\b(borra\w*|elimin\w*|delete|drop|truncate|destru\w*|rm\s+-rf|reset\s+--hard|force[- ]push|push\s+--force|--force|producci[oó]n|production|prod|migraci[oó]n|migration|deploy\w*|despleg\w*|despliegue|revoca\w*|rota\w*\s+secret\w*)\b/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/healthz") {
        return json({ ok: true });
      }
      if (request.method === "POST" && url.pathname === "/telegram/webhook") {
        return await handleWebhook(request, env);
      }
      const m = url.pathname.match(/^\/v1\/decisions\/([A-Z0-9]{8})$/);
      if (request.method === "GET" && m) {
        return await handleDecisionPoll(request, env, m[1]);
      }
      return json({ error: "not_found" }, 404);
    } catch (err) {
      log("unhandled_error", { path: url.pathname, name: err?.name });
      // A Telegram siempre 200 para evitar reintentos en bucle.
      return url.pathname === "/telegram/webhook" ? json({ ok: true }) : json({ error: "internal" }, 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx?.waitUntil ? ctx.waitUntil(retryPending(env)) : await retryPending(env);
  },
};

// ---------- Webhook ----------

async function handleWebhook(request, env) {
  requireEnv(env);
  const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  if (!timingSafeEqual(got, env.TELEGRAM_WEBHOOK_SECRET)) {
    log("webhook_rejected", { reason: "secret" });
    return json({ error: "unauthorized" }, 401);
  }
  let update;
  try {
    update = await request.json();
  } catch {
    return json({ ok: true });
  }

  if (update.callback_query) {
    await handleCallback(update.callback_query, env);
  } else if (update.message) {
    await handleMessage(update.message, env);
  }
  return json({ ok: true });
}

function isAllowed(env, chatId, fromId) {
  const allowed = String(env.TELEGRAM_CHAT_ID)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(String(chatId)) && allowed.includes(String(fromId));
}

async function handleCallback(cq, env) {
  const chatId = cq.message?.chat?.id;
  if (!isAllowed(env, chatId, cq.from?.id)) {
    log("ignored_chat", { kind: "callback" });
    return;
  }
  const [action, ref] = String(cq.data || "").split(":");
  if (action === "xx") {
    await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Esta solicitud ya fue resuelta." });
    return;
  }
  const meta = parseMeta(cq.message?.text || "");
  if (!meta || meta.ref !== ref || !/^(ap|rj|rp)$/.test(action)) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Solicitud no reconocida." });
    return;
  }
  if (await isDone(env, ref)) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Esta solicitud ya fue resuelta." });
    return;
  }

  const critical = meta.kind === "aprobacion-critica" || DESTRUCTIVE_RE.test(meta.body);

  if (action === "rp") {
    await tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
    await sendPrompt(env, chatId, cq.message.message_id, meta, "responder",
      "✍️ Escribe tu respuesta para el agente (responde a este mensaje).");
    return;
  }

  if (action === "ap" && critical) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Acción crítica: falta tu confirmación escrita." });
    await sendPrompt(env, chatId, cq.message.message_id, meta, "confirmar",
      "⚠️ Acción destructiva o de producción.\nPara aprobarla, responde a este mensaje escribiendo exactamente la frase de abajo. Cualquier otro texto no aprueba nada.");
    return;
  }

  const decision = action === "ap" ? "approved" : "rejected";
  await tg(env, "answerCallbackQuery", {
    callback_query_id: cq.id,
    text: decision === "approved" ? "Aprobado. Enviando al agente…" : "Rechazado. Enviando al agente…",
  });
  await resolve(env, { chatId, originalMessageId: cq.message.message_id, meta, decision, critical });
}

async function handleMessage(msg, env) {
  if (!isAllowed(env, msg.chat?.id, msg.from?.id)) {
    log("ignored_chat", { kind: "message" });
    return;
  }
  const text = typeof msg.text === "string" ? msg.text.trim() : "";
  const voice = msg.voice || msg.audio;
  const replied = msg.reply_to_message;

  if (!replied || !replied.from?.is_bot) {
    if (voice) {
      await tg(env, "sendMessage", {
        chat_id: msg.chat.id,
        reply_to_message_id: msg.message_id,
        text: "🎙️ Para que tu nota de voz llegue a un agente, mándala como respuesta (deslizar → Responder) a su aviso.",
      });
    } else if (text === "/start" || text === "/ayuda") {
      await tg(env, "sendMessage", {
        chat_id: msg.chat.id,
        text: "Puente activo. Responde (deslizar → Responder) a un aviso de un agente para enviarle un mensaje, o usa los botones de las solicitudes.",
      });
    }
    return;
  }

  const repliedText = replied.text || replied.caption || "";
  const prompt = repliedText.match(PROMPT_RE);
  const meta = parseMeta(repliedText);
  if (!meta || (!text && !voice)) return;

  if (prompt && prompt[1] === "confirmar" && (await isDone(env, meta.ref))) {
    await tg(env, "sendMessage", { chat_id: msg.chat.id, text: `La solicitud ${meta.ref} ya fue resuelta.` });
    return;
  }

  if (voice && prompt && prompt[1] === "confirmar") {
    await tg(env, "sendMessage", {
      chat_id: msg.chat.id,
      reply_to_message_id: replied.message_id,
      text: "🎙️ Una nota de voz no puede aprobar una acción crítica. Responde a este mensaje escribiendo la frase exacta.",
    });
    return;
  }

  if (voice) {
    const critical = meta.kind === "aprobacion-critica" || DESTRUCTIVE_RE.test(meta.body);
    await resolve(env, {
      chatId: msg.chat.id,
      originalMessageId: meta.originalMessageId ?? replied.message_id,
      meta,
      decision: "voice",
      critical,
      voice: {
        fileId: String(voice.file_id || "").slice(0, 200),
        duration: Number(voice.duration) || 0,
        messageId: msg.message_id,
      },
      keepOpen: true,
    });
    return;
  }

  if (prompt && prompt[1] === "confirmar") {
    const phrase = meta.phrase || `CONFIRMO ${meta.ref}`;
    if (normalize(text) !== normalize(phrase)) {
      await tg(env, "sendMessage", {
        chat_id: msg.chat.id,
        reply_to_message_id: replied.message_id,
        text: `❌ La frase no coincide; no se aprobó nada. Vuelve a responder a la solicitud de confirmación con:\n${phrase}`,
      });
      return;
    }
    await resolve(env, {
      chatId: msg.chat.id,
      originalMessageId: meta.originalMessageId,
      meta,
      decision: "approved",
      critical: true,
      confirmedPhrase: phrase,
    });
    return;
  }

  const critical = meta.kind === "aprobacion-critica" || DESTRUCTIVE_RE.test(meta.body);
  await resolve(env, {
    chatId: msg.chat.id,
    originalMessageId: meta.originalMessageId ?? replied.message_id,
    meta,
    decision: "reply",
    critical,
    replyText: text.slice(0, MAX_REPLY_CHARS),
    keepOpen: true,
  });
}

// ---------- Mensajes ----------

function parseMeta(text) {
  const matches = [...String(text).matchAll(REF_RE)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const head = String(text).slice(0, last.index);
  // Ante metadatos repetidos gana el pie (última aparición); "crítica" en cualquier línea siempre gana.
  const kinds = [...head.matchAll(new RegExp(KIND_RE.source, "gm"))].map((m) => m[1]);
  const kind = kinds.includes("aprobacion-critica") ? "aprobacion-critica" : kinds.at(-1) || "aviso";
  const project = lastMatch(head, PROJECT_RE)?.trim() || "(sin proyecto)";
  const phrase = lastMatch(head, PHRASE_RE)?.trim();
  const orig = lastMatch(head, /^mensaje-original: (\d{1,15})$/m);
  const quoted = head.match(/\nPedido original:\n([\s\S]*)\n—\n/);
  const body = cleanBody(quoted ? quoted[1] : head);
  return {
    ref: last[1],
    agentId: last[2],
    kind,
    project,
    phrase,
    body,
    originalMessageId: orig ? Number(orig) : undefined,
  };
}

function cleanBody(text) {
  const lines = String(text).split("\n");
  while (lines.length && /^(proyecto|tipo|frase|mensaje-original|confirmar-ref|responder-ref): |^🔗 |^\s*$/.test(lines.at(-1))) {
    lines.pop();
  }
  return lines.join("\n").slice(0, MAX_REPLY_CHARS);
}

function lastMatch(text, re) {
  const all = [...String(text).matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))];
  return all.length ? all[all.length - 1][1] : undefined;
}

async function sendPrompt(env, chatId, originalMessageId, meta, type, intro) {
  const lines = [intro, "", "Pedido original:", meta.body.trim(), "—"];
  if (type === "confirmar") lines.push(`frase: ${meta.phrase || `CONFIRMO ${meta.ref}`}`);
  lines.push(
    `tipo: ${meta.kind}`,
    `proyecto: ${meta.project}`,
    `${type}-ref: ${meta.ref}`,
    `mensaje-original: ${originalMessageId}`,
    `ref: ${meta.ref} · agente: ${meta.agentId}`,
  );
  await tg(env, "sendMessage", {
    chat_id: chatId,
    reply_to_message_id: originalMessageId,
    text: lines.join("\n"),
    reply_markup: { force_reply: true, input_field_placeholder: type === "confirmar" ? "Frase exacta" : "Tu respuesta" },
  });
}

function buildFollowUp({ meta, decision, critical, confirmedPhrase, replyText, voice }) {
  const head = `[Telegram · Jesús] Respuesta a la solicitud ref ${meta.ref} (proyecto: ${meta.project}).`;
  const original = `Solicitud original enviada por este agente:\n"""\n${meta.body.trim()}\n"""`;
  if (decision === "approved") {
    const how = critical
      ? `APROBADO con confirmación explícita: Jesús escribió la frase "${confirmedPhrase}".`
      : "APROBADO.";
    return `${head}\n${how}\nProcede solo con lo descrito en la solicitud original.\n\n${original}`;
  }
  if (decision === "rejected") {
    return `${head}\nRECHAZADO. No ejecutes la acción solicitada; continúa sin ella o propone una alternativa.\n\n${original}`;
  }
  const warn = critical || meta.kind !== "aviso"
    ? "\nAVISO: esto es un mensaje libre, NO una aprobación formal. Si pide aprobar, confirma con request-approval.sh antes de actuar."
    : "";
  if (decision === "voice") {
    return `${head}\nJesús respondió con una NOTA DE VOZ (${voice.duration} s). Transcríbela localmente con la skill telegram-bridge y muéstrale la transcripción:\n` +
      `bash <carpeta-de-la-skill>/scripts/transcribe-voice.sh --file-id "${voice.fileId}" --ref ${meta.ref} --reply-to ${voice.messageId} --echo` +
      `${warn}\n\n${original}`;
  }
  return `${head}\nMensaje de Jesús:\n"""\n${replyText}\n"""${warn}\n\n${original}`;
}

const LABELS = { approved: "✅ Aprobado", rejected: "🚫 Rechazado", reply: "💬 Respuesta", voice: "🎙️ Nota de voz" };

async function resolve(env, opts) {
  const { chatId, originalMessageId, meta, decision, keepOpen } = opts;
  const prompt = buildFollowUp(opts);
  const record = {
    ref: meta.ref,
    agentId: meta.agentId,
    decision,
    critical: !!opts.critical,
    text: decision === "reply" ? opts.replyText : null,
    voice: decision === "voice" ? opts.voice : null,
    prompt,
    decidedAt: new Date().toISOString(),
    consumed: false,
  };
  if (!keepOpen) await markDone(env, meta.ref);
  await kvPut(env, `dec:${meta.ref}`, record, DECISION_TTL);

  if (!keepOpen && originalMessageId) {
    await tg(env, "editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: originalMessageId,
      reply_markup: { inline_keyboard: [[{ text: LABELS[decision], callback_data: `xx:${meta.ref}` }]] },
    });
  }

  const result = await deliver(env, meta.agentId, prompt);
  log("delivery", { ref: meta.ref, decision, status: result.status });

  let note;
  if (result.ok) {
    note = `${LABELS[decision]} · entregado al agente ${short(meta.agentId)}.`;
  } else if (result.retry) {
    const stored = await kvPut(env, `pend:${meta.ref}`, { ref: meta.ref, agentId: meta.agentId, chatId, attempts: 1 }, PENDING_TTL);
    note = result.status === 409
      ? `${LABELS[decision]} · el agente ${short(meta.agentId)} está ocupado. ${stored ? "Queda guardado: lo leerá si está esperando, o se reintenta cada 5 min (24 h)." : "Sin KV no puedo reintentar; vuelve a responder cuando termine."}`
      : `${LABELS[decision]} · la API de Cursor no respondió (${result.status}). ${stored ? "Se reintenta cada 5 min." : "Vuelve a intentarlo más tarde."}`;
  } else {
    note = `⚠️ No se pudo entregar al agente ${short(meta.agentId)} (HTTP ${result.status}${result.code ? `, ${result.code}` : ""}). Revisa CURSOR_API_KEY o si el agente sigue activo.`;
  }
  await tg(env, "sendMessage", { chat_id: chatId, reply_to_message_id: originalMessageId, text: note });
}

// ---------- Cursor API ----------

export async function deliver(env, agentId, text) {
  const base = env.CURSOR_API_BASE || CURSOR_API;
  let res;
  try {
    res = await fetch(`${base}/v1/agents/${encodeURIComponent(agentId)}/runs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CURSOR_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: { text } }),
    });
  } catch {
    return { ok: false, retry: true, status: 0 };
  }
  let code;
  try {
    const body = await res.json();
    code = body?.code || body?.error?.code || (typeof body?.error === "string" ? body.error : undefined);
  } catch {}
  if (res.ok) return { ok: true, status: res.status };
  const retry = res.status === 409 || res.status === 429 || res.status >= 500;
  return { ok: false, retry, status: res.status, code: typeof code === "string" ? code.slice(0, 40) : undefined };
}

async function retryPending(env) {
  if (!env.BRIDGE_KV) return;
  const list = await env.BRIDGE_KV.list({ prefix: "pend:", limit: MAX_RETRIES_PER_CRON });
  for (const { name } of list.keys) {
    const pend = await kvGet(env, name);
    const ref = name.slice(5);
    const dec = await kvGet(env, `dec:${ref}`);
    if (!pend || !dec || dec.consumed) {
      await env.BRIDGE_KV.delete(name);
      continue;
    }
    const result = await deliver(env, dec.agentId, dec.prompt);
    log("retry", { ref, status: result.status });
    if (result.ok || !result.retry) {
      await env.BRIDGE_KV.delete(name);
      await tg(env, "sendMessage", {
        chat_id: pend.chatId,
        text: result.ok
          ? `📬 Respuesta ref ${ref} entregada al agente ${short(dec.agentId)}.`
          : `⚠️ No se pudo entregar la respuesta ref ${ref} (HTTP ${result.status}).`,
      });
    }
  }
}

// ---------- Consulta de decisiones (agentes que esperan dentro de su turno) ----------

async function handleDecisionPoll(request, env, ref) {
  requireEnv(env);
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!timingSafeEqual(token, env.TELEGRAM_WEBHOOK_SECRET)) return json({ error: "unauthorized" }, 401);
  if (!env.BRIDGE_KV) return json({ error: "kv_not_configured" }, 501);
  const dec = await kvGet(env, `dec:${ref}`);
  if (!dec) return json({ status: "pending", ref });
  if (!dec.consumed) {
    dec.consumed = true;
    await kvPut(env, `dec:${ref}`, dec, DECISION_TTL);
    await env.BRIDGE_KV.delete(`pend:${ref}`);
  }
  return json({
    status: "decided",
    ref,
    decision: dec.decision,
    critical: dec.critical,
    text: dec.text,
    voice: dec.voice,
    decidedAt: dec.decidedAt,
    prompt: dec.prompt,
  });
}

// ---------- Utilidades ----------

async function tg(env, method, payload) {
  const base = env.TELEGRAM_API_BASE || TELEGRAM_API;
  try {
    const res = await fetch(`${base}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) log("telegram_error", { method, status: res.status });
    return res.ok;
  } catch {
    log("telegram_error", { method, status: 0 });
    return false;
  }
}

async function isDone(env, ref) {
  return env.BRIDGE_KV ? (await env.BRIDGE_KV.get(`done:${ref}`)) !== null : false;
}

async function markDone(env, ref) {
  if (env.BRIDGE_KV) await env.BRIDGE_KV.put(`done:${ref}`, "1", { expirationTtl: DONE_TTL });
}

async function kvPut(env, key, value, ttl) {
  if (!env.BRIDGE_KV) return false;
  await env.BRIDGE_KV.put(key, JSON.stringify(value), { expirationTtl: ttl });
  return true;
}

async function kvGet(env, key) {
  if (!env.BRIDGE_KV) return null;
  const raw = await env.BRIDGE_KV.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function requireEnv(env) {
  for (const k of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET", "CURSOR_API_KEY"]) {
    if (!env[k]) throw new Error(`missing_${k}`);
  }
}

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0 && x.length > 0;
}

function normalize(s) {
  return String(s).trim().replace(/\s+/g, " ").toUpperCase();
}

function short(agentId) {
  return agentId.length > 14 ? `${agentId.slice(0, 11)}…` : agentId;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function log(event, fields) {
  console.log(JSON.stringify({ event, ...fields }));
}
