import type { VozDisponible } from "../tipos";

/**
 * Clasificación de voces del navegador. El navegador no informa el género de
 * forma uniforme, así que «posible voz masculina» es solo una pista por el
 * nombre comercial de la voz y se muestra como tal.
 */

export type RegionVoz = "es-MX" | "es-ES" | "es-otro";

export interface VozClasificada extends VozDisponible {
  region: RegionVoz;
  /** true/false según el nombre; null si el nombre no da pista. */
  posibleMasculina: boolean | null;
}

const MASCULINOS = /(?<!\p{L})(jorge|pablo|ra[uú]l|diego|juan|carlos|enrique|[aá]lvaro|alonso|gerardo|andr[eé]s|antonio|miguel|jaime|dario|dar[ií]o|jos[eé]|alejandro|emilio|federico|gonzalo|jes[uú]s|luis|manuel|mateo|sergio|tom[aá]s|male|masculin[ao]|hombre)(?!\p{L})/iu;
const FEMENINOS = /(?<!\p{L})(paulina|m[oó]nica|sabina|helena|laura|elvira|dalia|luc[ií]a|marisol|esperanza|renata|beatriz|carmen|elena|isabel|julieta|larissa|marta|paloma|rosa|sof[ií]a|ximena|female|femenin[ao]|mujer|conchita|pilar|nuria|valentina|camila)(?!\p{L})/iu;

export function regionDe(idioma: string): RegionVoz | null {
  const normal = idioma.replace("_", "-").toLowerCase();
  if (normal === "es-mx") return "es-MX";
  if (normal === "es-es") return "es-ES";
  if (normal === "es" || normal.startsWith("es-")) return "es-otro";
  return null;
}

export function pistaMasculina(nombre: string): boolean | null {
  if (MASCULINOS.test(nombre)) return true;
  if (FEMENINOS.test(nombre)) return false;
  return null;
}

/** Datos mínimos de SpeechSynthesisVoice, para poder probar sin navegador. */
export interface VozNavegador {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
}

export function aVozDisponible(v: VozNavegador): VozDisponible {
  return { id: v.voiceURI || v.name, nombre: v.name, idioma: v.lang.replace("_", "-"), local: v.localService };
}

const ORDEN_REGION: Record<RegionVoz, number> = { "es-MX": 0, "es-ES": 1, "es-otro": 2 };
const ORDEN_PISTA = (p: boolean | null) => (p === true ? 0 : p === null ? 1 : 2);

export interface VocesClasificadas {
  /** es-MX y es-ES, en orden de preferencia (es-MX, posible masculina, local). */
  coincidentes: VozClasificada[];
  /** Otras variantes de español, por si ninguna coincide. */
  otrasEspanol: VozClasificada[];
  total: number;
}

export function clasificarVoces(voces: VozDisponible[]): VocesClasificadas {
  const espanol = voces.flatMap((v) => {
    const region = regionDe(v.idioma);
    return region ? [{ ...v, region, posibleMasculina: pistaMasculina(v.nombre) }] : [];
  });
  espanol.sort(
    (a, b) =>
      ORDEN_REGION[a.region] - ORDEN_REGION[b.region] ||
      ORDEN_PISTA(a.posibleMasculina) - ORDEN_PISTA(b.posibleMasculina) ||
      Number(b.local) - Number(a.local) ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
  return {
    coincidentes: espanol.filter((v) => v.region !== "es-otro"),
    otrasEspanol: espanol.filter((v) => v.region === "es-otro"),
    total: voces.length,
  };
}

/** Voz preferida guardada si sigue disponible; si no, la primera coincidente. */
export function elegirVoz(clasificadas: VocesClasificadas, preferidaId?: string | null): VozClasificada | undefined {
  const todas = [...clasificadas.coincidentes, ...clasificadas.otrasEspanol];
  return todas.find((v) => v.id === preferidaId) ?? clasificadas.coincidentes[0];
}

export function etiquetaVoz(v: VozClasificada): string {
  const pista = v.posibleMasculina === true ? " · posible voz masculina" : v.posibleMasculina === false ? " · posible voz femenina" : "";
  return `${v.nombre} — ${v.idioma} · ${v.local ? "en el dispositivo" : "remota"}${pista}`;
}

/**
 * Divide el texto en fragmentos por oración (algunos navegadores cortan las
 * locuciones largas a los ~15 s).
 */
export function dividirParaVoz(texto: string, maximo = 200): string[] {
  const oraciones = texto.replace(/\s+/g, " ").trim().match(/[^.!?¡¿;:]+[.!?;:]*/g) ?? [];
  const fragmentos: string[] = [];
  let actual = "";
  for (const o of oraciones.map((x) => x.trim()).filter(Boolean)) {
    if (o.length > maximo) {
      if (actual) fragmentos.push(actual);
      actual = "";
      for (let i = 0; i < o.length; i += maximo) fragmentos.push(o.slice(i, i + maximo).trim());
      continue;
    }
    if ((actual + " " + o).trim().length > maximo) {
      fragmentos.push(actual);
      actual = o;
    } else actual = (actual + " " + o).trim();
  }
  if (actual) fragmentos.push(actual);
  return fragmentos;
}

export const FRASE_PRUEBA = "Hola, soy la voz del asistente de Círculo Nueve. Así sonarán las respuestas.";
