import type { Metadata } from "next";
import { exigirAdmin } from "@/modulos/auth/sesion";
import { FECHA_VERIFICACION, FUENTES_OPENROUTER } from "@/modulos/proveedores/catalogo";
import { proveedorDesdeEntorno } from "@/modulos/proveedores/config";
import { consumoDelMes, hayBaseDeDatos, listarProveedoresAdmin } from "@/modulos/proveedores/repositorio";
import { Seccion } from "@/ui/componentes/Seccion";
import { ListaProveedores } from "@/ui/proveedores/AdminProveedores";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proveedores de IA · Círculo Nueve" };

const usd = (n: number) => `${n.toLocaleString("es-MX", { maximumFractionDigits: 6 })} USD`;

export default async function PaginaProveedores() {
  await exigirAdmin("/admin/proveedores");
  const [proveedores, consumo] = await Promise.all([listarProveedoresAdmin(), consumoDelMes()]);
  const entorno = proveedorDesdeEntorno();
  const nombres = new Map(proveedores.map((p) => [p.config.id, p.config.nombre]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Proveedores de inteligencia artificial</h1>
      <p role="note" className="rounded-xl border border-marino-200 bg-marino-50 p-4 text-sm text-slate-800">
        Catálogo verificado el {FECHA_VERIFICACION} con la{" "}
        <span className="font-mono">{FUENTES_OPENROUTER.modelos}</span> y la documentación de privacidad de OpenRouter. Ese día no había
        variantes gratuitas de Qwen ni de DeepSeek; las de NVIDIA eran gratuitas pero NVIDIA puede entrenar con los textos, así que quedan como
        «solo demo». Los modelos gratuitos cambian a menudo: revisa {FUENTES_OPENROUTER.gratuitos} antes de elegir.
        {!hayBaseDeDatos() && " Falta la llave de servicio de Supabase en el servidor: el asistente no puede leer esta configuración."}
      </p>

      <Seccion titulo="Proveedores configurados" ayuda="proveedores-ia">
        <ListaProveedores proveedores={proveedores} />
        {entorno && (
          <p className="mt-4 text-sm text-slate-600">
            Respaldo por variables de entorno: <span className="font-mono">{entorno.modelo}</span> en {entorno.nombre}. Solo se usa si no hay
            proveedores activos aquí.
          </p>
        )}
      </Seccion>

      <Seccion titulo="Consumo del mes" ayuda="proveedores-ia">
        <p className="mb-3 text-sm text-slate-600">
          Se registra cada intento: proveedor, modelo, resultado, tiempo, tokens y costo estimado. Nunca la pregunta ni la respuesta.
        </p>
        {consumo.porProveedor.length === 0 ? (
          <p className="text-slate-700">Sin solicitudes este mes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Resumen de consumo por proveedor</caption>
              <thead className="text-slate-600">
                <tr>
                  <th className="py-1 pr-3">Proveedor</th>
                  <th className="py-1 pr-3">Solicitudes</th>
                  <th className="py-1 pr-3">Errores</th>
                  <th className="py-1 pr-3">429</th>
                  <th className="py-1 pr-3">Tokens</th>
                  <th className="py-1 pr-3">Costo estimado</th>
                </tr>
              </thead>
              <tbody>
                {consumo.porProveedor.map((r) => (
                  <tr key={r.proveedorId} className="border-t border-slate-100">
                    <td className="py-1 pr-3">{nombres.get(r.proveedorId) ?? r.proveedorId}</td>
                    <td className="py-1 pr-3">{r.solicitudes}</td>
                    <td className="py-1 pr-3">{r.errores}</td>
                    <td className="py-1 pr-3">{r.limites429}</td>
                    <td className="py-1 pr-3">{r.tokens.toLocaleString("es-MX")}</td>
                    <td className="py-1 pr-3">{usd(r.costoUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="mb-2 mt-5 font-semibold text-slate-900">Últimos intentos</h3>
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Últimos 50 intentos</caption>
              <thead className="text-slate-600">
                <tr>
                  <th className="py-1 pr-3">Fecha (UTC)</th>
                  <th className="py-1 pr-3">Proveedor</th>
                  <th className="py-1 pr-3">Modelo</th>
                  <th className="py-1 pr-3">Resultado</th>
                  <th className="py-1 pr-3">Intento</th>
                  <th className="py-1 pr-3">ms</th>
                  <th className="py-1 pr-3">Origen</th>
                </tr>
              </thead>
              <tbody>
                {consumo.recientes.map((f, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1 pr-3">{f.fecha.slice(0, 19).replace("T", " ")}</td>
                    <td className="py-1 pr-3">{nombres.get(f.proveedorId) ?? f.proveedorId}</td>
                    <td className="py-1 pr-3 font-mono">{f.modelo}</td>
                    <td className="py-1 pr-3">{f.codigo}</td>
                    <td className="py-1 pr-3">{f.intento}</td>
                    <td className="py-1 pr-3">{f.latenciaMs ?? "—"}</td>
                    <td className="py-1 pr-3">{f.origen === "prueba-admin" ? "prueba" : "asistente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>
    </div>
  );
}
