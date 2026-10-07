/**
 * Carga en la biblioteca documentos ficticios de demostración (marcados DEMO) y
 * los procesa e indexa con el worker, sin pasar por la interfaz.
 *
 *   npm run biblioteca:demo
 *
 * Solo para entornos de prueba o demostración. Requiere NEXT_PUBLIC_SUPABASE_URL
 * y SUPABASE_SERVICE_ROLE_KEY. No crea cuentas.
 */
import { randomUUID } from "node:crypto";
import { clienteServicio, procesarSiguiente } from "../src/modulos/biblioteca/ingesta.ts";
import { EXTENSIONES, detectarFormato } from "../src/modulos/biblioteca/formatos.ts";
import { CSV_DEMO, MD_DEMO, docxDemo, pdfConFiguraDemo, pptxDemo, xlsxDemo } from "../src/modulos/biblioteca/pruebas/documentos-demo.ts";

const db = clienteServicio();
const texto = (t: string) => new TextEncoder().encode(t);

const documentos: { titulo: string; nombre: string; bytes: Uint8Array; tradicion: string }[] = [
  { titulo: "Manual ficticio de numerología (DEMO)", nombre: "manual-demo.md", bytes: texto(MD_DEMO), tradicion: "Numerología" },
  { titulo: "Cuaderno ficticio con figura (DEMO)", nombre: "cuaderno-figura-demo.pdf", bytes: await pdfConFiguraDemo(), tradicion: "Numerología" },
  { titulo: "Guía ficticia de lectura (DEMO)", nombre: "guia-demo.docx", bytes: await docxDemo(), tradicion: "Numerología" },
  { titulo: "Tabla ficticia de números (DEMO)", nombre: "tabla-demo.csv", bytes: texto(CSV_DEMO), tradicion: "Numerología" },
  { titulo: "Hoja ficticia de correspondencias (DEMO)", nombre: "correspondencias-demo.xlsx", bytes: await xlsxDemo(), tradicion: "Numerología" },
  { titulo: "Presentación ficticia de ciclos (DEMO)", nombre: "ciclos-demo.pptx", bytes: await pptxDemo(), tradicion: "Numerología" },
];

async function vaciarCola(): Promise<void> {
  for (;;) {
    const r = await procesarSiguiente(db);
    if (!r) return;
    process.stderr.write(`[${r.estado}] ${r.etapa}: ${r.mensaje}\n`);
  }
}

const fuentes: string[] = [];
for (const d of documentos) {
  const { data: existente } = await db.from("sources").select("id").eq("titulo", d.titulo).maybeSingle();
  if (existente) {
    process.stderr.write(`Ya existe «${d.titulo}»; se omite.\n`);
    continue;
  }
  const deteccion = await detectarFormato(d.bytes, d.nombre);
  if (!deteccion.ok) throw new Error(`${d.nombre}: ${deteccion.error}`);
  const id = randomUUID();
  const { error } = await db.from("sources").insert({
    id,
    titulo: d.titulo,
    referencia: "Archivo de demostración de Círculo Nueve",
    idioma: "es",
    tradicion: d.tradicion,
    grupo: "aportada",
    licencia: "Texto propio de demostración",
    nivel_acceso: "consultores",
    es_demo: true,
    origen: "archivo",
  });
  if (error) throw new Error(`No se pudo crear la fuente: ${error.message}`);
  const ruta = `${randomUUID()}.${EXTENSIONES[deteccion.formato][0]}`;
  const subida = await db.storage.from("cuarentena").upload(ruta, d.bytes, { contentType: deteccion.mime });
  if (subida.error) throw new Error(`No se pudo subir a cuarentena: ${subida.error.message}`);
  const trabajo = await db.from("ingestion_jobs").insert({
    source_id: id,
    etapa: "extraer",
    nombre_archivo: d.nombre,
    formato_detectado: deteccion.formato,
    tamano_bytes: d.bytes.byteLength,
    storage_path: ruta,
  });
  if (trabajo.error) throw new Error(`No se pudo encolar: ${trabajo.error.message}`);
  fuentes.push(id);
}

await vaciarCola();

for (const id of fuentes) {
  const { data: version } = await db.from("source_versions").select("id").eq("source_id", id).eq("es_vigente", false).order("ingestado_at", { ascending: false }).limit(1).maybeSingle();
  if (!version) continue;
  await db.from("ingestion_jobs").insert({ source_id: id, source_version_id: version.id, etapa: "indexar" });
  await db.from("sources").update({ estado: "procesando" }).eq("id", id);
}

await vaciarCola();

const { data: resumen } = await db.from("sources").select("titulo, estado").eq("es_demo", true);
process.stdout.write(`${JSON.stringify({ ok: true, fuentes: resumen })}\n`);
