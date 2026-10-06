/**
 * Conexión del bot de la biblioteca con la capa de proveedores LLM
 * (`src/modulos/proveedores/`): los mismos proveedores activos, límites,
 * reintentos ante 429, respaldo por modelo y registro de consumo sin prompts que
 * usa el asistente de ayuda, con origen «biblioteca».
 */
import { PLANTILLAS } from "@/modulos/proveedores/catalogo";
import { llaveDe } from "@/modulos/proveedores/config";
import { NOMBRE_DATO, detectarDatosPersonales } from "@/modulos/proveedores/privacidad";
import { ErrorSinRespuesta, completarConRespaldo, ordenarCandidatos } from "@/modulos/proveedores/resiliencia";
import { MENSAJE_FALLO, type DependenciasProveedores } from "@/modulos/proveedores/servicio";
import { llamarChat } from "@/modulos/proveedores/cliente-openai";
import type { ConfigProveedor, LlmProvider } from "@/modulos/proveedores/tipos";

export interface ProveedorBiblioteca {
  id: string;
  nombre: string;
  modelo: string;
  aptoDatosReales: boolean;
  consentimiento: string;
}

export function textoConsentimientoBiblioteca(p: Pick<ConfigProveedor, "destinatarios" | "modelo" | "modelosAlternos" | "politicaDatos">): string {
  const modelos = [p.modelo, ...p.modelosAlternos].join(", ");
  const uso = p.politicaDatos.permiteDatosReales
    ? "La administración lo marcó como apto para datos reales."
    : "Es solo para demostración: no escribas datos personales.";
  return `Se enviarán tu pregunta y hasta 6 fragmentos de las fuentes de la biblioteca (nunca los marcados como sospechosos). Los recibe: ${p.destinatarios.replace(/\.$/, "")}. Modelos: ${modelos}. ${uso}`;
}

function usable(p: ConfigProveedor, deps: Pick<DependenciasProveedores, "llaveDe">): boolean {
  return !PLANTILLAS[p.tipo].requiereLlave || Boolean(deps.llaveDe(p));
}

// Diferido: el repositorio es solo de servidor (cookies, llave de servicio).
async function dependenciasServidor(): Promise<DependenciasProveedores> {
  return (await import("@/modulos/proveedores/repositorio")).dependenciasServidor();
}

/** Proveedores que el bot puede ofrecer (sin endpoint ni secretos). */
export async function proveedoresParaBiblioteca(dependencias?: Pick<DependenciasProveedores, "proveedoresActivos" | "llaveDe">): Promise<ProveedorBiblioteca[]> {
  const deps = dependencias ?? (await dependenciasServidor());
  const activos = await deps.proveedoresActivos();
  return activos
    .filter((p) => usable(p, deps))
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      modelo: p.modelo,
      aptoDatosReales: p.politicaDatos.permiteDatosReales,
      consentimiento: textoConsentimientoBiblioteca(p),
    }));
}

export type ResultadoLlmBiblioteca = { ok: true; llm: LlmProvider } | { ok: false; mensaje: string };

/**
 * LlmProvider para una consulta concreta. Exige que la persona haya aceptado
 * ese proveedor y, si es «solo demo», se niega a enviar una pregunta con datos
 * identificables. Los errores del proveedor salen como ErrorSinRespuesta.
 */
export async function llmParaBiblioteca(
  entrada: { proveedorId: string; consentido: boolean; pregunta: string; usuarioId?: string | null },
  dependencias?: DependenciasProveedores,
): Promise<ResultadoLlmBiblioteca> {
  const deps = dependencias ?? (await dependenciasServidor());
  const activos = await deps.proveedoresActivos();
  const principal = activos.find((p) => p.id === entrada.proveedorId && usable(p, deps));
  if (!principal) return { ok: false, mensaje: "Ese proveedor de IA no está disponible." };
  if (!entrada.consentido) return { ok: false, mensaje: "Acepta el envío a este proveedor antes de preguntar." };
  const datos = detectarDatosPersonales(entrada.pregunta);
  if (datos.length && !principal.politicaDatos.permiteDatosReales) {
    return {
      ok: false,
      mensaje: `Tu pregunta parece incluir ${datos.map((d) => NOMBRE_DATO[d]).join(", ")}. Este proveedor es solo para demo: quita los datos personales o pregunta sin IA.`,
    };
  }
  const candidatos = ordenarCandidatos(principal, [], deps.llaveDe);
  const llamar = deps.llamar ?? ((c, s) => llamarChat(c.proveedor, c.modelo, s, { llave: c.llave, origenSitio: deps.origenSitio }));
  return {
    ok: true,
    llm: {
      id: principal.id,
      nombre: principal.nombre,
      modelo: principal.modelo,
      capacidades: principal.capacidades,
      politicaDatos: principal.politicaDatos,
      async completar(solicitud) {
        const r = await completarConRespaldo(candidatos, solicitud, {
          llamar,
          registroDe: deps.registroDe,
          esperar: deps.esperar,
          ahora: deps.ahora,
          origen: "biblioteca",
          usuarioId: entrada.usuarioId,
        });
        return r.respuesta;
      },
    },
  };
}

export function mensajeErrorProveedor(e: unknown): string | null {
  return e instanceof ErrorSinRespuesta ? MENSAJE_FALLO[e.codigo] || "El proveedor no respondió." : null;
}

export { llaveDe };
