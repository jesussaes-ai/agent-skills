import type { CodigoResultado, ConfigProveedor, RespuestaLlm, SolicitudLlm } from "./tipos";

/** Error de proveedor sin contenido de la solicitud: solo código, estado HTTP y espera sugerida. */
export class ErrorProveedor extends Error {
  constructor(
    readonly codigo: Exclude<CodigoResultado, "ok">,
    readonly estadoHttp?: number,
    /** Milisegundos que el proveedor pide esperar (Retry-After / X-RateLimit-Reset). */
    readonly esperaMs?: number,
  ) {
    super(`Proveedor: ${codigo}${estadoHttp ? ` (HTTP ${estadoHttp})` : ""}`);
    this.name = "ErrorProveedor";
  }

  /** Vale la pena repetir con el mismo modelo. */
  get reintentable(): boolean {
    return this.codigo === "limite_429" || this.codigo === "servidor" || this.codigo === "tiempo" || this.codigo === "red";
  }
}

export function codigoDeEstado(estado: number): Exclude<CodigoResultado, "ok"> {
  if (estado === 429) return "limite_429";
  if (estado === 401 || estado === 403) return "autorizacion";
  if (estado === 402) return "credito";
  if (estado === 408) return "tiempo";
  if (estado >= 500) return "servidor";
  return "solicitud";
}

/** Retry-After en segundos o fecha HTTP; X-RateLimit-Reset (OpenRouter) en milisegundos epoch. */
export function esperaSugeridaMs(cabeceras: Headers, ahora: number = Date.now()): number | undefined {
  const retry = cabeceras.get("retry-after");
  if (retry) {
    const segundos = Number(retry);
    if (Number.isFinite(segundos)) return Math.max(0, segundos * 1000);
    const fecha = Date.parse(retry);
    if (Number.isFinite(fecha)) return Math.max(0, fecha - ahora);
  }
  const reinicio = Number(cabeceras.get("x-ratelimit-reset"));
  if (Number.isFinite(reinicio) && reinicio > 0) {
    const ms = reinicio > 1e12 ? reinicio - ahora : reinicio * 1000 - ahora;
    return Math.max(0, ms);
  }
  return undefined;
}

export interface OpcionesLlamada {
  llave?: string;
  fetch?: typeof fetch;
  ahora?: () => number;
  /** Origen público para la cabecera HTTP-Referer de OpenRouter. */
  origenSitio?: string;
}

export function construirCuerpo(config: ConfigProveedor, modelo: string, solicitud: SolicitudLlm): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = {
    model: modelo,
    messages: solicitud.mensajes.map((m) => ({ role: m.rol, content: m.contenido })),
    max_tokens: Math.min(solicitud.maxTokens ?? config.limites.maxTokensSalida, config.limites.maxTokensSalida),
    stream: false,
  };
  if (solicitud.temperatura !== undefined) cuerpo.temperature = solicitud.temperatura;
  if (solicitud.respuestaJson && config.capacidades.json) cuerpo.response_format = { type: "json_object" };
  if (config.tipo === "openrouter" && config.politicaDatos.exigirZdr) {
    cuerpo.provider = { zdr: true, data_collection: "deny" };
  }
  return cuerpo;
}

/** Quita bloques ```json … ``` que algunos modelos añaden aunque se pida JSON. */
export function limpiarTexto(texto: string): string {
  const t = texto.trim();
  const bloque = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return bloque ? bloque[1].trim() : t;
}

/** Una llamada a /chat/completions. Lanza ErrorProveedor; nunca incluye el prompt en el error. */
export async function llamarChat(
  config: ConfigProveedor,
  modelo: string,
  solicitud: SolicitudLlm,
  opciones: OpcionesLlamada = {},
): Promise<RespuestaLlm> {
  const hacerFetch = opciones.fetch ?? fetch;
  const ahora = opciones.ahora ?? Date.now;
  const cabeceras: Record<string, string> = { "Content-Type": "application/json" };
  if (opciones.llave) cabeceras.Authorization = `Bearer ${opciones.llave}`;
  if (config.tipo === "openrouter") {
    if (opciones.origenSitio) cabeceras["HTTP-Referer"] = opciones.origenSitio;
    cabeceras["X-Title"] = "Circulo Nueve";
  }

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), config.limites.tiempoMaximoMs);
  let respuesta: Response;
  try {
    respuesta = await hacerFetch(`${config.endpoint}/chat/completions`, {
      method: "POST",
      headers: cabeceras,
      body: JSON.stringify(construirCuerpo(config, modelo, solicitud)),
      signal: control.signal,
      cache: "no-store",
    });
  } catch (e) {
    throw new ErrorProveedor(control.signal.aborted || (e as Error)?.name === "AbortError" ? "tiempo" : "red");
  } finally {
    clearTimeout(temporizador);
  }

  if (!respuesta.ok) {
    throw new ErrorProveedor(codigoDeEstado(respuesta.status), respuesta.status, esperaSugeridaMs(respuesta.headers, ahora()));
  }

  let json: {
    model?: unknown;
    choices?: { message?: { content?: unknown } }[];
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown };
    error?: { code?: unknown };
  };
  try {
    json = await respuesta.json();
  } catch {
    throw new ErrorProveedor("respuesta_invalida", respuesta.status);
  }
  // OpenRouter puede devolver 200 con un objeto error (p. ej. límite del proveedor de origen).
  if (json.error) {
    const estado = Number(json.error.code);
    throw new ErrorProveedor(Number.isFinite(estado) ? codigoDeEstado(estado) : "servidor", Number.isFinite(estado) ? estado : undefined);
  }
  const contenido = json.choices?.[0]?.message?.content;
  if (typeof contenido !== "string" || !contenido.trim()) throw new ErrorProveedor("respuesta_invalida", respuesta.status);

  const entero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined);
  return {
    texto: limpiarTexto(contenido),
    modelo: typeof json.model === "string" && json.model ? json.model : modelo,
    proveedor: config.nombre,
    tokensEntrada: entero(json.usage?.prompt_tokens),
    tokensSalida: entero(json.usage?.completion_tokens),
    costoUsd: typeof json.usage?.cost === "number" && json.usage.cost >= 0 ? json.usage.cost : undefined,
  };
}
