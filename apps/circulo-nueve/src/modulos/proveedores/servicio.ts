import type { SeccionAyuda } from "@/content/ayuda";
import { crearAsistenteLlm, type RespuestaAsistente } from "@/modulos/conversacion/asistente-ayuda";
import { llamarChat } from "./cliente-openai";
import { MENSAJE_LIMITE } from "./limites";
import { NOMBRE_DATO, detectarDatosPersonales, type TipoDatoPersonal } from "./privacidad";
import { ErrorSinRespuesta, completarConRespaldo, ordenarCandidatos, type Candidato, type ResultadoRespaldo, type ResumenIntento } from "./resiliencia";
import type { CodigoResultado, ConfigProveedor, LlmProvider, RegistroConsumo, RespuestaLlm, SolicitudLlm } from "./tipos";

export interface DependenciasProveedores {
  proveedoresActivos(): Promise<ConfigProveedor[]>;
  registroDe(p: ConfigProveedor): RegistroConsumo;
  llaveDe(p: ConfigProveedor): string | undefined;
  llamar?: (c: Candidato, s: SolicitudLlm) => Promise<RespuestaLlm>;
  esperar?: (ms: number) => Promise<void>;
  ahora?: () => number;
  origenSitio?: string;
}

export type CodigoErrorAsistente = "proveedor_no_disponible" | "sin_consentimiento" | "datos_personales" | "sin_respuesta";

export interface ErrorAsistente {
  codigo: CodigoErrorAsistente;
  mensaje: string;
  causa?: CodigoResultado;
  datos?: TipoDatoPersonal[];
  intentos?: ResumenIntento[];
}

export type ResultadoAsistente =
  | { ok: true; respuesta: RespuestaAsistente; intentos: ResumenIntento[]; huboRespaldo: boolean }
  | { ok: false; error: ErrorAsistente };

export const MENSAJE_FALLO: Record<CodigoResultado, string> = {
  ok: "",
  limite_429: "El proveedor está saturado o alcanzó su límite gratuito (HTTP 429). Se reintentó con espera y no respondió; prueba en unos minutos.",
  limite_local: "Se alcanzó un límite de uso o de gasto configurado por la administración.",
  credito: "La cuenta del proveedor no tiene crédito disponible.",
  autorizacion: "El proveedor rechazó la llave configurada en el servidor.",
  sin_llave: "Falta la llave del proveedor en el servidor.",
  tiempo: "El proveedor tardó demasiado en responder.",
  servidor: "El proveedor tuvo un error interno.",
  red: "No se pudo conectar con el proveedor.",
  solicitud: "El proveedor rechazó la solicitud (¿el modelo existe?).",
  respuesta_invalida: "El proveedor devolvió una respuesta vacía o ilegible.",
};

function llamadaPorDefecto(deps: DependenciasProveedores) {
  return (c: Candidato, s: SolicitudLlm) => llamarChat(c.proveedor, c.modelo, s, { llave: c.llave, origenSitio: deps.origenSitio });
}

function opcionesRespaldo(deps: DependenciasProveedores, origen: "asistente-ayuda" | "prueba-admin", usuarioId?: string | null) {
  return {
    llamar: deps.llamar ?? llamadaPorDefecto(deps),
    registroDe: deps.registroDe,
    esperar: deps.esperar,
    ahora: deps.ahora,
    origen,
    usuarioId,
  };
}

function mensajeSinRespuesta(e: ErrorSinRespuesta): string {
  const limite = e.intentos.find((i) => i.motivoLimite)?.motivoLimite;
  return e.codigo === "limite_local" && limite ? MENSAJE_LIMITE[limite] : MENSAJE_FALLO[e.codigo];
}

/**
 * Responde una pregunta del Centro de ayuda con un proveedor LLM. Solo usa los
 * proveedores que la persona aceptó; si el proveedor es «solo demo», se niega a
 * enviar textos con datos identificables.
 */
export async function responderAyudaConProveedor(
  entrada: { pregunta: string; proveedorId: string; consentidos: string[]; usuarioId?: string | null },
  secciones: SeccionAyuda[],
  deps: DependenciasProveedores,
): Promise<ResultadoAsistente> {
  const activos = await deps.proveedoresActivos();
  const principal = activos.find((p) => p.id === entrada.proveedorId);
  if (!principal) {
    return { ok: false, error: { codigo: "proveedor_no_disponible", mensaje: "Ese proveedor no está activo. Se usa el modo demo." } };
  }
  const consentidos = new Set(entrada.consentidos);
  if (!consentidos.has(principal.id)) {
    return { ok: false, error: { codigo: "sin_consentimiento", mensaje: "Acepta el envío a este proveedor antes de preguntar." } };
  }

  const datos = detectarDatosPersonales(entrada.pregunta);
  const respaldos = activos.filter((p) => p.id !== principal.id && consentidos.has(p.id) && (datos.length === 0 || p.politicaDatos.permiteDatosReales));
  if (datos.length && !principal.politicaDatos.permiteDatosReales) {
    return {
      ok: false,
      error: {
        codigo: "datos_personales",
        datos,
        mensaje: `Tu pregunta parece incluir ${datos.map((d) => NOMBRE_DATO[d]).join(", ")}. Este proveedor es solo para demo: quita los datos personales o usa el modo demo.`,
      },
    };
  }

  const candidatos = ordenarCandidatos(principal, respaldos, deps.llaveDe);
  let resultado: ResultadoRespaldo | undefined;
  const llm: LlmProvider = {
    id: principal.id,
    nombre: principal.nombre,
    modelo: principal.modelo,
    capacidades: principal.capacidades,
    politicaDatos: principal.politicaDatos,
    async completar(solicitud) {
      resultado = await completarConRespaldo(candidatos, solicitud, opcionesRespaldo(deps, "asistente-ayuda", entrada.usuarioId));
      return resultado.respuesta;
    },
  };

  try {
    const respuesta = await crearAsistenteLlm(llm, secciones).responder(entrada.pregunta);
    return { ok: true, respuesta, intentos: resultado?.intentos ?? [], huboRespaldo: resultado?.huboRespaldo ?? false };
  } catch (e) {
    if (e instanceof ErrorSinRespuesta) {
      return { ok: false, error: { codigo: "sin_respuesta", causa: e.codigo, mensaje: mensajeSinRespuesta(e), intentos: e.intentos } };
    }
    throw e;
  }
}

export interface ResultadoPrueba {
  ok: boolean;
  codigo: CodigoResultado;
  mensaje: string;
  modelo: string;
  latenciaMs: number;
}

/** Prueba de conexión desde la administración: un texto fijo, sin datos de nadie. */
export async function probarProveedor(p: ConfigProveedor, deps: DependenciasProveedores): Promise<ResultadoPrueba> {
  const ahora = deps.ahora ?? Date.now;
  const inicio = ahora();
  const solo: ConfigProveedor = { ...p, limites: { ...p.limites, reintentos: 0, maxTokensSalida: Math.min(p.limites.maxTokensSalida, 32) } };
  const solicitud: SolicitudLlm = { mensajes: [{ rol: "user", contenido: "Responde solo con la palabra: listo" }], maxTokens: 32, temperatura: 0 };
  try {
    const r = await completarConRespaldo([{ proveedor: solo, modelo: p.modelo, llave: deps.llaveDe(p) }], solicitud, opcionesRespaldo(deps, "prueba-admin"));
    return { ok: true, codigo: "ok", mensaje: `Respondió ${r.respuesta.modelo}.`, modelo: r.respuesta.modelo, latenciaMs: ahora() - inicio };
  } catch (e) {
    const codigo = e instanceof ErrorSinRespuesta ? e.codigo : "red";
    return { ok: false, codigo, mensaje: e instanceof ErrorSinRespuesta ? mensajeSinRespuesta(e) : MENSAJE_FALLO.red, modelo: p.modelo, latenciaMs: ahora() - inicio };
  }
}
