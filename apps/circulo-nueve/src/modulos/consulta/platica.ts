/**
 * Análisis de la plática: busca en lo que la persona escribe o dicta su nombre completo,
 * fecha, hora y lugar de nacimiento. Es lógica pura y conservadora: si un dato no aparece
 * con claridad no se inventa, y todo lo encontrado se muestra con su fragmento para que la
 * persona lo confirme antes de calcular.
 */

export type CampoPlatica = "nombre" | "fecha" | "hora" | "lugar";

export interface Hallazgo {
  campo: CampoPlatica;
  valor: string;
  /** Trozo de la plática que justifica el dato. */
  fragmento: string;
  confianza: "alta" | "media";
}

export interface AnalisisPlatica {
  /** Nombre completo con mayúsculas iniciales. */
  nombre?: string;
  /** AAAA-MM-DD, fecha real entre 1800 y el año actual. */
  fecha?: string;
  /** HH:MM en formato de 24 horas. */
  hora?: string;
  precisionHora: "exacta" | "aproximada" | "desconocida";
  lugar?: string;
  hallazgos: Hallazgo[];
  faltan: CampoPlatica[];
}

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const LETRAS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
const PALABRA = new RegExp(`^[${LETRAS}][${LETRAS}'’.-]*$`);
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y"]);
const FIN_NOMBRE = new Set([
  "y", "e", "nací", "naci", "nació", "nacio", "tengo", "soy", "el", "en", "a", "que", "con", "mi", "pero", "desde",
  "vivo", "trabajo", "estoy", "me", "quiero", "originario", "originaria", "aunque", "porque", "pues", "o",
]);
const APROXIMADO = /\b(como|alrededor|m[aá]s\s+o\s+menos|aproximadamente|aprox|cerca\s+de|tipo|quiz[aá]s?|creo\s+que|entre)(?![\wáéíóúñ])/i;

const anioActual = () => new Date().getFullYear();
const dos = (n: number) => String(n).padStart(2, "0");

function capitalizar(palabra: string, primera: boolean): string {
  const minus = palabra.toLocaleLowerCase("es");
  if (!primera && PARTICULAS.has(minus)) return minus;
  return minus
    .split("-")
    .map((p) => p.charAt(0).toLocaleUpperCase("es") + p.slice(1))
    .join("-");
}

// ── Nombre ──────────────────────────────────────────────────────────────

function buscarNombre(texto: string): Hallazgo | null {
  const disparadores = [
    { re: /\bmi\s+nombre\s+(?:completo\s+)?es\s+/gi, exigeMayuscula: false },
    { re: /\bme\s+llamo\s+/gi, exigeMayuscula: false },
    { re: /\bnombre(?:\s+completo)?\s*:\s*/gi, exigeMayuscula: false },
    { re: /\bsoy\s+(?!de\b|del\b|originari)/gi, exigeMayuscula: true },
  ];
  for (const { re, exigeMayuscula } of disparadores) {
    for (const m of texto.matchAll(re)) {
      const inicio = m.index! + m[0].length;
      const resto = texto.slice(inicio).split(/[,.;:!?\n()]/)[0];
      const palabras: string[] = [];
      for (const p of resto.trim().split(/\s+/)) {
        if (!p || !PALABRA.test(p)) break;
        if (FIN_NOMBRE.has(p.toLocaleLowerCase("es"))) break;
        palabras.push(p.replace(/[.]+$/, ""));
        if (palabras.length === 6) break;
      }
      while (palabras.length && PARTICULAS.has(palabras.at(-1)!.toLocaleLowerCase("es"))) palabras.pop();
      if (!palabras.length) continue;
      if (exigeMayuscula && !/^[A-ZÁÉÍÓÚÜÑ]/.test(palabras[0])) continue;
      const valor = palabras.map((p, i) => capitalizar(p, i === 0)).join(" ");
      const fin = texto.indexOf(palabras.at(-1)!, inicio) + palabras.at(-1)!.length;
      return {
        campo: "nombre",
        valor,
        fragmento: texto.slice(m.index!, fin).trim(),
        confianza: exigeMayuscula || palabras.length < 2 ? "media" : "alta",
      };
    }
  }
  return null;
}

// ── Fecha ───────────────────────────────────────────────────────────────

function anioCompleto(texto: string): number {
  const n = Number(texto);
  if (texto.length !== 2) return n;
  return n > anioActual() % 100 ? 1900 + n : 2000 + n;
}

function fechaValida(anio: number, mes: number, dia: number): string | null {
  if (anio < 1800 || anio > anioActual() || mes < 1 || mes > 12 || dia < 1) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

function buscarFecha(texto: string): Hallazgo | null {
  const candidatos: { indice: number; fragmento: string; valor: string | null }[] = [];
  const meses = Object.keys(MESES).join("|");
  for (const m of texto.matchAll(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${meses})\\s+(?:de(?:l)?\\s+)?(?:a[ñn]o\\s+)?(\\d{4}|\\d{2})\\b`, "gi"))) {
    candidatos.push({ indice: m.index!, fragmento: m[0], valor: fechaValida(anioCompleto(m[3]), MESES[m[2].toLowerCase()], Number(m[1])) });
  }
  for (const m of texto.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    candidatos.push({ indice: m.index!, fragmento: m[0], valor: fechaValida(Number(m[1]), Number(m[2]), Number(m[3])) });
  }
  for (const m of texto.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g)) {
    candidatos.push({ indice: m.index!, fragmento: m[0], valor: fechaValida(anioCompleto(m[3]), Number(m[2]), Number(m[1])) });
  }
  const valido = candidatos.filter((c) => c.valor).sort((a, b) => a.indice - b.indice)[0];
  if (!valido) return null;
  return { campo: "fecha", valor: valido.valor!, fragmento: valido.fragmento.trim(), confianza: "alta" };
}

// ── Hora ────────────────────────────────────────────────────────────────

const DESCONOCIDA =
  /\b(no\s+s[eé]\s+(?:la\s+hora|a\s+qu[eé]\s+hora|qu[eé]\s+hora)|sin\s+hora|desconozco\s+la\s+hora|no\s+(?:me\s+)?acuerdo\s+(?:de\s+)?(?:la\s+hora|a\s+qu[eé]\s+hora)|no\s+(?:tengo|conozco)\s+la\s+hora|hora\s+desconocida)\b/i;

function aVeinticuatro(h: number, sufijo: string | undefined, periodo: string | undefined): number | null {
  const s = sufijo?.toLowerCase().replace(/[\s.]/g, "");
  const p = periodo?.toLowerCase();
  if (s === "pm" || p === "tarde" || p === "noche") {
    if (p === "noche" && h === 12) return 0;
    if (h < 12) h += 12;
  } else if (s === "am" || p === "madrugada" || p === "mañana") {
    if (h === 12) h = 0;
  }
  return h >= 0 && h < 24 ? h : null;
}

function buscarHora(texto: string): { hallazgo: Hallazgo; precision: "exacta" | "aproximada" } | { desconocida: Hallazgo } | null {
  const sufijo = String.raw`(?:\s*(am|pm|a\.\s?m\.|p\.\s?m\.))?`;
  const periodo = String.raw`(?:\s+(?:horas|hrs|h)\b)?(?:\s+de\s+la\s+(mañana|tarde|noche|madrugada))?`;
  const candidatos: { indice: number; fin: number; fragmento: string; hora: string }[] = [];
  for (const m of texto.matchAll(new RegExp(String.raw`\b(\d{1,2}):(\d{2})\b${sufijo}${periodo}`, "gi"))) {
    const h = aVeinticuatro(Number(m[1]), m[3], m[4]);
    const min = Number(m[2]);
    if (h !== null && min < 60) candidatos.push({ indice: m.index!, fin: m.index! + m[0].length, fragmento: m[0], hora: `${dos(h)}:${dos(min)}` });
  }
  for (const m of texto.matchAll(new RegExp(String.raw`\b(?:a|de|desde)\s+las?\s+(\d{1,2})\b(?![:/.\d])${sufijo}${periodo}`, "gi"))) {
    const h = aVeinticuatro(Number(m[1]), m[2], m[3]);
    if (h !== null) candidatos.push({ indice: m.index!, fin: m.index! + m[0].length, fragmento: m[0], hora: `${dos(h)}:00` });
  }
  for (const m of texto.matchAll(/\b(?:al\s+|a\s+)?(mediod[ií]a|medianoche)\b/gi)) {
    candidatos.push({ indice: m.index!, fin: m.index! + m[0].length, fragmento: m[0], hora: /medianoche/i.test(m[1]) ? "00:00" : "12:00" });
  }
  const elegido = candidatos.sort((a, b) => a.indice - b.indice)[0];
  if (elegido) {
    // Palabras de aproximación justo antes («como a las 8») o justo después («a las 8, más o menos»).
    const antes = texto.slice(Math.max(0, elegido.indice - 30), elegido.indice).split(/[.;!?\n]/).at(-1) ?? "";
    const despues = texto.slice(elegido.fin, Math.min(texto.length, elegido.fin + 25));
    const marca = antes.match(APROXIMADO);
    const aproximada = Boolean(marca) || /^\s*,?\s*(m[aá]s\s+o\s+menos|aproximadamente|aprox)/i.test(despues);
    const fragmento = marca ? antes.slice(marca.index) + elegido.fragmento : elegido.fragmento;
    return {
      hallazgo: { campo: "hora", valor: elegido.hora, fragmento: fragmento.replace(/\s+/g, " ").trim(), confianza: aproximada ? "media" : "alta" },
      precision: aproximada ? "aproximada" : "exacta",
    };
  }
  const d = texto.match(DESCONOCIDA);
  if (d) return { desconocida: { campo: "hora", valor: "desconocida", fragmento: d[0], confianza: "alta" } };
  return null;
}

// ── Lugar ───────────────────────────────────────────────────────────────

const NO_LUGAR = /^(el|la|los|las|un|una|casa|1\d|\d)\b/i;
const CORTE_LUGAR =
  /[.;!?\n()]|\s+el\s+|\s+a\s+las?\s+|\s+en\s+el\s+a[ñn]o|\s+a\s+|\s+y\s+|\s+e\s+|\s+pero\s+|\s+donde\s+|\s+cuando\s+|\s+hace\s+|\s+desde\s+|\s+aunque\s+|\s+por\s+|\s+con\s+|\s+como\s+|\s+alrededor\s+|\s+m[aá]s\s+o\s+menos|\s+aproximadamente|\s+del\s+\d|\s+en\s+\d|\s+\d/i;

function buscarLugar(texto: string): Hallazgo | null {
  const disparadores: { re: RegExp; confianza: "alta" | "media" }[] = [
    { re: /\bnac[ií](?:\s+y\s+crec[ií])?\s+en\s+(?:la\s+ciudad\s+de\s+|el\s+estado\s+de\s+|el\s+pueblo\s+de\s+|el\s+municipio\s+de\s+)?/gi, confianza: "alta" },
    // «nací el 23 de noviembre… en Guadalajara»: el lugar va después de la fecha o la hora, con mayúscula.
    { re: /\bnac[ií](?=\s)[^.;!?\n]*?\s+en\s+(?=[A-ZÁÉÍÓÚÑ])/g, confianza: "alta" },
    { re: /\b(?:originari[oa]|natural|oriund[oa])\s+de\s+/gi, confianza: "alta" },
    { re: /\ben\s+la\s+ciudad\s+de\s+/gi, confianza: "media" },
    { re: /\bsoy\s+de\s+/gi, confianza: "media" },
  ];
  for (const { re, confianza } of disparadores) {
    for (const m of texto.matchAll(re)) {
      const inicio = m.index! + m[0].length;
      const resto = texto.slice(inicio);
      if (NO_LUGAR.test(resto) || !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(resto)) continue;
      const corte = resto.search(CORTE_LUGAR);
      let lugar = (corte === -1 ? resto : resto.slice(0, corte)).replace(/\s+/g, " ").replace(/[\s,]+$/, "").trim();
      const palabras = lugar.split(" ");
      if (palabras.length > 8) lugar = palabras.slice(0, 8).join(" ").replace(/,$/, "");
      if (lugar.length < 2) continue;
      const valor = lugar.charAt(0).toLocaleUpperCase("es") + lugar.slice(1);
      return { campo: "lugar", valor, fragmento: (m[0] + lugar).replace(/\s+/g, " ").trim(), confianza };
    }
  }
  return null;
}

// ── Análisis completo ───────────────────────────────────────────────────

export function analizarPlatica(texto: string): AnalisisPlatica {
  const limpio = texto.replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  const hallazgos: Hallazgo[] = [];
  const resultado: AnalisisPlatica = { precisionHora: "desconocida", hallazgos, faltan: [] };

  const nombre = buscarNombre(limpio);
  if (nombre) {
    resultado.nombre = nombre.valor;
    hallazgos.push(nombre);
  }
  const fecha = buscarFecha(limpio);
  if (fecha) {
    resultado.fecha = fecha.valor;
    hallazgos.push(fecha);
  }
  const hora = buscarHora(limpio);
  if (hora && "hallazgo" in hora) {
    resultado.hora = hora.hallazgo.valor;
    resultado.precisionHora = hora.precision;
    hallazgos.push(hora.hallazgo);
  } else if (hora) {
    hallazgos.push(hora.desconocida);
  }
  const lugar = buscarLugar(limpio);
  if (lugar) {
    resultado.lugar = lugar.valor;
    hallazgos.push(lugar);
  }

  const encontrados = new Set(hallazgos.map((h) => h.campo));
  resultado.faltan = (["nombre", "fecha", "hora", "lugar"] as const).filter((c) => !encontrados.has(c));
  return resultado;
}
