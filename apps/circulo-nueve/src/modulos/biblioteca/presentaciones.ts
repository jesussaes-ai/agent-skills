import JSZip from "jszip";
import type { DocumentoExtraido, Segmento } from "./tipos";

const decodificar = (x: string) =>
  x.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function parrafos(xml: string): string[] {
  return [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
    .map((p) => [...p[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decodificar(t[1])).join(""))
    .map((t) => t.trim())
    .filter(Boolean);
}

/** PPTX: texto y notas por diapositiva, en el orden de la presentación. */
export async function extraerPptx(bytes: Uint8Array): Promise<DocumentoExtraido> {
  const zip = await JSZip.loadAsync(bytes);
  const presentacion = (await zip.file("ppt/presentation.xml")?.async("string")) ?? "";
  const relaciones = (await zip.file("ppt/_rels/presentation.xml.rels")?.async("string")) ?? "";
  const destino = new Map([...relaciones.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const orden = [...presentacion.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => destino.get(m[1])).filter((x): x is string => Boolean(x));

  const segmentos: Segmento[] = [];
  const partes: string[] = [];
  for (const [i, archivo] of orden.entries()) {
    const ruta = `ppt/${archivo.replace(/^\.\//, "")}`;
    const xml = (await zip.file(ruta)?.async("string")) ?? "";
    const textos = parrafos(xml);
    const rels = (await zip.file(ruta.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels"))?.async("string")) ?? "";
    const rutaNotas = /Target="\.\.\/notesSlides\/([^"]+)"/.exec(rels)?.[1];
    const notas = rutaNotas ? parrafos((await zip.file(`ppt/notesSlides/${rutaNotas}`)?.async("string")) ?? "").filter((t) => !/^\d+$/.test(t)) : [];
    if (!textos.length && !notas.length) continue;
    const numero = i + 1;
    const titulo = textos[0] ?? `Diapositiva ${numero}`;
    const md = [`## Diapositiva ${numero}: ${titulo}`, ...textos.slice(1), ...(notas.length ? ["", `Notas: ${notas.join(" ")}`] : [])].join("\n\n");
    partes.push(md);
    segmentos.push({ texto: md, jerarquia: [titulo], localizador: { diapositiva: numero, seccion: titulo } });
  }
  return { markdown: partes.join("\n\n"), segmentos, metodo: "PPTX (OOXML) → texto y notas por diapositiva", advertencias: [] };
}
