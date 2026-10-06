import type { CostoProveedor, LimitesProveedor, RegistroConsumo, RegistroUso, SolicitudLlm, UsoActual } from "./tipos";

/** Aproximación conservadora sin tokenizador: ~3 caracteres por token en español. */
export function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 3);
}

export function estimarTokensSolicitud(solicitud: SolicitudLlm): number {
  return solicitud.mensajes.reduce((t, m) => t + estimarTokens(m.contenido) + 4, 0);
}

export function estimarCostoUsd(costo: CostoProveedor, tokensEntrada: number, tokensSalida: number): number {
  return (tokensEntrada * costo.entradaUsdPorMillon + tokensSalida * costo.salidaUsdPorMillon) / 1_000_000;
}

export type MotivoLimite = "por_minuto" | "por_dia" | "gasto_mensual";

export const MENSAJE_LIMITE: Record<MotivoLimite, string> = {
  por_minuto: "Se alcanzó el límite de solicitudes por minuto configurado para este proveedor.",
  por_dia: "Se alcanzó el límite de solicitudes por día configurado para este proveedor.",
  gasto_mensual: "La siguiente solicitud superaría el límite de gasto mensual configurado.",
};

/**
 * Decide si la siguiente solicitud cabe en los límites. Un límite mensual de 0
 * con costo > 0 bloquea: así un modelo de pago nunca gasta sin un tope explícito.
 */
export function evaluarLimites(limites: LimitesProveedor, uso: UsoActual, costoSiguienteUsd: number): MotivoLimite | null {
  if (limites.solicitudesPorMinuto !== undefined && uso.ultimoMinuto >= limites.solicitudesPorMinuto) return "por_minuto";
  if (limites.solicitudesPorDia !== undefined && uso.hoy >= limites.solicitudesPorDia) return "por_dia";
  if (costoSiguienteUsd > 0) {
    const tope = limites.limiteMensualUsd ?? 0;
    if (uso.gastoMesUsd + costoSiguienteUsd > tope) return "gasto_mensual";
  }
  return null;
}

/** Registro en memoria por instancia del servidor; respaldo cuando no hay Supabase. */
export function crearRegistroMemoria(ahora: () => number = Date.now, maximo = 2000): RegistroConsumo & {
  recientes(): (RegistroUso & { fecha: number })[];
} {
  const filas: (RegistroUso & { fecha: number })[] = [];
  return {
    async registrar(r) {
      filas.push({ ...r, fecha: ahora() });
      if (filas.length > maximo) filas.splice(0, filas.length - maximo);
    },
    async uso(proveedorId) {
      const t = ahora();
      const inicioDia = new Date(t);
      inicioDia.setUTCHours(0, 0, 0, 0);
      const inicioMes = new Date(Date.UTC(inicioDia.getUTCFullYear(), inicioDia.getUTCMonth(), 1)).getTime();
      const propias = filas.filter((f) => f.proveedorId === proveedorId);
      return {
        ultimoMinuto: propias.filter((f) => t - f.fecha < 60_000).length,
        hoy: propias.filter((f) => f.fecha >= inicioDia.getTime()).length,
        gastoMesUsd: propias.filter((f) => f.fecha >= inicioMes).reduce((s, f) => s + (f.costoEstimadoUsd ?? 0), 0),
      };
    },
    recientes() {
      return [...filas].reverse();
    },
  };
}
