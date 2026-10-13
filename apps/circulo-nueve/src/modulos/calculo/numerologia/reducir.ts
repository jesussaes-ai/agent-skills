import type { ConfigNumerologia, Paso } from "./tipos";

export function sumaDeDigitos(n: number): number {
  return [...String(n)].reduce((acc, d) => acc + Number(d), 0);
}

export function esMaestro(n: number, config: ConfigNumerologia): boolean {
  return config.numerosMaestros && config.maestros.includes(n);
}

/**
 * Suma los dígitos hasta llegar a 1–9. Si los números maestros están activos,
 * se detiene en cuanto un resultado (inicial o intermedio) es maestro.
 */
export function reducir(
  n: number,
  config: ConfigNumerologia,
  etiqueta = "Reducción",
): { valor: number; pasos: Paso[] } {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Solo se reducen enteros positivos (recibido: ${n}).`);
  }
  const pasos: Paso[] = [];
  let valor = n;
  while (valor > 9 && !esMaestro(valor, config)) {
    const digitos = [...String(valor)];
    const siguiente = sumaDeDigitos(valor);
    pasos.push({ descripcion: etiqueta, operacion: `${valor} → ${digitos.join(" + ")} = ${siguiente}` });
    valor = siguiente;
  }
  if (valor > 9) {
    pasos.push({ descripcion: etiqueta, operacion: `${valor} es número maestro: no se reduce` });
  }
  return { valor, pasos };
}
