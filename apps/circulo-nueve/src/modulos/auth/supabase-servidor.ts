import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { leerConfigSupabase } from "./config";

/** Cliente con la sesión de quien navega: todas sus consultas pasan por RLS. */
export async function clienteSupabaseServidor() {
  const config = leerConfigSupabase();
  if (!config.configurado) throw new Error("Supabase no está configurado.");
  const almacen = await cookies();
  return createServerClient(config.url, config.clavePublica, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (porGuardar) => {
        try {
          for (const { name, value, options } of porGuardar) almacen.set(name, value, options);
        } catch {
          // En Server Components no se pueden escribir cookies; el proxy refresca la sesión.
        }
      },
    },
  });
}

/**
 * Cliente con la llave de servicio (omite RLS). Solo para operaciones privilegiadas
 * cuya autorización ya se comprobó en el servidor: alta inicial, invitar, bloquear.
 */
export function clienteSupabaseAdmin() {
  const config = leerConfigSupabase();
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config.configurado || !llave) throw new Error("Falta la configuración de servidor de Supabase.");
  return createClient(config.url, llave, { auth: { persistSession: false, autoRefreshToken: false } });
}
