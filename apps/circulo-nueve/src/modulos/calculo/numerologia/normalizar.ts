import type { CambioNormalizacion, ConfigNumerologia } from "./tipos";

/** Separan palabras: espacios de cualquier tipo y guiones (nombres compuestos). */
const SEPARADOR_PALABRA = /[\s\-\u2010\u2011\u2012\u2013\u2014]/u;
/** Se eliminan sin separar palabras: apóstrofos y puntos de iniciales. */
const IGNORADO = /['\u2019\u02BC.]/u;

export type ResultadoNormalizacion =
  | { ok: true; palabras: string[]; cambios: CambioNormalizacion[] }
  | { ok: false; errores: string[] };

export function normalizarNombre(nombre: string, config: ConfigNumerologia): ResultadoNormalizacion {
  const palabras: string[] = [];
  const cambios: CambioNormalizacion[] = [];
  const errores: string[] = [];
  let actual = "";

  const cerrarPalabra = () => {
    if (actual) palabras.push(actual);
    actual = "";
  };

  for (const caracter of nombre.normalize("NFC")) {
    if (SEPARADOR_PALABRA.test(caracter)) {
      cerrarPalabra();
      continue;
    }
    if (IGNORADO.test(caracter)) {
      cambios.push({ original: caracter, resultado: "", regla: "Apóstrofos y puntos se ignoran" });
      continue;
    }
    if (caracter === "ñ" || caracter === "Ñ") {
      if (config.enye === "rechazar") {
        errores.push(`La letra «${caracter}» no se admite con la regla de ñ configurada («rechazar»).`);
      } else {
        actual += "N";
        cambios.push({ original: caracter, resultado: "N", regla: "La ñ se cuenta como N" });
      }
      continue;
    }

    const base = caracter.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
    if (/^[A-Z]$/.test(base)) {
      if (base !== caracter.toUpperCase()) {
        cambios.push({ original: caracter, resultado: base, regla: "Se quitan acentos, diéresis y cedillas" });
      }
      actual += base;
      continue;
    }

    if (/\p{L}/u.test(caracter)) {
      errores.push(
        `El carácter «${caracter}» no pertenece al alfabeto latino básico; la tabla pitagórica no lo define y no se transcribe automáticamente.`,
      );
    } else if (/\p{N}/u.test(caracter)) {
      errores.push(`El nombre contiene el dígito «${caracter}»; escribe solo letras.`);
    } else {
      errores.push(`El símbolo «${caracter}» no se admite en el nombre.`);
    }
  }
  cerrarPalabra();

  if (errores.length) return { ok: false, errores: [...new Set(errores)] };
  if (!palabras.length) return { ok: false, errores: ["El nombre está vacío."] };
  return { ok: true, palabras, cambios };
}
