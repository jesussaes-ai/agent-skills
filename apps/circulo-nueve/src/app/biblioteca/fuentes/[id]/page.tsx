import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirPermiso } from "@/modulos/auth/sesion";
import { clienteSupabaseAdmin, clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { formatearLocalizador } from "@/modulos/biblioteca/respuesta";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Etiqueta, Seccion } from "@/ui/componentes/Seccion";
import { ActualizarFuente, BotonFragmento, CorreccionFigura, DecisionVersion, FormularioEditarFuente, RetirarFuente } from "@/ui/biblioteca/Formularios";
import { NOMBRE_ESTADO } from "@/modulos/biblioteca/estados";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fuente · Biblioteca · Círculo Nueve" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function PaginaFuente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirPermiso(`/biblioteca/fuentes/${id}`, "admin_fuentes");
  if (!UUID.test(id) || !sesion.acceso.permisos.includes("admin_fuentes")) notFound();
  const supabase = await clienteSupabaseServidor();
  const { data: f } = await supabase.from("sources").select("*").eq("id", id).maybeSingle();
  if (!f) notFound();

  const [{ data: versiones }, { data: trabajos }] = await Promise.all([
    supabase.from("source_versions").select("*").eq("source_id", id).order("ingestado_at", { ascending: false }),
    supabase.from("ingestion_jobs").select("id, etapa, estado, errores, created_at, nombre_archivo").eq("source_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const vigente = (versiones ?? []).find((v) => v.es_vigente);
  const nueva = (versiones ?? []).find((v) => !v.es_vigente);
  const enRevision = f.estado === "requiere_revision" ? nueva : undefined;
  const aprobadaPendiente = f.estado === "procesando" ? nueva : undefined;
  const mostrada = enRevision ?? aprobadaPendiente ?? vigente ?? nueva;
  const { data: fragmentos } = mostrada
    ? await supabase.from("chunks").select("id, orden, texto, localizador, jerarquia, excluido, sospechoso, motivo_sospecha, ocr_confianza").eq("source_version_id", mostrada.id).order("orden")
    : { data: [] };
  const { data: figuras } = mostrada
    ? await supabase
        .from("visual_assets")
        .select("id, pagina, leyenda, ocr, descripcion_generada, descripcion_modelo, descripcion_fecha, correccion_admin")
        .eq("source_version_id", mostrada.id)
        .order("storage_path")
    : { data: [] };
  let vistaMarkdown = "";
  if (mostrada?.markdown_path) {
    const { data } = await clienteSupabaseAdmin().storage.from("biblioteca-derivados").download(mostrada.markdown_path);
    vistaMarkdown = data ? (await data.text()).slice(0, 6000) : "";
  }

  return (
    <div className="space-y-6">
      <EnlaceBoton href="/biblioteca" className="px-0" descripcion="Vuelve al catálogo de la biblioteca.">
        ← Biblioteca
      </EnlaceBoton>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{f.titulo}</h1>
        <span data-testid="estado-fuente">
          <Etiqueta tono={f.estado === "indexado" ? "violeta" : "gris"}>{NOMBRE_ESTADO[f.estado] ?? f.estado}</Etiqueta>
        </span>
        {f.es_demo && <Etiqueta tono="ambar">DEMO</Etiqueta>}
      </div>
      {f.motivo_fallo && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{f.motivo_fallo}</p>}
      {aprobadaPendiente && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Versión aprobada: pendiente de calcular los vectores e indexar (lo hace el worker o «Procesar pendientes ahora»).
        </p>
      )}

      {mostrada && (
        <Seccion titulo={enRevision ? "Revisión de la versión nueva" : aprobadaPendiente ? "Versión aprobada (pendiente de indexar)" : "Versión vigente"} ayuda="biblioteca-revision">
          <dl className="mb-4 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="font-medium">Método</dt>
            <dd>{mostrada.metodo_extraccion}</dd>
            <dt className="font-medium">SHA-256</dt>
            <dd className="break-all font-mono text-xs">{mostrada.sha256}</dd>
            <dt className="font-medium">Fragmentos</dt>
            <dd>{mostrada.num_fragmentos}</dd>
            {f.url && (
              <>
                <dt className="font-medium">URL canónica</dt>
                <dd className="break-all">{f.url}</dd>
              </>
            )}
          </dl>
          {(mostrada.advertencias as string[]).length > 0 && (
            <ul className="mb-4 list-disc rounded-lg bg-amber-50 py-2 pl-8 pr-3 text-sm text-amber-950">
              {(mostrada.advertencias as string[]).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          {mostrada.diff_resumen && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Cambios respecto a la versión anterior</h3>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs" data-testid="diff">{mostrada.diff_resumen}</pre>
            </div>
          )}
          <h3 className="mb-2 font-semibold text-slate-900">Markdown extraído</h3>
          <pre className="mb-4 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs" data-testid="markdown">{vistaMarkdown || "—"}</pre>
          {(figuras ?? []).length > 0 && (
            <>
              <h3 className="mb-2 font-semibold text-slate-900">Figuras</h3>
              <ul className="mb-4 grid gap-4 sm:grid-cols-2">
                {(figuras ?? []).map((g) => (
                  <li key={g.id} className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm" data-testid="figura">
                    <img src={`/biblioteca/figuras/${g.id}`} alt={g.leyenda ?? `Figura de la página ${g.pagina}`} className="max-h-48 w-full rounded bg-slate-50 object-contain" />
                    <p>
                      <span className="font-medium">Página {g.pagina}.</span> {g.leyenda ?? "Sin leyenda detectada."}
                    </p>
                    {g.ocr && <p className="text-xs text-slate-600">OCR: {g.ocr}</p>}
                    <p className="text-xs">
                      <Etiqueta tono="ambar">Descripción generada</Etiqueta> {g.descripcion_generada}
                      <span className="block text-slate-500">
                        Método: {g.descripcion_modelo} · {g.descripcion_fecha ? new Date(g.descripcion_fecha).toLocaleString("es-MX") : ""}
                      </span>
                    </p>
                    <CorreccionFigura fuenteId={id} figuraId={g.id} correccion={g.correccion_admin} />
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="mb-2 font-semibold text-slate-900">Fragmentos</h3>
          <ol className="mb-4 space-y-2">
            {(fragmentos ?? []).map((c) => (
              <li key={c.id} className={`rounded-lg border p-3 text-sm ${c.excluido ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-200"}`} data-testid="fragmento">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium">#{c.orden + 1}</span>
                  <span className="text-xs text-slate-600">{formatearLocalizador(c.localizador) || "sin localizador"}</span>
                  {c.jerarquia?.length > 0 && <span className="text-xs text-slate-500">{c.jerarquia.join(" › ")}</span>}
                  {c.sospechoso && <Etiqueta tono="ambar">Posible instrucción incrustada: {c.motivo_sospecha}</Etiqueta>}
                  {c.ocr_confianza !== null && c.ocr_confianza < 0.7 && <Etiqueta tono="ambar">OCR con baja confianza</Etiqueta>}
                  {c.excluido && <Etiqueta tono="gris">Excluido</Etiqueta>}
                  {enRevision && <BotonFragmento fuenteId={id} fragmentoId={c.id} excluido={c.excluido} />}
                </div>
                <p className="whitespace-pre-wrap">{c.texto.length > 600 ? `${c.texto.slice(0, 600)}…` : c.texto}</p>
              </li>
            ))}
          </ol>
          {enRevision && <DecisionVersion fuenteId={id} versionId={enRevision.id} />}
        </Seccion>
      )}

      <Seccion titulo="Metadatos y derechos" ayuda="biblioteca-carga">
        <FormularioEditarFuente
          fuenteId={id}
          valores={{
            titulo: f.titulo,
            autor: f.autor,
            referencia: f.referencia,
            edicion: f.edicion,
            idioma: f.idioma,
            tradicion: f.tradicion,
            grupo: f.grupo,
            licencia: f.licencia,
            notasDerechos: f.notas_derechos,
            nivelAcceso: f.nivel_acceso,
            esDemo: f.es_demo,
          }}
        />
      </Seccion>

      <Seccion titulo="Versiones y trabajos" ayuda="biblioteca-revision">
        <ul className="mb-4 space-y-1 text-sm">
          {(versiones ?? []).map((v) => (
            <li key={v.id}>
              {new Date(v.ingestado_at).toLocaleString("es-MX")} · {v.num_fragmentos} fragmentos · {v.es_vigente ? <Etiqueta>Vigente</Etiqueta> : <Etiqueta tono="gris">No vigente</Etiqueta>}
            </li>
          ))}
        </ul>
        <ul className="mb-4 space-y-1 text-xs text-slate-600">
          {(trabajos ?? []).map((t) => (
            <li key={t.id}>
              {new Date(t.created_at).toLocaleString("es-MX")} · {t.etapa} · {NOMBRE_ESTADO[t.estado] ?? t.estado}
              {(t.errores as string[])?.length ? ` · ${(t.errores as string[]).join(" ")}` : ""}
            </li>
          ))}
        </ul>
        {f.estado !== "retirado" && <ActualizarFuente fuenteId={id} origen={f.origen} />}
      </Seccion>

      {f.estado !== "retirado" && (
        <Seccion titulo="Retirar la fuente" ayuda="biblioteca-revision">
          <RetirarFuente fuenteId={id} />
        </Seccion>
      )}
    </div>
  );
}
