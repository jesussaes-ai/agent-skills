/**
 * Las 22 letras del alfabeto hebreo con sus valores de gematría y las 10 sefirot del Árbol de la Vida.
 * Son datos fijos de la tradición, no interpretaciones: las interpretaciones salen de la biblioteca.
 */

export interface LetraHebrea {
  /** Letra en su forma normal. */
  letra: string;
  /** Forma final (sofit), solo para כ מ נ פ צ. */
  final?: string;
  /** Nombre en español. */
  nombre: string;
  /** Lugar en el alfabeto (1–22). */
  orden: number;
  /** Valor estándar (Mispar Hejrají). */
  valor: number;
  /** Valor de la forma final en Mispar Gadol (500–900). */
  valorFinalGadol?: number;
}

export const LETRAS: readonly LetraHebrea[] = [
  { letra: "א", nombre: "Álef", orden: 1, valor: 1 },
  { letra: "ב", nombre: "Bet", orden: 2, valor: 2 },
  { letra: "ג", nombre: "Guímel", orden: 3, valor: 3 },
  { letra: "ד", nombre: "Dálet", orden: 4, valor: 4 },
  { letra: "ה", nombre: "He", orden: 5, valor: 5 },
  { letra: "ו", nombre: "Vav", orden: 6, valor: 6 },
  { letra: "ז", nombre: "Zayin", orden: 7, valor: 7 },
  { letra: "ח", nombre: "Jet", orden: 8, valor: 8 },
  { letra: "ט", nombre: "Tet", orden: 9, valor: 9 },
  { letra: "י", nombre: "Yod", orden: 10, valor: 10 },
  { letra: "כ", final: "ך", nombre: "Kaf", orden: 11, valor: 20, valorFinalGadol: 500 },
  { letra: "ל", nombre: "Lámed", orden: 12, valor: 30 },
  { letra: "מ", final: "ם", nombre: "Mem", orden: 13, valor: 40, valorFinalGadol: 600 },
  { letra: "נ", final: "ן", nombre: "Nun", orden: 14, valor: 50, valorFinalGadol: 700 },
  { letra: "ס", nombre: "Sámej", orden: 15, valor: 60 },
  { letra: "ע", nombre: "Ayin", orden: 16, valor: 70 },
  { letra: "פ", final: "ף", nombre: "Pe", orden: 17, valor: 80, valorFinalGadol: 800 },
  { letra: "צ", final: "ץ", nombre: "Tsadi", orden: 18, valor: 90, valorFinalGadol: 900 },
  { letra: "ק", nombre: "Qof", orden: 19, valor: 100 },
  { letra: "ר", nombre: "Resh", orden: 20, valor: 200 },
  { letra: "ש", nombre: "Shin", orden: 21, valor: 300 },
  { letra: "ת", nombre: "Tav", orden: 22, valor: 400 },
];

const POR_CARACTER = new Map<string, { info: LetraHebrea; esFinal: boolean }>();
for (const l of LETRAS) {
  POR_CARACTER.set(l.letra, { info: l, esFinal: false });
  if (l.final) POR_CARACTER.set(l.final, { info: l, esFinal: true });
}

export function buscarLetra(caracter: string) {
  return POR_CARACTER.get(caracter);
}

export const FINALES: Readonly<Record<string, string>> = Object.fromEntries(
  LETRAS.filter((l) => l.final).map((l) => [l.letra, l.final!]),
);

export type Pilar = "Misericordia (derecho)" | "Rigor (izquierdo)" | "Equilibrio (central)";

export interface Sefira {
  numero: number;
  nombre: string;
  hebreo: string;
  significado: string;
  pilar: Pilar;
}

export const SEFIROT: readonly Sefira[] = [
  { numero: 1, nombre: "Kéter", hebreo: "כתר", significado: "Corona", pilar: "Equilibrio (central)" },
  { numero: 2, nombre: "Jojmá", hebreo: "חכמה", significado: "Sabiduría", pilar: "Misericordia (derecho)" },
  { numero: 3, nombre: "Biná", hebreo: "בינה", significado: "Entendimiento", pilar: "Rigor (izquierdo)" },
  { numero: 4, nombre: "Jésed", hebreo: "חסד", significado: "Bondad, misericordia", pilar: "Misericordia (derecho)" },
  { numero: 5, nombre: "Guevurá", hebreo: "גבורה", significado: "Rigor, fuerza", pilar: "Rigor (izquierdo)" },
  { numero: 6, nombre: "Tiféret", hebreo: "תפארת", significado: "Belleza, armonía", pilar: "Equilibrio (central)" },
  { numero: 7, nombre: "Nétsaj", hebreo: "נצח", significado: "Victoria, perseverancia", pilar: "Misericordia (derecho)" },
  { numero: 8, nombre: "Hod", hebreo: "הוד", significado: "Esplendor", pilar: "Rigor (izquierdo)" },
  { numero: 9, nombre: "Yesod", hebreo: "יסוד", significado: "Fundamento", pilar: "Equilibrio (central)" },
  { numero: 10, nombre: "Maljut", hebreo: "מלכות", significado: "Reino", pilar: "Equilibrio (central)" },
];
