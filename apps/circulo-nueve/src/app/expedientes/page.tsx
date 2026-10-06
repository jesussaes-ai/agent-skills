import type { Metadata } from "next";
import { exigirSesion } from "@/modulos/auth/sesion";
import { listarExpedientes } from "@/modulos/expedientes/consultas";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Etiqueta, Seccion } from "@/ui/componentes/Seccion";
import { FormularioNuevoExpediente } from "@/ui/expedientes/Formularios";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Expedientes · Círculo Nueve" };

export default async function PaginaExpedientes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sesion = await exigirSesion("/expedientes");
  const expedientes = sesion.acceso.activo ? await listarExpedientes(sesion) : [];
  const puedeCrear = sesion.acceso.permisos.includes("cargar");
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Expedientes</h1>
      {params.borrado && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Expediente borrado junto con sus archivos.
        </p>
      )}
      <Seccion titulo="Expedientes a los que tienes acceso" ayuda="expedientes">
        {expedientes.length ? (
          <ul className="divide-y divide-slate-200">
            {expedientes.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <EnlaceBoton href={`/expedientes/${e.id}`} className="px-0" descripcion={`Abre el expediente «${e.etiqueta}».`}>
                    {e.etiqueta}
                  </EnlaceBoton>
                  {e.esDemo && <Etiqueta tono="ambar">Datos ficticios</Etiqueta>}
                  {e.esPropio ? <Etiqueta>Creado por ti</Etiqueta> : e.esCliente ? <Etiqueta>Tu expediente</Etiqueta> : <Etiqueta tono="gris">Asignado</Etiqueta>}
                </div>
                <span className="text-xs text-slate-500">{new Date(e.creado).toLocaleDateString("es-MX")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-600">No tienes expedientes todavía.</p>
        )}
      </Seccion>
      {puedeCrear && (
        <Seccion titulo="Nuevo expediente" ayuda="expedientes">
          <FormularioNuevoExpediente />
        </Seccion>
      )}
    </div>
  );
}
