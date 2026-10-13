import { describe, expect, it } from "vitest";
import { ErrorProveedor } from "@/modulos/proveedores/cliente-openai";
import { crearRegistroMemoria } from "@/modulos/proveedores/limites";
import { ErrorSinRespuesta } from "@/modulos/proveedores/resiliencia";
import type { DependenciasProveedores } from "@/modulos/proveedores/servicio";
import type { ConfigProveedor, SolicitudLlm } from "@/modulos/proveedores/tipos";
import { llmParaBiblioteca, mensajeErrorProveedor, proveedoresParaBiblioteca } from "./llm";
import { construirMensajes, validarRespuesta } from "./respuesta";
import type { FragmentoRecuperado } from "./tipos";

const PROVEEDOR: ConfigProveedor = {
  id: "demo",
  tipo: "openai_compatible",
  nombre: "Proveedor de prueba",
  endpoint: "http://127.0.0.1:1/v1",
  modelo: "modelo-demo",
  modelosAlternos: [],
  secretoNombre: "LLM_KEY_DEMO",
  destinatarios: "Servidor de prueba",
  capacidades: { json: true, herramientas: false, vision: false, audio: false },
  politicaDatos: { permiteDatosReales: false, descripcion: "Solo demo" },
  limites: { maxTokensSalida: 400, tiempoMaximoMs: 2000, reintentos: 0 },
  costo: { entradaUsdPorMillon: 0, salidaUsdPorMillon: 0 },
  activo: true,
  prioridad: 1,
  origen: "base-de-datos",
};

const FRAGMENTO: FragmentoRecuperado = {
  chunkId: "c1",
  fuenteId: "f1",
  titulo: "Manual ficticio (DEMO)",
  autor: null,
  referencia: "demo",
  edicion: null,
  fechaConsulta: null,
  grupo: "aportada",
  esDemo: true,
  texto: "Los números maestros 11, 22 y 33 se conservan sin reducir.",
  localizador: { seccion: "Los números maestros" },
  jerarquia: [],
  sospechoso: false,
  ocrConfianza: null,
  puntaje: 1,
};

function dependencias(llamar: DependenciasProveedores["llamar"]) {
  const registro = crearRegistroMemoria();
  const deps: DependenciasProveedores = {
    proveedoresActivos: async () => [PROVEEDOR],
    registroDe: () => registro,
    llaveDe: () => "llave-de-prueba",
    llamar,
    esperar: async () => {},
  };
  return { deps, registro };
}

describe("bot de la biblioteca con la capa de proveedores", () => {
  it("ofrece los proveedores activos con su texto de consentimiento, sin endpoint ni secreto", async () => {
    const [p] = await proveedoresParaBiblioteca(dependencias(undefined).deps);
    expect(p).toMatchObject({ id: "demo", aptoDatosReales: false });
    expect(p.consentimiento).toContain("fragmentos de las fuentes de la biblioteca");
    expect(JSON.stringify(p)).not.toMatch(/127\.0\.0\.1|LLM_KEY/);
  });

  it("envía solo los fragmentos delimitados, valida la respuesta y registra el consumo sin el texto", async () => {
    let recibida: SolicitudLlm | undefined;
    const { deps, registro } = dependencias(async (_c, s) => {
      recibida = s;
      return {
        texto: JSON.stringify({ afirmaciones: [{ texto: "Los números maestros 11, 22 y 33 se conservan sin reducir.", chunk_ids: ["c1"], tipo_cita: "textual" }] }),
        modelo: "modelo-demo",
        tokensEntrada: 50,
        tokensSalida: 20,
      };
    });
    const r = await llmParaBiblioteca({ proveedorId: "demo", consentido: true, pregunta: "¿Qué son los números maestros?", usuarioId: "u1" }, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const salida = await r.llm.completar({ mensajes: construirMensajes("¿Qué son los números maestros?", [FRAGMENTO]), respuestaJson: true });
    expect(validarRespuesta(salida.texto, [FRAGMENTO])[0]).toMatchObject({ tipoCita: "textual", chunkIds: ["c1"] });
    expect(recibida?.mensajes[1].contenido).toContain("<datos_no_confiables>");
    const [uso] = registro.recientes();
    expect(uso).toMatchObject({ origen: "biblioteca", usuarioId: "u1", codigoResultado: "ok" });
    expect(JSON.stringify(uso)).not.toContain("números maestros");
  });

  it("exige consentimiento y no envía datos personales a un proveedor solo demo", async () => {
    const { deps } = dependencias(async () => ({ texto: "{}", modelo: "x" }));
    expect(await llmParaBiblioteca({ proveedorId: "demo", consentido: false, pregunta: "hola" }, deps)).toMatchObject({ ok: false });
    const r = await llmParaBiblioteca({ proveedorId: "demo", consentido: true, pregunta: "Mi correo es ana@demo.invalid" }, deps);
    expect(!r.ok && r.mensaje).toContain("un correo");
    expect(await llmParaBiblioteca({ proveedorId: "otro", consentido: true, pregunta: "hola" }, deps)).toMatchObject({ ok: false });
  });

  it("un 429 persistente se informa sin romper el bot", async () => {
    const { deps } = dependencias(async () => {
      throw new ErrorProveedor("limite_429", 429, 0);
    });
    const r = await llmParaBiblioteca({ proveedorId: "demo", consentido: true, pregunta: "hola" }, deps);
    if (!r.ok) throw new Error("debía crearse");
    const error = await r.llm.completar({ mensajes: [] }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorSinRespuesta);
    expect(mensajeErrorProveedor(error)).toContain("429");
  });
});
