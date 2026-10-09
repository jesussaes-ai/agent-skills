import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { leerConfigSupabase, origenPublico, rutaInternaSegura } from "@/modulos/auth/config";
import { clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";

const TIPOS: EmailOtpType[] = ["invite", "recovery", "email", "email_change"];

/** Destino de los enlaces de invitación y recuperación (token_hash de un solo uso). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const destino = rutaInternaSegura(url.searchParams.get("next"), "/cuenta/contrasena");
  const origen = origenPublico(request.headers);
  const error = new URL("/entrar?error=enlace", origen);

  if (!leerConfigSupabase().configurado || !tokenHash || !tipo || !TIPOS.includes(tipo)) {
    return NextResponse.redirect(error);
  }
  const supabase = await clienteSupabaseServidor();
  const { error: fallo } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
  return NextResponse.redirect(fallo ? error : new URL(destino, origen));
}
