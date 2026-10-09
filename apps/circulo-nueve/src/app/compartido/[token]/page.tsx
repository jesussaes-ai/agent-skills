import type { Metadata } from "next";
import { headers } from "next/headers";
import { leerConfigSupabase } from "@/modulos/auth/config";
import { usarEnlace, type ResultadoEnlace } from "@/modulos/compartir/consultas";
import { consumirLimite, ipDe, ipRecortada, mensajeEspera } from "@/modulos/seguridad/limite-frecuencia";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Seccion } from "@/ui/componentes/Seccion";
import { EstadoVacio } from "@/ui/componentes/EstadoVacio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Documento compartido · Círculo Nueve",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" });

function NoDisponible({ mensaje }: { mensaje: string }) {
  return (
    <div className="mx-auto max-w-lg">
      <Seccion titulo="Este enlace ya no está disponible" ayuda="compartido">
        <p className="mb-3 text-slate-700" data-testid="enlace-no-disponible">
          {mensaje}
        </p>
        <p className="text-sm text-slate-700">
          Si necesitas el documento, pide un enlace nuevo a la persona que te lo compartió. Los enlaces vencen y se pueden revocar para
          proteger la información.
        </p>
      </Seccion>
    </div>
  );
}

export default async function PaginaCompartido({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!leerConfigSupabase().configurado) {
    return <NoDisponible mensaje="Esta instalación funciona en modo demo y no tiene documentos compartidos." />;
  }
  const ip = ipDe(await headers());
  const limite = await consumirLimite("enlacePublico", ip);
  if (!limite.permitido) return <NoDisponible mensaje={mensajeEspera(limite.reintentarEnSegundos)} />;

  const resultado: ResultadoEnlace = await usarEnlace(token, null, ipRecortada(ip));
  if (resultado.estado !== "ok") {
    return <NoDisponible mensaje="El enlace venció, se revocó o no existe." />;
  }

  const restantes = resultado.maxAccesos === null ? null : Math.max(0, resultado.maxAccesos - resultado.accesos);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Documento compartido</h1>
        <p className="mt-2 text-slate-700">
          Alguien del equipo de Círculo Nueve compartió contigo {resultado.alcance === "documento" ? "un reporte en PDF" : "los reportes en PDF de un expediente"}.
          Las lecturas son interpretaciones simbólicas para la reflexión personal, no consejos profesionales.
        </p>
      </div>
      <Seccion titulo={resultado.alcance === "documento" ? "Reporte" : "Reportes del expediente"} ayuda="compartido">
        <p className="mb-4 text-sm text-slate-700" data-testid="vigencia-enlace">
          Disponible hasta el {fecha(resultado.vence)}
          {restantes !== null ? ` · descargas restantes: ${restantes}` : ""}
        </p>
        {resultado.nota && <p className="mb-4 rounded-lg bg-marino-50 p-3 text-sm text-slate-800">Nota: {resultado.nota}</p>}
        {resultado.documentos.length ? (
          <ul className="divide-y divide-slate-200">
            {resultado.documentos.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid="documento-compartido">
                <div>
                  <p className="font-medium text-slate-900">{d.nombre}</p>
                  <p className="text-xs text-slate-600">
                    {new Date(d.creado).toLocaleDateString("es-MX")}
                    {d.tamano ? ` · ${Math.round(d.tamano / 1024)} KB` : ""}
                  </p>
                </div>
                {restantes === 0 ? (
                  <span className="text-sm text-slate-700">Sin descargas disponibles</span>
                ) : (
                  <EnlaceBoton
                    href={`/compartido/${token}/${d.id}`}
                    prefetch={false}
                    descripcion="Descarga el PDF con un enlace temporal que caduca en segundos. La descarga queda registrada."
                  >
                    Descargar PDF
                  </EnlaceBoton>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EstadoVacio titulo="Todavía no hay reportes">Cuando se genere un PDF en este expediente aparecerá aquí mientras el enlace siga vigente.</EstadoVacio>
        )}
      </Seccion>
    </div>
  );
}
