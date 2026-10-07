/**
 * Cuentas por nombre de usuario. Supabase Auth exige un correo, así que cada
 * cuenta usa uno interno derivado del usuario en el dominio reservado `.invalid`
 * (RFC 2606): nunca se entrega y no se muestra en la interfaz.
 */
export const DOMINIO_INTERNO = "usuarios.circulo-nueve.invalid";
export const PATRON_USUARIO = /^[a-z][a-z0-9._-]{2,31}$/;

export function normalizarUsuario(usuario: string): string {
  return usuario.trim().toLowerCase();
}

export function correoInterno(usuario: string): string {
  return `${normalizarUsuario(usuario)}@${DOMINIO_INTERNO}`;
}

export function esCorreoInterno(correo: string | null | undefined): boolean {
  return Boolean(correo?.toLowerCase().endsWith(`@${DOMINIO_INTERNO}`));
}

/** Contraseña inicial legible para entregar en persona: 4 grupos sin caracteres ambiguos y con dígitos. */
export function generarContrasenaInicial(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const digitos = "23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const grupo = (desde: number) =>
    Array.from({ length: 3 }, (_, i) => letras[bytes[desde + i] % letras.length]).join("") + digitos[bytes[desde + 3] % digitos.length];
  return [0, 4, 8, 12].map(grupo).join("-");
}
