import { FINALES } from "./letras";

/**
 * Propuesta fonética para escribir un nombre en español con letras hebreas.
 * Es solo una PROPUESTA: la persona la revisa, la corrige y la aprueba antes de calcular nada.
 * Reglas (versión translit-es-1): ver docs/cabala-reglas.md.
 */
export const TRANSLITERACION_VERSION = "translit-es-1";

export interface PasoTransliteracion {
  de: string;
  a: string;
  regla: string;
}

export interface PalabraTransliterada {
  original: string;
  hebreo: string;
  pasos: PasoTransliteracion[];
}

const CONSONANTES: Readonly<Record<string, string>> = {
  B: "ב",
  D: "ד",
  F: "פ",
  K: "ק",
  L: "ל",
  M: "מ",
  N: "נ",
  P: "פ",
  Q: "ק",
  R: "ר",
  S: "ס",
  T: "ט",
  V: "ו",
  W: "ו",
  Z: "ס",
};

function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .replace(/Ñ/g, "\u0000")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0000/g, "Ñ");
}

function esVocal(c: string | undefined) {
  return c !== undefined && "AEIOU".includes(c);
}

export function transliterarPalabra(original: string): PalabraTransliterada {
  const p = normalizar(original).replace(/[^A-ZÑ]/g, "");
  const pasos: PasoTransliteracion[] = [];
  let salida = "";
  const poner = (de: string, a: string, regla: string) => {
    salida += a;
    pasos.push({ de, a: a || "—", regla });
  };

  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    const sig = p[i + 1];
    const inicio = i === 0;
    const fin = i === p.length - 1;
    const dos = c + (sig ?? "");

    if (dos === "CH") { poner("CH", "צ׳", "CH suena «ch»: tsadi con gueresh"); i++; continue; }
    if (dos === "SH") { poner("SH", "ש", "SH: shin"); i++; continue; }
    if (dos === "LL") { poner("LL", "י", "LL suena «y»: yod"); i++; continue; }
    if (dos === "RR") { poner("RR", "ר", "RR: una sola resh"); i++; continue; }
    if ((dos === "QU" || dos === "GU") && (p[i + 2] === "E" || p[i + 2] === "I")) {
      poner(dos, c === "Q" ? "ק" : "ג", `${dos} ante E/I: la U no suena`);
      i++;
      continue;
    }

    switch (c) {
      case "A":
      case "E":
        if (inicio) poner(c, "א", `${c} al inicio: álef`);
        else if (fin) poner(c, "ה", `${c} al final: he`);
        else poner(c, "", `${c} en medio: no se escribe (escritura sin vocales)`);
        break;
      case "I":
      case "Y":
        if (c === "Y" && esVocal(sig)) poner(c, "י", "Y consonante: yod");
        else poner(c, inicio ? "אי" : "י", inicio ? `${c} al inicio: álef + yod` : `${c}: yod`);
        break;
      case "O":
      case "U":
        poner(c, inicio ? "או" : "ו", inicio ? `${c} al inicio: álef + vav` : `${c}: vav`);
        break;
      case "C":
        if (sig === "E" || sig === "I") poner(c, "ס", "C ante E/I suena «s»: sámej");
        else poner(c, "ק", "C fuerte: qof");
        break;
      case "G":
        if (sig === "E" || sig === "I") poner(c, "ח", "G ante E/I suena «j»: jet");
        else poner(c, "ג", "G fuerte: guímel");
        break;
      case "J":
        poner(c, "ח", "J: jet");
        break;
      case "H":
        poner(c, "", "H muda: no se escribe");
        break;
      case "Ñ":
        poner(c, "ני", "Ñ: nun + yod");
        break;
      case "X":
        poner(c, "קס", "X: qof + sámej");
        break;
      default:
        if (CONSONANTES[c]) poner(c, CONSONANTES[c], c === "Z" ? "Z (seseo): sámej" : `${c}: letra equivalente`);
    }
  }

  // Forma final de la última letra (sofit), si existe.
  const ultima = salida.at(-1);
  if (ultima && FINALES[ultima]) {
    salida = salida.slice(0, -1) + FINALES[ultima];
    pasos.push({ de: ultima, a: FINALES[ultima], regla: "Última letra de la palabra: forma final" });
  }
  return { original, hebreo: salida, pasos };
}

export function proponerTransliteracion(nombre: string): PalabraTransliterada[] {
  return nombre
    .split(/[\s-]+/)
    .filter((p) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(p))
    .map(transliterarPalabra);
}
