const PALABRAS_VACIAS = new Set(
  (
    "a al algo algun alguna como con cual cuales cuando de del donde el ella ellas ellos en es esa ese eso esta este esto " +
    "estos estas fue ha hay la las le les lo los mas me mi mis muy no nos o para pero por que quien se sea ser si sin " +
    "sobre son su sus te tu tus un una uno unos unas y ya yo e u puedo puede hace hacer cosa cosas"
  ).split(" "),
);

/** Minúsculas y sin acentos, pero conservando la ñ. */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/ñ/g, "\u0000")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\u0000/g, "ñ");
}

/** Raíz aproximada: sin plural y truncada a 6 letras («guardan», «guardar» → «guarda»). */
function raiz(token: string): string {
  return (token.length > 4 ? token.replace(/(es|s)$/, "") : token).slice(0, 6);
}

export function tokenizar(texto: string): string[] {
  return (normalizarTexto(texto).match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((t) => !PALABRAS_VACIAS.has(t))
    .map(raiz);
}
