export interface ConfigSupabase {
  configurado: boolean;
  url: string;
  clavePublica: string;
  urlSitio: string;
}

/**
 * Configuración pública de Supabase. Si falta, la app sigue en modo demo y las
 * páginas de cuentas lo explican en lugar de fallar.
 */
export function leerConfigSupabase(env: Record<string, string | undefined> = process.env): ConfigSupabase {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const clavePublica = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const urlSitio = (env.NEXT_PUBLIC_SITE_URL?.trim() || "http://127.0.0.1:3000").replace(/\/+$/, "");
  return { configurado: Boolean(url && clavePublica), url, clavePublica, urlSitio };
}

/** Solo servidor. Indica si existe la llave de servicio sin exponerla. */
export function tieneLlaveServicio(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** Evita redirecciones abiertas: solo rutas internas. */
export function rutaInternaSegura(ruta: string | null | undefined, porDefecto = "/cuenta"): string {
  if (!ruta || !ruta.startsWith("/") || ruta.startsWith("//") || ruta.includes("\\")) return porDefecto;
  return ruta;
}

/**
 * Origen público para construir redirecciones absolutas. `request.nextUrl` puede
 * traer el host interno del servidor (p. ej. localhost), distinto del que usa el
 * navegador, y entonces la cookie de sesión no viajaría.
 */
export function origenPublico(cabeceras: Headers, env: Record<string, string | undefined> = process.env): string {
  const configurado = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configurado) return configurado.replace(/\/+$/, "");
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "127.0.0.1:3000";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocolo}://${host}`;
}
