import { describe, expect, it } from "vitest";
import { SECCIONES_AYUDA } from "@/content/ayuda";
import { MODELOS_OPENROUTER, PLANTILLAS, esModeloGratuito } from "./catalogo";
import { ErrorProveedor, construirCuerpo, esperaSugeridaMs, limpiarTexto, llamarChat } from "./cliente-openai";
import { llaveDe, proveedorDesdeEntorno } from "./config";
import { configDesdeFormulario, esquemaProveedor, motivoNoDatosReales, validarEndpoint } from "./esquemas";
import { aFila, deFila, resumirConsumo } from "./filas";
import { crearRegistroMemoria, estimarCostoUsd, evaluarLimites } from "./limites";
import { aPublico, detectarDatosPersonales, textoConsentimiento } from "./privacidad";
import { completarConRespaldo, ordenarCandidatos, type Candidato } from "./resiliencia";
import { probarProveedor, responderAyudaConProveedor, type DependenciasProveedores } from "./servicio";
import type { ConfigProveedor, RegistroUso, RespuestaLlm, SolicitudLlm } from "./tipos";

function proveedor(extra: Partial<ConfigProveedor> = {}): ConfigProveedor {
  return {
    id: "or-demo",
    tipo: "openrouter",
    nombre: "OpenRouter demo",
    endpoint: "https://openrouter.ai/api/v1",
    modelo: "nvidia/nemotron-3-super-120b-a12b:free",
    modelosAlternos: [],
    secretoNombre: "LLM_KEY_OPENROUTER",
    destinatarios: "OpenRouter y NVIDIA",
    capacidades: { json: true, herramientas: true, vision: false, audio: false },
    politicaDatos: { permiteDatosReales: false, descripcion: "Solo demo", entrena: true, retiene: true },
    limites: { solicitudesPorMinuto: 20, solicitudesPorDia: 50, limiteMensualUsd: 0, maxTokensSalida: 400, tiempoMaximoMs: 5000, reintentos: 2 },
    costo: { entradaUsdPorMillon: 0, salidaUsdPorMillon: 0 },
    activo: true,
    prioridad: 10,
    origen: "base-de-datos",
    ...extra,
  };
}

const SOLICITUD: SolicitudLlm = { mensajes: [{ rol: "user", contenido: "PREGUNTA-SECRETA" }], respuestaJson: true };

function respuestaHttp(estado: number, cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), { status: estado, headers: cabeceras });
}

const OK_JSON = (contenido: string, modelo = "nvidia/nemotron-3-super-120b-a12b:free") => ({
  model: modelo,
  choices: [{ message: { content: contenido } }],
  usage: { prompt_tokens: 120, completion_tokens: 30 },
});

const formularioValido = {
  id: "openrouter-demo",
  tipo: "openrouter",
  nombre: "OpenRouter demo",
  endpoint: "https://openrouter.ai/api/v1/",
  modelo: "nvidia/nemotron-3-super-120b-a12b:free",
  modelosAlternos: "nvidia/nemotron-3.5-lightning:free\nnvidia/nemotron-3.5-lightning:free",
  secretoNombre: "llm_key_openrouter",
  destinatarios: "OpenRouter y NVIDIA",
  json: "on",
  politicaDescripcion: "Solo demo",
  politicaFuente: "",
  entrena: "si",
  retiene: "si",
  activo: "on",
};

describe("catálogo verificado", () => {
  it("los modelos gratuitos nunca vienen marcados para datos reales", () => {
    for (const m of MODELOS_OPENROUTER.filter((x) => x.gratuito)) expect(m.politica.permiteDatosReales, m.id).toBe(false);
    for (const p of Object.values(PLANTILLAS)) for (const m of p.modelos) expect(m.politica.permiteDatosReales).toBe(false);
  });

  it("incluye modelos NVIDIA gratuitos y Qwen/DeepSeek de bajo costo con su fuente y fecha", () => {
    expect(MODELOS_OPENROUTER.filter((m) => m.familia === "NVIDIA" && m.gratuito).length).toBeGreaterThanOrEqual(3);
    expect(MODELOS_OPENROUTER.some((m) => m.familia === "Qwen" && !m.gratuito)).toBe(true);
    expect(MODELOS_OPENROUTER.some((m) => m.familia === "DeepSeek" && !m.gratuito && m.politica.exigirZdr)).toBe(true);
    for (const m of MODELOS_OPENROUTER) expect(m.politica.verificadoEn).toBe("2026-10-06");
  });

  it("reconoce modelos gratuitos", () => {
    expect(esModeloGratuito("x/y:free")).toBe(true);
    expect(esModeloGratuito("openrouter/free")).toBe(true);
    expect(esModeloGratuito("deepseek/deepseek-v4-flash")).toBe(false);
  });
});

describe("validación de la configuración", () => {
  it("acepta un proveedor gratuito y normaliza campos", () => {
    const r = esquemaProveedor.safeParse(formularioValido);
    expect(r.success).toBe(true);
    const c = configDesdeFormulario(r.data!);
    expect(c.endpoint).toBe("https://openrouter.ai/api/v1");
    expect(c.secretoNombre).toBe("LLM_KEY_OPENROUTER");
    expect(c.modelosAlternos).toEqual(["nvidia/nemotron-3.5-lightning:free"]);
    expect(c.limites.tiempoMaximoMs).toBe(20000);
  });

  it("rechaza secretos sin el prefijo LLM_KEY_ (no puede leer otras variables del servidor)", () => {
    const r = esquemaProveedor.safeParse({ ...formularioValido, secretoNombre: "SUPABASE_SERVICE_ROLE_KEY" });
    expect(r.success).toBe(false);
  });

  it("exige llave para OpenRouter y FreeLLMAPI, no para un servidor local", () => {
    expect(esquemaProveedor.safeParse({ ...formularioValido, secretoNombre: "" }).success).toBe(false);
    const local = { ...formularioValido, tipo: "openai_compatible", endpoint: "http://127.0.0.1:11434/v1", modelo: "llama3", modelosAlternos: "", secretoNombre: "" };
    expect(esquemaProveedor.safeParse(local).success).toBe(true);
  });

  it.each([
    ["http://example.com/v1", false],
    ["https://user:pass@example.com/v1", false],
    ["https://example.com/v1?x=1", false],
    ["ftp://example.com", false],
    ["https://openrouter.ai/api/v1", true],
    ["http://localhost:3001/v1", true],
    ["http://192.168.1.20:1234/v1", true],
  ])("endpoint %s → %s", (url, valido) => {
    expect(validarEndpoint(url) === null).toBe(valido);
  });

  it("no deja marcar datos reales en modelos gratuitos, FreeLLMAPI ni sin ZDR en OpenRouter", () => {
    expect(motivoNoDatosReales({ tipo: "openrouter", modelos: ["nvidia/x:free"], entrena: false, retiene: false, exigirZdr: true })).toMatch(/gratuitos/);
    expect(motivoNoDatosReales({ tipo: "freellmapi", modelos: ["auto"], entrena: false, retiene: false })).toMatch(/FreeLLMAPI/);
    expect(motivoNoDatosReales({ tipo: "openrouter", modelos: ["deepseek/deepseek-v4-flash"], entrena: false, retiene: false })).toMatch(/ZDR/);
    expect(motivoNoDatosReales({ tipo: "openrouter", modelos: ["deepseek/deepseek-v4-flash"], entrena: false, retiene: null, exigirZdr: true })).toBeNull();
    expect(motivoNoDatosReales({ tipo: "openai_compatible", modelos: ["llama3"], entrena: null, retiene: false })).toMatch(/entrena/);
  });

  it("pide confirmar la política al marcar datos reales", () => {
    const base = { ...formularioValido, modelo: "deepseek/deepseek-v4-flash", modelosAlternos: "", entrena: "no", retiene: "no", exigirZdr: "on", permiteDatosReales: "on" };
    expect(esquemaProveedor.safeParse(base).success).toBe(false);
    expect(esquemaProveedor.safeParse({ ...base, confirmoPolitica: "on" }).success).toBe(true);
  });

  it("la fila de base de datos no lleva la llave y se recupera igual", () => {
    const p = proveedor({ politicaDatos: { permiteDatosReales: false, descripcion: "x", entrena: true, retiene: null } });
    const fila = aFila(p);
    expect(JSON.stringify(fila)).not.toMatch(/sk-|Bearer/);
    expect(deFila({ ...fila, limite_mensual_usd: "0.00" } as never)).toEqual({ ...p, limites: { ...p.limites, limiteMensualUsd: 0 } });
  });
});

describe("cliente compatible con OpenAI", () => {
  it("pide JSON, limita tokens y exige ZDR en OpenRouter cuando corresponde", () => {
    const c = construirCuerpo(proveedor({ politicaDatos: { permiteDatosReales: true, descripcion: "", exigirZdr: true } }), "deepseek/deepseek-v4-flash", { ...SOLICITUD, maxTokens: 9999 });
    expect(c).toMatchObject({ model: "deepseek/deepseek-v4-flash", max_tokens: 400, response_format: { type: "json_object" }, provider: { zdr: true, data_collection: "deny" } });
    expect(construirCuerpo(proveedor({ tipo: "freellmapi" }), "auto", SOLICITUD).provider).toBeUndefined();
  });

  it("envía la llave solo en la cabecera Authorization y lee el uso", async () => {
    let cabeceras: Headers | undefined;
    let url = "";
    const r = await llamarChat(proveedor(), "m", SOLICITUD, {
      llave: "sk-prueba",
      fetch: async (u, init) => {
        url = String(u);
        cabeceras = new Headers(init?.headers);
        return respuestaHttp(200, OK_JSON("```json\n{\"a\":1}\n```"));
      },
    });
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(cabeceras?.get("authorization")).toBe("Bearer sk-prueba");
    expect(r).toMatchObject({ texto: '{"a":1}', tokensEntrada: 120, tokensSalida: 30, proveedor: "OpenRouter demo" });
  });

  it("convierte 429 en error reintentable con la espera sugerida, sin el prompt", async () => {
    const e = await llamarChat(proveedor(), "m", SOLICITUD, { fetch: async () => respuestaHttp(429, { error: { message: "Rate limit" } }, { "retry-after": "3" }) }).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorProveedor);
    expect(e).toMatchObject({ codigo: "limite_429", estadoHttp: 429, esperaMs: 3000, reintentable: true });
    expect(String(e.message)).not.toContain("PREGUNTA-SECRETA");
  });

  it("detecta errores dentro de una respuesta 200 y respuestas vacías", async () => {
    await expect(llamarChat(proveedor(), "m", SOLICITUD, { fetch: async () => respuestaHttp(200, { error: { code: 429 } }) })).rejects.toMatchObject({ codigo: "limite_429" });
    await expect(llamarChat(proveedor(), "m", SOLICITUD, { fetch: async () => respuestaHttp(200, OK_JSON("  ")) })).rejects.toMatchObject({ codigo: "respuesta_invalida" });
    await expect(llamarChat(proveedor(), "m", SOLICITUD, { fetch: async () => respuestaHttp(401, {}) })).rejects.toMatchObject({ codigo: "autorizacion", reintentable: false });
    await expect(llamarChat(proveedor(), "m", SOLICITUD, { fetch: async () => { throw new TypeError("fetch failed"); } })).rejects.toMatchObject({ codigo: "red" });
  });

  it("interpreta Retry-After y X-RateLimit-Reset", () => {
    expect(esperaSugeridaMs(new Headers({ "retry-after": "2" }))).toBe(2000);
    expect(esperaSugeridaMs(new Headers({ "x-ratelimit-reset": String(10_000 + 1e12) }), 1e12)).toBe(10_000);
    expect(esperaSugeridaMs(new Headers())).toBeUndefined();
    expect(limpiarTexto("```\nhola\n```")).toBe("hola");
  });
});

describe("límites y consumo", () => {
  it("aplica límites por minuto, por día y de gasto", () => {
    const l = proveedor().limites;
    expect(evaluarLimites(l, { ultimoMinuto: 20, hoy: 0, gastoMesUsd: 0 }, 0)).toBe("por_minuto");
    expect(evaluarLimites(l, { ultimoMinuto: 0, hoy: 50, gastoMesUsd: 0 }, 0)).toBe("por_dia");
    expect(evaluarLimites(l, { ultimoMinuto: 0, hoy: 0, gastoMesUsd: 0 }, 0)).toBeNull();
    expect(evaluarLimites({ ...l, limiteMensualUsd: 0 }, { ultimoMinuto: 0, hoy: 0, gastoMesUsd: 0 }, 0.001)).toBe("gasto_mensual");
    expect(evaluarLimites({ ...l, limiteMensualUsd: 1 }, { ultimoMinuto: 0, hoy: 0, gastoMesUsd: 0.5 }, 0.001)).toBeNull();
    expect(estimarCostoUsd({ entradaUsdPorMillon: 0.21, salidaUsdPorMillon: 1.41 }, 1_000_000, 1_000_000)).toBeCloseTo(1.62);
  });

  it("el registro en memoria cuenta por ventana", async () => {
    let t = Date.UTC(2026, 9, 6, 12);
    const r = crearRegistroMemoria(() => t);
    const fila: RegistroUso = { proveedorId: "a", modelo: "m", codigoResultado: "ok", intento: 1, latenciaMs: 5, origen: "asistente-ayuda", costoEstimadoUsd: 0.25 };
    await r.registrar(fila);
    await r.registrar({ ...fila, proveedorId: "b" });
    t += 61_000;
    await r.registrar(fila);
    expect(await r.uso("a")).toEqual({ ultimoMinuto: 1, hoy: 2, gastoMesUsd: 0.5 });
  });

  it("resume el consumo por proveedor", () => {
    const base = { fecha: "", modelo: "m", intento: 1, latenciaMs: 1, origen: "asistente-ayuda" };
    expect(
      resumirConsumo([
        { ...base, proveedorId: "a", codigo: "ok", tokensEntrada: 10, tokensSalida: 5, costoUsd: 0.1 },
        { ...base, proveedorId: "a", codigo: "limite_429", tokensEntrada: null, tokensSalida: null, costoUsd: null },
      ]),
    ).toEqual([{ proveedorId: "a", solicitudes: 2, errores: 1, limites429: 1, tokens: 15, costoUsd: 0.1 }]);
  });
});

describe("reintentos y respaldo", () => {
  function entorno(respuestas: Record<string, (() => RespuestaLlm | Promise<RespuestaLlm>)[]>) {
    const registros: RegistroUso[] = [];
    const esperas: number[] = [];
    const llamadas: string[] = [];
    const registro = crearRegistroMemoria();
    const original = registro.registrar;
    registro.registrar = async (r) => {
      registros.push(r);
      await original(r);
    };
    return {
      registros,
      esperas,
      llamadas,
      opciones: {
        origen: "asistente-ayuda" as const,
        registroDe: () => registro,
        esperar: async (ms: number) => {
          esperas.push(ms);
        },
        llamar: async (c: Candidato) => {
          const clave = `${c.proveedor.id}/${c.modelo}`;
          llamadas.push(clave);
          const siguiente = respuestas[clave]?.shift();
          if (!siguiente) throw new ErrorProveedor("servidor", 500);
          return siguiente();
        },
      },
    };
  }

  const ok = (modelo: string) => () => ({ texto: "{}", modelo });
  const falla = (codigo: ErrorProveedor["codigo"], esperaMs?: number) => () => {
    throw new ErrorProveedor(codigo, undefined, esperaMs);
  };

  it("reintenta un 429 con espera exponencial y responde", async () => {
    const e = entorno({ "or-demo/a": [falla("limite_429"), falla("limite_429"), ok("a")] });
    const p = proveedor({ modelo: "a" });
    const r = await completarConRespaldo([{ proveedor: p, modelo: "a", llave: "k" }], SOLICITUD, e.opciones);
    expect(r.respuesta.modelo).toBe("a");
    expect(e.esperas).toEqual([500, 1000]);
    expect(r.intentos.map((i) => i.codigo)).toEqual(["limite_429", "limite_429", "ok"]);
    expect(r.huboRespaldo).toBe(false);
  });

  it("si el proveedor pide esperar demasiado, pasa al modelo alterno", async () => {
    const e = entorno({ "or-demo/a": [falla("limite_429", 60_000)], "or-demo/b": [ok("b")] });
    const p = proveedor({ modelo: "a", modelosAlternos: ["b"] });
    const r = await completarConRespaldo(ordenarCandidatos(p, [], () => "k"), SOLICITUD, e.opciones);
    expect(r.respuesta.modelo).toBe("b");
    expect(e.esperas).toEqual([]);
    expect(r.huboRespaldo).toBe(true);
  });

  it("con llave inválida salta todos los modelos de ese proveedor y usa el respaldo", async () => {
    const e = entorno({ "or-demo/a": [falla("autorizacion")], "local/x": [ok("x")] });
    const p = proveedor({ modelo: "a", modelosAlternos: ["b"] });
    const local = proveedor({ id: "local", tipo: "openai_compatible", modelo: "x", secretoNombre: undefined, prioridad: 50 });
    const r = await completarConRespaldo(ordenarCandidatos(p, [local], (q) => (q.id === "local" ? undefined : "k")), SOLICITUD, e.opciones);
    expect(e.llamadas).toEqual(["or-demo/a", "local/x"]);
    expect(r.candidato.proveedor.id).toBe("local");
  });

  it("no llama si falta la llave o si se alcanzó un límite local", async () => {
    const e = entorno({});
    const sinLlave = completarConRespaldo([{ proveedor: proveedor(), modelo: "a" }], SOLICITUD, e.opciones);
    await expect(sinLlave).rejects.toMatchObject({ codigo: "sin_llave" });
    const limitado = proveedor({ limites: { ...proveedor().limites, solicitudesPorDia: 0 } });
    await expect(completarConRespaldo([{ proveedor: limitado, modelo: "a", llave: "k" }], SOLICITUD, e.opciones)).rejects.toMatchObject({ codigo: "limite_local" });
    expect(e.llamadas).toEqual([]);
  });

  it("registra cada intento sin el contenido de la solicitud", async () => {
    const e = entorno({ "or-demo/a": [falla("servidor"), ok("a")] });
    await completarConRespaldo([{ proveedor: proveedor({ modelo: "a" }), modelo: "a", llave: "k" }], SOLICITUD, e.opciones);
    expect(e.registros.map((r) => r.codigoResultado)).toEqual(["servidor", "ok"]);
    expect(JSON.stringify(e.registros)).not.toContain("PREGUNTA-SECRETA");
    expect(e.registros[1]).toMatchObject({ tokensEntrada: expect.any(Number), costoEstimadoUsd: 0 });
  });
});

describe("datos personales y consentimiento", () => {
  it.each([
    ["mi correo es ana@ejemplo.com", "correo"],
    ["llámame al 55 1234 5678", "telefono"],
    ["nací el 12/03/1990", "fecha"],
    ["nací el 12 de marzo de 1990", "fecha"],
    ["mi CURP es GODE561231HDFRRN09", "curp"],
  ])("«%s» → %s", (texto, tipo) => {
    expect(detectarDatosPersonales(texto)).toContain(tipo);
  });

  it("no marca preguntas normales sobre la app", () => {
    for (const p of ["¿Cómo se cuenta la ñ?", "¿Qué son los números maestros 11, 22 y 33?", "¿Qué falta del proyecto en la etapa 4?"]) {
      expect(detectarDatosPersonales(p), p).toEqual([]);
    }
  });

  it("la vista pública no incluye endpoint ni secreto, y el consentimiento nombra al destinatario", () => {
    const publico = aPublico(proveedor());
    expect(JSON.stringify(publico)).not.toMatch(/LLM_KEY|openrouter\.ai\/api/);
    expect(publico.gratuito).toBe(true);
    expect(textoConsentimiento(publico)).toMatch(/OpenRouter y NVIDIA.*solo para demostración/);
  });
});

describe("asistente de ayuda con proveedor", () => {
  function deps(llamar: DependenciasProveedores["llamar"], activos = [proveedor()]): DependenciasProveedores & { registro: ReturnType<typeof crearRegistroMemoria> } {
    const registro = crearRegistroMemoria();
    return { proveedoresActivos: async () => activos, registroDe: () => registro, llaveDe: () => "k", llamar, esperar: async () => {}, registro };
  }

  const responderConCita: DependenciasProveedores["llamar"] = async (c, s) => {
    const id = /\[([^\]]+)\]/.exec(s.mensajes[1].contenido)![1];
    return { texto: JSON.stringify({ afirmaciones: [{ texto: "La ñ cuenta como n.", fragmentos: [id] }] }), modelo: c.modelo };
  };

  it("responde citando el centro de ayuda y avisa qué modelo respondió", async () => {
    const r = await responderAyudaConProveedor({ pregunta: "¿Cómo se cuenta la ñ?", proveedorId: "or-demo", consentidos: ["or-demo"] }, SECCIONES_AYUDA, deps(responderConCita));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.respuesta.modo).toBe("llm");
    expect(r.respuesta.afirmaciones[0].citas.length).toBe(1);
    expect(r.respuesta.aviso).toContain("nvidia/nemotron-3-super-120b-a12b:free");
  });

  it("sin consentimiento no llama al proveedor", async () => {
    let llamado = false;
    const r = await responderAyudaConProveedor({ pregunta: "numerología", proveedorId: "or-demo", consentidos: ["otro"] }, SECCIONES_AYUDA, deps(async () => {
      llamado = true;
      return { texto: "{}", modelo: "m" };
    }));
    expect(r).toMatchObject({ ok: false, error: { codigo: "sin_consentimiento" } });
    expect(llamado).toBe(false);
  });

  it("un proveedor solo demo no recibe datos personales", async () => {
    const r = await responderAyudaConProveedor({ pregunta: "nací el 12/03/1990, ¿qué número tengo?", proveedorId: "or-demo", consentidos: ["or-demo"] }, SECCIONES_AYUDA, deps(responderConCita));
    expect(r).toMatchObject({ ok: false, error: { codigo: "datos_personales", datos: ["fecha"] } });
  });

  it("el respaldo solo usa proveedores aceptados", async () => {
    const otro = proveedor({ id: "otro", nombre: "Otro", prioridad: 20 });
    const llamadas: string[] = [];
    const llamar: DependenciasProveedores["llamar"] = async (c, s) => {
      llamadas.push(c.proveedor.id);
      if (c.proveedor.id === "or-demo") throw new ErrorProveedor("solicitud", 404);
      return responderConCita(c, s);
    };
    const sinAceptar = await responderAyudaConProveedor({ pregunta: "¿Cómo se cuenta la ñ?", proveedorId: "or-demo", consentidos: ["or-demo"] }, SECCIONES_AYUDA, deps(llamar, [proveedor(), otro]));
    expect(sinAceptar).toMatchObject({ ok: false, error: { codigo: "sin_respuesta", causa: "solicitud" } });
    expect(llamadas).toEqual(["or-demo"]);
    const aceptado = await responderAyudaConProveedor({ pregunta: "¿Cómo se cuenta la ñ?", proveedorId: "or-demo", consentidos: ["or-demo", "otro"] }, SECCIONES_AYUDA, deps(llamar, [proveedor(), otro]));
    expect(aceptado).toMatchObject({ ok: true, huboRespaldo: true });
  });

  it("explica un 429 persistente", async () => {
    const r = await responderAyudaConProveedor({ pregunta: "¿Cómo se cuenta la ñ?", proveedorId: "or-demo", consentidos: ["or-demo"] }, SECCIONES_AYUDA, deps(async () => {
      throw new ErrorProveedor("limite_429", 429);
    }));
    expect(r).toMatchObject({ ok: false, error: { codigo: "sin_respuesta", causa: "limite_429", mensaje: expect.stringMatching(/429/) } });
  });

  it("un proveedor inactivo devuelve al modo demo", async () => {
    const r = await responderAyudaConProveedor({ pregunta: "x", proveedorId: "nada", consentidos: ["nada"] }, SECCIONES_AYUDA, deps(responderConCita));
    expect(r).toMatchObject({ ok: false, error: { codigo: "proveedor_no_disponible" } });
  });

  it("la prueba de conexión manda un texto fijo y queda registrada como prueba", async () => {
    let enviado = "";
    const d = deps(async (c, s) => {
      enviado = s.mensajes[0].contenido;
      return { texto: "listo", modelo: c.modelo };
    });
    const r = await probarProveedor(proveedor(), d);
    expect(r).toMatchObject({ ok: true, codigo: "ok" });
    expect(enviado).toBe("Responde solo con la palabra: listo");
    expect(d.registro.recientes()[0].origen).toBe("prueba-admin");
  });
});

describe("proveedor por variables de entorno", () => {
  it("arma OpenRouter con el modelo NVIDIA gratuito por defecto y solo demo", () => {
    const p = proveedorDesdeEntorno({ LLM_PROVIDER: "openrouter", LLM_API_KEY: "sk", LLM_PERMITE_DATOS_REALES: "true" });
    expect(p).toMatchObject({ id: "entorno", modelo: "nvidia/nemotron-3-super-120b-a12b:free", politicaDatos: { permiteDatosReales: false } });
    expect(llaveDe(p!, { LLM_API_KEY: "sk" })).toBe("sk");
  });

  it("acepta un servidor local sin llave", () => {
    expect(proveedorDesdeEntorno({ LLM_PROVIDER: "ollama", LLM_MODEL: "llama3" })).toMatchObject({ tipo: "openai_compatible", endpoint: "http://127.0.0.1:11434/v1" });
    expect(proveedorDesdeEntorno({})).toBeNull();
  });

  it("solo lee secretos con prefijo LLM_KEY_ para proveedores de la base", () => {
    expect(llaveDe(proveedor({ secretoNombre: "SUPABASE_SERVICE_ROLE_KEY" }), { SUPABASE_SERVICE_ROLE_KEY: "x" })).toBeUndefined();
    expect(llaveDe(proveedor(), { LLM_KEY_OPENROUTER: "y" })).toBe("y");
  });
});
