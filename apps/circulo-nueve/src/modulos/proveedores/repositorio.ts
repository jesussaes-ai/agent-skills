import "server-only";
import { leerConfigSupabase, tieneLlaveServicio } from "@/modulos/auth/config";
import { clienteSupabaseAdmin, clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { llaveDe, proveedorDesdeEntorno } from "./config";
import { COLUMNAS, aFila, deFila, resumirConsumo, type FilaConsumo, type FilaProveedor, type ResumenConsumo } from "./filas";
import { crearRegistroMemoria } from "./limites";
import type { ConfigProveedor, RegistroConsumo, RegistroUso } from "./tipos";

const memoria = crearRegistroMemoria();

export function hayBaseDeDatos(): boolean {
  return leerConfigSupabase().configurado && tieneLlaveServicio();
}

/** Proveedores activos para responder. Sin base de datos, el definido por variables de entorno. */
export async function proveedoresActivos(): Promise<ConfigProveedor[]> {
  const entorno = proveedorDesdeEntorno();
  if (!hayBaseDeDatos()) return entorno ? [entorno] : [];
  const { data, error } = await clienteSupabaseAdmin().from("ai_providers").select(COLUMNAS).eq("activo", true).order("prioridad");
  if (error) return entorno ? [entorno] : [];
  const deBase = (data as FilaProveedor[]).map(deFila);
  return deBase.length ? deBase : entorno ? [entorno] : [];
}

const registroSupabase: RegistroConsumo = {
  async registrar(r: RegistroUso) {
    await clienteSupabaseAdmin().from("ai_usage").insert({
      provider_id: r.proveedorId,
      modelo: r.modelo,
      user_id: r.usuarioId ?? null,
      tokens_entrada: r.tokensEntrada ?? null,
      tokens_salida: r.tokensSalida ?? null,
      costo_estimado_usd: r.costoEstimadoUsd ?? null,
      codigo_resultado: r.codigoResultado,
      intento: r.intento,
      latencia_ms: r.latenciaMs,
      origen: r.origen,
    });
  },
  async uso(proveedorId) {
    const { data } = await clienteSupabaseAdmin().rpc("ai_uso_actual", { p_provider: proveedorId });
    const fila = (data as { ultimo_minuto: number; hoy: number; gasto_mes_usd: number | string }[] | null)?.[0];
    return { ultimoMinuto: fila?.ultimo_minuto ?? 0, hoy: fila?.hoy ?? 0, gastoMesUsd: Number(fila?.gasto_mes_usd ?? 0) };
  },
};

export function registroDe(p: ConfigProveedor): RegistroConsumo {
  return p.origen === "base-de-datos" && hayBaseDeDatos() ? registroSupabase : memoria;
}

export const dependenciasServidor = () => ({
  proveedoresActivos,
  registroDe,
  llaveDe: (p: ConfigProveedor) => llaveDe(p),
  origenSitio: leerConfigSupabase().urlSitio,
});

// ------------------------------------------------------------ administración (pasa por RLS)

export interface ProveedorAdmin {
  config: ConfigProveedor;
  tieneLlave: boolean;
}

export async function listarProveedoresAdmin(): Promise<ProveedorAdmin[]> {
  const supabase = await clienteSupabaseServidor();
  const { data } = await supabase.from("ai_providers").select(COLUMNAS).order("prioridad");
  return ((data ?? []) as FilaProveedor[]).map(deFila).map((config) => ({ config, tieneLlave: Boolean(llaveDe(config)) }));
}

export async function guardarProveedor(p: ConfigProveedor, esNuevo: boolean): Promise<{ error?: string }> {
  const supabase = await clienteSupabaseServidor();
  const fila = aFila(p);
  const { error } = esNuevo
    ? await supabase.from("ai_providers").insert(fila)
    : await supabase.from("ai_providers").update(fila).eq("id", p.id);
  if (!error) return {};
  if (error.code === "23505") return { error: "Ya existe un proveedor con ese identificador." };
  if (error.code === "23514") return { error: "La base de datos rechazó la configuración (revisa el secreto, el endpoint y la política de datos)." };
  if (error.code === "42501") return { error: "No tienes permiso para administrar proveedores." };
  return { error: "No se pudo guardar el proveedor." };
}

export async function borrarProveedor(id: string): Promise<boolean> {
  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase.from("ai_providers").delete().eq("id", id);
  return !error;
}

/** Consumo del mes en curso (máximo 1000 filas) para la administración. */
export async function consumoDelMes(): Promise<ResumenConsumo> {
  const supabase = await clienteSupabaseServidor();
  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("ai_usage")
    .select("created_at, provider_id, modelo, codigo_resultado, intento, latencia_ms, tokens_entrada, tokens_salida, costo_estimado_usd, origen")
    .gte("created_at", inicioMes.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);
  const filas: FilaConsumo[] = (data ?? []).map((f) => ({
    fecha: f.created_at,
    proveedorId: f.provider_id,
    modelo: f.modelo,
    codigo: f.codigo_resultado,
    intento: f.intento,
    latenciaMs: f.latencia_ms,
    tokensEntrada: f.tokens_entrada,
    tokensSalida: f.tokens_salida,
    costoUsd: f.costo_estimado_usd === null ? null : Number(f.costo_estimado_usd),
    origen: f.origen,
  }));
  return { recientes: filas.slice(0, 50), porProveedor: resumirConsumo(filas) };
}

export type { FilaConsumo, ResumenConsumo };
