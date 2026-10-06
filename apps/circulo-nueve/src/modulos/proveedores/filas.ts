import { PLANTILLAS } from "./catalogo";
import type { ConfigProveedor, TipoProveedor } from "./tipos";

/** Conversión entre la configuración y las filas de `ai_providers` / `ai_usage`. */

export interface FilaProveedor {
  id: string;
  tipo: TipoProveedor;
  nombre: string;
  endpoint: string;
  modelo: string;
  modelos_alternos: string[] | null;
  secreto_nombre: string | null;
  destinatarios: string;
  capacidades: Partial<ConfigProveedor["capacidades"]> | null;
  permite_datos_reales: boolean;
  limite_mensual_usd: number | string | null;
  politica: Partial<ConfigProveedor["politicaDatos"]> | null;
  limites: Partial<ConfigProveedor["limites"]> | null;
  costo: Partial<ConfigProveedor["costo"]> | null;
  activo: boolean;
  prioridad: number;
}

export const COLUMNAS =
  "id, tipo, nombre, endpoint, modelo, modelos_alternos, secreto_nombre, destinatarios, capacidades, permite_datos_reales, limite_mensual_usd, politica, limites, costo, activo, prioridad";

export function deFila(f: FilaProveedor): ConfigProveedor {
  const base = PLANTILLAS[f.tipo]?.limites ?? PLANTILLAS.openai_compatible.limites;
  const limiteMensual = f.limite_mensual_usd === null ? undefined : Number(f.limite_mensual_usd);
  return {
    id: f.id,
    tipo: f.tipo,
    nombre: f.nombre,
    endpoint: f.endpoint,
    modelo: f.modelo,
    modelosAlternos: f.modelos_alternos ?? [],
    secretoNombre: f.secreto_nombre ?? undefined,
    destinatarios: f.destinatarios,
    capacidades: { json: false, herramientas: false, vision: false, audio: false, ...f.capacidades },
    politicaDatos: { descripcion: "", ...f.politica, permiteDatosReales: f.permite_datos_reales },
    limites: { ...base, ...f.limites, limiteMensualUsd: limiteMensual },
    costo: { entradaUsdPorMillon: 0, salidaUsdPorMillon: 0, ...f.costo },
    activo: f.activo,
    prioridad: f.prioridad,
    origen: "base-de-datos",
  };
}

export function aFila(p: ConfigProveedor): FilaProveedor {
  const { permiteDatosReales, ...politica } = p.politicaDatos;
  const { limiteMensualUsd, ...limites } = p.limites;
  return {
    id: p.id,
    tipo: p.tipo,
    nombre: p.nombre,
    endpoint: p.endpoint,
    modelo: p.modelo,
    modelos_alternos: p.modelosAlternos,
    secreto_nombre: p.secretoNombre ?? null,
    destinatarios: p.destinatarios,
    capacidades: p.capacidades,
    permite_datos_reales: permiteDatosReales,
    limite_mensual_usd: limiteMensualUsd ?? null,
    politica,
    limites,
    costo: p.costo,
    activo: p.activo,
    prioridad: p.prioridad,
  };
}

export interface FilaConsumo {
  fecha: string;
  proveedorId: string;
  modelo: string;
  codigo: string;
  intento: number;
  latenciaMs: number | null;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  costoUsd: number | null;
  origen: string;
}

export interface ResumenConsumo {
  recientes: FilaConsumo[];
  porProveedor: { proveedorId: string; solicitudes: number; errores: number; limites429: number; tokens: number; costoUsd: number }[];
}

export function resumirConsumo(filas: FilaConsumo[]): ResumenConsumo["porProveedor"] {
  const mapa = new Map<string, ResumenConsumo["porProveedor"][number]>();
  for (const f of filas) {
    const r = mapa.get(f.proveedorId) ?? { proveedorId: f.proveedorId, solicitudes: 0, errores: 0, limites429: 0, tokens: 0, costoUsd: 0 };
    r.solicitudes++;
    if (f.codigo !== "ok") r.errores++;
    if (f.codigo === "limite_429") r.limites429++;
    r.tokens += (f.tokensEntrada ?? 0) + (f.tokensSalida ?? 0);
    r.costoUsd += f.costoUsd ?? 0;
    mapa.set(f.proveedorId, r);
  }
  return [...mapa.values()];
}
