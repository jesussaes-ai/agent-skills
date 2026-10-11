/**
 * Content-Security-Policy estricta con nonce por petición (la genera proxy.ts).
 * Los estilos admiten 'unsafe-inline' porque React escribe atributos style y una
 * CSP con nonce no cubre atributos; los scripts solo corren con el nonce.
 * Supabase se permite para la subida directa a Storage desde el navegador.
 */
export function nuevoNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export function politicaCsp(nonce: string, opciones: { supabaseUrl?: string; desarrollo?: boolean } = {}): string {
  let supabase = "";
  try {
    if (opciones.supabaseUrl) supabase = new URL(opciones.supabaseUrl).origin;
  } catch {
    supabase = "";
  }
  const directivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(opciones.desarrollo ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", ...(supabase ? [supabase] : [])],
    "media-src": ["'self'", "blob:", "data:", ...(supabase ? [supabase] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(supabase ? [supabase] : [])],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const texto = Object.entries(directivas).map(([nombre, valores]) => `${nombre} ${valores.join(" ")}`);
  if (!opciones.desarrollo) texto.push("upgrade-insecure-requests");
  return texto.join("; ");
}
