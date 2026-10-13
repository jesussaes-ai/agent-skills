import { hash, verify } from "@node-rs/argon2";

/** Parámetros argon2id (recomendación OWASP: m ≥ 19 MiB, t ≥ 2, p = 1). */
const OPCIONES = { algorithm: 2 as const, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const LONGITUD_MINIMA_CLAVE = 20;

export async function generarHashClaveAlta(clave: string): Promise<string> {
  if (clave.length < LONGITUD_MINIMA_CLAVE) {
    throw new Error(`La clave de alta debe tener al menos ${LONGITUD_MINIMA_CLAVE} caracteres.`);
  }
  return hash(clave, OPCIONES);
}

/**
 * Compara la clave con el hash guardado en ADMIN_SETUP_KEY_HASH. argon2 compara en
 * tiempo constante. Nunca devuelve ni registra la clave.
 */
export async function verificarClaveAlta(clave: string, hashGuardado: string | undefined): Promise<boolean> {
  if (!hashGuardado?.startsWith("$argon2id$") || !clave) return false;
  try {
    return await verify(hashGuardado, clave);
  } catch {
    return false;
  }
}
