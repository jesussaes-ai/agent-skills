import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { crearLimiteIntentos, type LimiteIntentos } from "@/modulos/auth/limite-intentos";
import { leerConfigSupabase, tieneLlaveServicio } from "@/modulos/auth/config";
import { clienteSupabaseAdmin } from "@/modulos/auth/supabase-servidor";
import { REGLAS_FRECUENCIA, claveLimite, ipDe, type ReglaFrecuencia } from "./reglas";

export { REGLAS_FRECUENCIA, ipDe, ipRecortada, mensajeEspera } from "./reglas";
export type { ReglaFrecuencia } from "./reglas";

const enMemoria = new Map<ReglaFrecuencia, LimiteIntentos>();

function respaldo(regla: ReglaFrecuencia): LimiteIntentos {
  let limite = enMemoria.get(regla);
  if (!limite) {
    const { maximo, ventanaSegundos } = REGLAS_FRECUENCIA[regla];
    limite = crearLimiteIntentos(maximo, ventanaSegundos * 1000);
    enMemoria.set(regla, limite);
  }
  return limite;
}

export interface ResultadoLimite {
  permitido: boolean;
  reintentarEnSegundos: number;
}

/**
 * Cuenta un intento (con `contar: false` solo consulta si aún hay margen). Con
 * Supabase usa una tabla compartida por todas las instancias (la clave es un
 * SHA-256, sin IP ni usuario en claro); si la base no responde, aplica el
 * límite en memoria de esta instancia.
 */
export async function consumirLimite(regla: ReglaFrecuencia, identificador: string, { contar = true } = {}): Promise<ResultadoLimite> {
  const { maximo, ventanaSegundos } = REGLAS_FRECUENCIA[regla];
  if (leerConfigSupabase().configurado && tieneLlaveServicio()) {
    const { data, error } = await clienteSupabaseAdmin().rpc("consumir_limite", {
      p_clave: claveLimite(regla, identificador),
      p_maximo: maximo,
      p_ventana_segundos: ventanaSegundos,
      p_cantidad: contar ? 1 : 0,
    });
    if (!error && typeof data === "number") return { permitido: data === 0, reintentarEnSegundos: data };
  }
  const clave = createHash("sha256").update(identificador).digest("hex");
  const r = contar ? respaldo(regla).registrar(clave) : respaldo(regla).consultar(clave);
  return { permitido: r.permitido, reintentarEnSegundos: Math.ceil(r.reintentarEnMs / 1000) };
}

export async function ipCliente(): Promise<string> {
  return ipDe(await headers());
}
