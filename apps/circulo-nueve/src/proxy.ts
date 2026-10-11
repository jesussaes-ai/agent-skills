import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { leerConfigSupabase, origenPublico } from "@/modulos/auth/config";
import { nuevoNonce, politicaCsp } from "@/modulos/seguridad/csp";

const PROTEGIDAS = ["/cuenta", "/admin", "/expedientes", "/biblioteca"];

async function altaCompletada(url: string): Promise<boolean> {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!llave) return false;
  const admin = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await admin.from("app_setup").select("completed_at").single();
  return Boolean(data?.completed_at);
}

/** Fija la CSP con nonce, refresca la sesión de Supabase y cierra /setup tras el alta. */
export async function proxy(request: NextRequest) {
  const config = leerConfigSupabase();
  const csp = politicaCsp(nuevoNonce(), {
    supabaseUrl: config.configurado ? config.url : undefined,
    desarrollo: process.env.NODE_ENV === "development",
  });
  request.headers.set("content-security-policy", csp);
  const conCsp = (respuesta: NextResponse) => {
    respuesta.headers.set("content-security-policy", csp);
    return respuesta;
  };
  if (!config.configurado) return conCsp(NextResponse.next({ request }));

  const { pathname } = request.nextUrl;
  if (pathname === "/setup" && (await altaCompletada(config.url))) {
    return conCsp(
      new NextResponse("El alta inicial ya se completó. Esta página ya no está disponible.", {
        status: 410,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      }),
    );
  }

  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.clavePublica, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (porGuardar) => {
        for (const { name, value } of porGuardar) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of porGuardar) respuesta.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  if (!data.user && PROTEGIDAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return conCsp(NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(pathname)}`, origenPublico(request.headers))));
  }
  return conCsp(respuesta);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|iconos/|datos/).*)"],
};
