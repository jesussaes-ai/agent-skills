import { buscarLetra, SEFIROT, type Sefira } from "./letras";
import { TRANSLITERACION_VERSION } from "./transliterar";

export const MOTOR_CABALA = "circulo-nueve-cabala";
export const MOTOR_CABALA_VERSION = "1.0.0";
export const TRADICION_CABALA =
  "Gematría hebrea clásica (Mispar Hejrají, Gadol y Katán) y correspondencia numérica con las 10 sefirot del Árbol de la Vida";

export interface PasoCabala {
  descripcion: string;
  operacion: string;
}

export interface LetraCalculada {
  caracter: string;
  nombre: string;
  orden: number;
  esFinal: boolean;
  valor: number;
  valorGadol: number;
  valorKatan: number;
  /** Sendero del Árbol según la tradición hermética (Golden Dawn): 10 + lugar de la letra. */
  senderoHermetico: number;
}

export interface Correspondencia {
  origen: string;
  numero: number;
  /** Número usado para buscar la sefirá (1–10). */
  numeroSefira: number;
  sefira: Sefira;
  nota?: string;
}

export interface EntradaCabala {
  /** Nombre ya escrito en letras hebreas y APROBADO por la persona. */
  hebreo: string;
  /** Números de la numerología que se quieren relacionar con las sefirot. */
  numeros?: { origen: string; valor: number }[];
}

export interface ResultadoCabala {
  ok: true;
  motor: string;
  motorVersion: string;
  tradicion: string;
  transliteracionVersion: string;
  hebreo: string;
  letras: LetraCalculada[];
  totales: { hejraji: number; gadol: number; katan: number };
  pasos: PasoCabala[];
  reduccion: { valor: number; pasos: PasoCabala[] };
  correspondencias: Correspondencia[];
  ignorados: string[];
  advertencias: string[];
}

export interface ErrorCabala {
  ok: false;
  errores: string[];
}

function primerDigito(n: number) {
  return Number(String(n)[0]);
}

/** Reduce sumando dígitos hasta 1–9 y deja visible cada operación. */
export function reducirCabala(n: number): { valor: number; pasos: PasoCabala[] } {
  const pasos: PasoCabala[] = [];
  let v = n;
  while (v > 9) {
    const digitos = [...String(v)].map(Number);
    const s = digitos.reduce((a, b) => a + b, 0);
    pasos.push({ descripcion: "Reducción", operacion: `${digitos.join(" + ")} = ${s}` });
    v = s;
  }
  return { valor: v, pasos };
}

function sefiraDe(numero: number, origen: string): Correspondencia | null {
  if (!Number.isInteger(numero) || numero < 1) return null;
  if (numero <= 10) return { origen, numero, numeroSefira: numero, sefira: SEFIROT[numero - 1] };
  const r = reducirCabala(numero).valor;
  return {
    origen,
    numero,
    numeroSefira: r,
    sefira: SEFIROT[r - 1],
    nota: `${numero} se reduce a ${r} para buscar la sefirá.`,
  };
}

export function calcularCabala(entrada: EntradaCabala): ResultadoCabala | ErrorCabala {
  const letras: LetraCalculada[] = [];
  const ignorados: string[] = [];
  for (const c of entrada.hebreo ?? "") {
    if (/\s|[׳״'"\-]/.test(c)) continue;
    const l = buscarLetra(c);
    if (!l) {
      ignorados.push(c);
      continue;
    }
    const valorGadol = l.esFinal && l.info.valorFinalGadol ? l.info.valorFinalGadol : l.info.valor;
    letras.push({
      caracter: c,
      nombre: l.esFinal ? `${l.info.nombre} final` : l.info.nombre,
      orden: l.info.orden,
      esFinal: l.esFinal,
      valor: l.info.valor,
      valorGadol,
      valorKatan: primerDigito(l.info.valor),
      senderoHermetico: 10 + l.info.orden,
    });
  }
  if (!letras.length) {
    return { ok: false, errores: ["Escribe o aprueba el nombre en letras hebreas para calcular la gematría."] };
  }

  const suma = (f: (l: LetraCalculada) => number) => letras.reduce((a, l) => a + f(l), 0);
  const totales = { hejraji: suma((l) => l.valor), gadol: suma((l) => l.valorGadol), katan: suma((l) => l.valorKatan) };
  const pasos: PasoCabala[] = [
    { descripcion: "Letras con su valor", operacion: letras.map((l) => `${l.caracter} ${l.nombre} (${l.valor})`).join(" · ") },
    { descripcion: "Mispar Hejrají (valor estándar)", operacion: `${letras.map((l) => l.valor).join(" + ")} = ${totales.hejraji}` },
    { descripcion: "Mispar Gadol (finales 500–900)", operacion: `${letras.map((l) => l.valorGadol).join(" + ")} = ${totales.gadol}` },
    { descripcion: "Mispar Katán (sin ceros)", operacion: `${letras.map((l) => l.valorKatan).join(" + ")} = ${totales.katan}` },
  ];
  const reduccion = reducirCabala(totales.hejraji);

  const correspondencias: Correspondencia[] = [];
  const g = sefiraDe(reduccion.valor, `Gematría del nombre (${totales.hejraji} → ${reduccion.valor})`);
  if (g) correspondencias.push(g);
  for (const n of entrada.numeros ?? []) {
    const c = sefiraDe(n.valor, n.origen);
    if (c) correspondencias.push(c);
  }

  const advertencias: string[] = [];
  if (ignorados.length) advertencias.push(`Se ignoraron caracteres que no son letras hebreas: ${ignorados.join(" ")}`);
  if (letras.some((l, i) => l.esFinal && i < letras.length - 1 && !/\s/.test(entrada.hebreo[entrada.hebreo.indexOf(l.caracter) + 1] ?? " "))) {
    advertencias.push("Hay una forma final en medio de una palabra; revisa la escritura.");
  }

  return {
    ok: true,
    motor: MOTOR_CABALA,
    motorVersion: MOTOR_CABALA_VERSION,
    tradicion: TRADICION_CABALA,
    transliteracionVersion: TRANSLITERACION_VERSION,
    hebreo: entrada.hebreo.trim(),
    letras,
    totales,
    pasos,
    reduccion,
    correspondencias,
    ignorados,
    advertencias,
  };
}
