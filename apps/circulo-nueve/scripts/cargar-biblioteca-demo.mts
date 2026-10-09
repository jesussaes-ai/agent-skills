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

const db = clienteServicio();
const texto = (t: string) => new TextEncoder().encode(t);

// Textos ficticios y propios (DEMO). No se importa pruebas/documentos-demo.ts porque
// @react-pdf no carga fuera de Next/Vitest.
const MANUAL = `# Manual ficticio de numerología (DEMO)

## Números del 1 al 9

El número 1 representa el comienzo y la iniciativa. El número 2 habla de cooperación y escucha.
El número 3 se asocia con la expresión y la creatividad. El número 4 con la estructura y el trabajo constante.
El número 5 con el cambio y la libertad. El número 6 con el cuidado y la responsabilidad.
El número 7 con la reflexión y el estudio. El número 8 con la organización y los logros materiales.
El número 9 cierra el ciclo: generosidad y finalización.

## Números maestros

En esta tradición ficticia, 11, 22 y 33 se llaman números maestros y no se reducen a un dígito.
El 11 se describe como intuición; el 22 como construcción a gran escala; el 33 como servicio.
`;

const CARTA = `# Cuaderno ficticio de carta natal (DEMO)

## El Sol, la Luna y el Ascendente

En este cuaderno de demostración, el Sol describe la identidad central, la Luna las emociones
y el Ascendente la manera de presentarse ante los demás.

## Casas

La casa I trata de la persona; la casa VII de las relaciones; la casa X de la vocación.
Cuando la hora de nacimiento es desconocida, las casas y el Ascendente no se interpretan.
`;

const CICLOS = `# Guía ficticia de ciclos personales (DEMO)

## Año personal

El año personal se obtiene sumando el día y el mes de nacimiento con el año en curso y reduciendo a un dígito.
Un año personal 1 se describe como de inicios; un año personal 9 como de cierres.

## Uso responsable

Estas descripciones son de entretenimiento y reflexión. No sustituyen consejo médico, legal ni financiero.
`;

const TABLA = "Número,Palabra clave,Fuente\n1,Comienzo,Tabla ficticia (DEMO)\n2,Cooperación,Tabla ficticia (DEMO)\n3,Expresión,Tabla ficticia (DEMO)\n9,Ciclo,Tabla ficticia (DEMO)\n11,Intuición,Tabla ficticia (DEMO)\n";

const documentos: { titulo: string; nombre: string; bytes: Uint8Array; tradicion: string }[] = [
  { titulo: "Manual ficticio de numerología (DEMO)", nombre: "manual-demo.md", bytes: texto(MANUAL), tradicion: "Numerología" },
  { titulo: "Cuaderno ficticio de carta natal (DEMO)", nombre: "carta-demo.md", bytes: texto(CARTA), tradicion: "Astrología" },
  { titulo: "Guía ficticia de ciclos personales (DEMO)", nombre: "ciclos-demo.md", bytes: texto(CICLOS), tradicion: "Numerología" },
  { titulo: "Tabla ficticia de números (DEMO)", nombre: "tabla-demo.csv", bytes: texto(TABLA), tradicion: "Numerología" },
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
