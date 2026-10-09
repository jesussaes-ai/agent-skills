/**
 * Tabla pitagórica: las 26 letras latinas básicas en filas de nueve.
 *   1 2 3 4 5 6 7 8 9
 *   A B C D E F G H I
 *   J K L M N O P Q R
 *   S T U V W X Y Z
 */
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const TABLA_PITAGORICA: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries([...ALFABETO].map((letra, i) => [letra, (i % 9) + 1])),
);

export const VOCALES_BASE = new Set(["A", "E", "I", "O", "U"]);

export function valorLetra(letra: string): number {
  const valor = TABLA_PITAGORICA[letra];
  if (valor === undefined) {
    throw new Error(`Letra fuera de la tabla pitagórica: ${letra}`);
  }
  return valor;
}
