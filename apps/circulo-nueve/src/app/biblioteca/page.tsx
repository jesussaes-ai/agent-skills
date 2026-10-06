import type { Metadata } from "next";
import { exigirAdmin } from "@/modulos/auth/sesion";
import { clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Etiqueta, Seccion } from "@/ui/componentes/Seccion";
import { BotonProcesar, FormularioCarga, FormularioWeb } from "@/ui/biblioteca/Formularios";
import { NOMBRE_ESTADO } from "@/modulos/biblioteca/estados";
import { leerConfigSupabase } from "@/modulos/auth/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Biblioteca · Círculo Nueve" };

export default async function PaginaBiblioteca({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sesion = await exigirAdmin("/biblioteca");
  if (!sesion.acceso.permisos.includes("admin_fuentes")) return null;
  const supabase = await clienteSupabaseServidor();
  const [{ data: fuentes }, { count: pendientes }] = await Promise.all([
    supabase.from("sources").select("id, titulo, grupo, origen, formato, estado, es_demo, motivo_fallo, updated_at").order("updated_at", { ascending: false }),
    supabase.from("ingestion_jobs").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
  ]);
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Biblioteca de fuentes</h1>
        <EnlaceBoton href="/biblioteca/preguntar" descripcion="Abre el bot de la biblioteca para hacer preguntas con citas.">
          Preguntar a la biblioteca
        </EnlaceBoton>
      </div>
      {params.retirada && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Fuente retirada: se borraron sus archivos, fragmentos y vectores.
        </p>
      )}
      <Seccion titulo="Fuentes" ayuda="biblioteca">
        {fuentes?.length ? (
          <ul className="divide-y divide-slate-200">
            {fuentes.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid={`fuente-${f.titulo}`}>
                <div className="space-y-1">
                  <EnlaceBoton href={`/biblioteca/fuentes/${f.id}`} className="px-0" descripcion={`Abre la ficha y la revisión de «${f.titulo}».`}>
                    {f.titulo}
                  </EnlaceBoton>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Etiqueta tono={f.grupo === "aportada" ? "violeta" : "gris"}>{f.grupo === "aportada" ? "Aportada" : "Complementaria"}</Etiqueta>
                    <Etiqueta tono="gris">{f.origen === "web" ? "Web" : (f.formato ?? "archivo").toUpperCase()}</Etiqueta>
                    {f.es_demo && <Etiqueta tono="ambar">DEMO</Etiqueta>}
                  </div>
                  {f.estado === "fallido" && f.motivo_fallo && <p className="text-xs text-red-800">{f.motivo_fallo}</p>}
                </div>
                <span data-testid="estado-fuente">
                  <Etiqueta tono={f.estado === "indexado" ? "violeta" : f.estado === "fallido" ? "ambar" : "gris"}>{NOMBRE_ESTADO[f.estado] ?? f.estado}</Etiqueta>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-600">Todavía no hay fuentes. Carga un archivo o añade una página web.</p>
        )}
      </Seccion>
      <Seccion titulo="Procesar la cola de ingesta" ayuda="biblioteca">
        <BotonProcesar pendientes={pendientes ?? 0} />
      </Seccion>
      <Seccion titulo="Centro de carga" ayuda="biblioteca-carga">
        <FormularioCarga supabaseUrl={leerConfigSupabase().url} clavePublica={leerConfigSupabase().clavePublica} />
      </Seccion>
      <Seccion titulo="Añadir una página web" ayuda="biblioteca-web">
        <FormularioWeb />
      </Seccion>
    </div>
  );
}
