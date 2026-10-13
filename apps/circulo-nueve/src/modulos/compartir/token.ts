import { createHash, randomBytes } from "node:crypto";

/** 32 bytes aleatorios en base64url: 43 caracteres, imposibles de adivinar. */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function generarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

/** En la base solo se guarda este hash; el token completo se muestra una sola vez. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function esTokenValido(token: string): boolean {
  return FORMATO_TOKEN.test(token);
}
