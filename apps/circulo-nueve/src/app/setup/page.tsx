import type { Metadata } from "next";
import { leerConfigSupabase, tieneLlaveServicio } from "@/modulos/auth/config";
import { FormularioAlta } from "@/ui/auth/Formularios";
import { AvisoSinSupabase } from "@/ui/auth/AvisoSinSupabase";
import { Seccion } from "@/ui/componentes/Seccion";

export const metadata: Metadata = { title: "Alta inicial · Círculo Nueve", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function PaginaAlta() {
  const listo = leerConfigSupabase().configurado && tieneLlaveServicio() && Boolean(process.env.ADMIN_SETUP_KEY_HASH);
  return (
    <div className="mx-auto max-w-lg">
      <Seccion titulo="Alta inicial de la administración" ayuda="alta-inicial">
        {!leerConfigSupabase().configurado ? (
          <AvisoSinSupabase />
        ) : !listo ? (
          <p role="note" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
            Falta configurar en el servidor la llave de servicio de Supabase o el hash de la clave de alta
            (ADMIN_SETUP_KEY_HASH). Consulta el README.
          </p>
        ) : (
          <FormularioAlta />
        )}
      </Seccion>
    </div>
  );
}
