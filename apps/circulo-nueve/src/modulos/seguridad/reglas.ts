import { createHash } from "node:crypto";

/** Límites de frecuencia por tipo de petición: máximo de intentos por ventana. */
export const REGLAS_FRECUENCIA = {
  alta: { maximo: 5, ventanaSegundos: 15 * 60 },
  entrar: { maximo: 10, ventanaSegundos: 15 * 60 },
  recuperar: { maximo: 5, ventanaSegundos: 60 * 60 },
  mfa: { maximo: 10, ventanaSegundos: 15 * 60 },
  cambiarContrasena: { maximo: 10, ventanaSegundos: 15 * 60 },
  crearCuenta: { maximo: 30, ventanaSegundos: 60 * 60 },
  descargarDocumento: { maximo: 60, ventanaSegundos: 10 * 60 },
  exportar: { maximo: 20, ventanaSegundos: 10 * 60 },
  generarPdf: { maximo: 30, ventanaSegundos: 10 * 60 },
  crearEnlace: { maximo: 30, ventanaSegundos: 60 * 60 },
  enlacePublico: { maximo: 60, ventanaSegundos: 10 * 60 },
  asistente: { maximo: 10, ventanaSegundos: 60 },
  biblioteca: { maximo: 20, ventanaSegundos: 60 },
} as const satisfies Record<string, { maximo: number; ventanaSegundos: number }>;

export type ReglaFrecuencia = keyof typeof REGLAS_FRECUENCIA;

/** La clave guardada es un hash: la tabla de límites nunca contiene IP ni usuario. */
export function claveLimite(regla: ReglaFrecuencia, identificador: string): string {
  return createHash("sha256").update(`${regla}|${identificador}`).digest("hex");
}

export function mensajeEspera(segundos: number): string {
  if (segundos < 90) {
    const s = Math.max(1, Math.ceil(segundos));
    return `Demasiados intentos. Vuelve a intentarlo en ${s} segundo${s === 1 ? "" : "s"}.`;
  }
  const minutos = Math.ceil(segundos / 60);
  return `Demasiados intentos. Vuelve a intentarlo en ${minutos} minutos.`;
}

/** IP de quien hace la petición (la primera de x-forwarded-for, que fija el proveedor de hosting). */
export function ipDe(cabeceras: Headers): string {
  return cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() || cabeceras.get("x-real-ip")?.trim() || "local";
}

/** IP recortada para la auditoría: /24 en IPv4 y /48 en IPv6. */
export function ipRecortada(ip: string): string | null {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return `${ip.split(".").slice(0, 3).join(".")}.0/24`;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::/48`;
  return null;
}
