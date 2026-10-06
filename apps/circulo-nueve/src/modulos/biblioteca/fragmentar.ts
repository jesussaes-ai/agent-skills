import { detectarInyeccion } from "./inyeccion";
import type { Fragmento, Segmento } from "./tipos";

/** ~500 tokens por fragmento (≈ 4 caracteres por token en español) con ~12 % de solapamiento. */
export const OPCIONES_FRAGMENTOS = { caracteresObjetivo: 2000, caracteresMaximos: 3000, solape: 0.12 };

function partirPorParrafos(texto: string): string[] {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function partirLargo(parrafo: string, maximo: number): string[] {
  if (parrafo.length <= maximo) return [parrafo];
  const oraciones = parrafo.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) ?? [parrafo];
  const piezas: string[] = [];
  let actual = "";
  for (const o of oraciones) {
    if ((actual + o).length > maximo && actual) {
      piezas.push(actual.trim());
      actual = "";
    }
    actual += o;
    while (actual.length > maximo) {
      piezas.push(actual.slice(0, maximo));
      actual = actual.slice(maximo);
    }
  }
  if (actual.trim()) piezas.push(actual.trim());
  return piezas;
}

/**
 * Fragmenta sin cruzar segmentos: cada fragmento hereda el localizador exacto de su
 * segmento (página, capítulo, sección, URL). Dentro del segmento junta párrafos hasta
 * el tamaño objetivo y repite el final del anterior como solapamiento.
 */
export function fragmentar(segmentos: Segmento[], opciones = OPCIONES_FRAGMENTOS): Fragmento[] {
  const fragmentos: Fragmento[] = [];
  for (const segmento of segmentos) {
    const parrafos = partirPorParrafos(segmento.texto).flatMap((p) => partirLargo(p, opciones.caracteresMaximos));
    let actual: string[] = [];
    let longitud = 0;
    const emitir = () => {
      const texto = actual.join("\n\n").trim();
      if (!texto) return;
      const inyeccion = detectarInyeccion(texto);
      fragmentos.push({
        orden: fragmentos.length,
        texto,
        localizador: segmento.localizador,
        jerarquia: segmento.jerarquia,
        ocrConfianza: segmento.ocrConfianza,
        sospechoso: inyeccion.sospechoso,
        motivoSospecha: inyeccion.motivos.join("; ") || undefined,
      });
    };
    for (const p of parrafos) {
      if (longitud + p.length > opciones.caracteresObjetivo && actual.length) {
        emitir();
        const previo = actual.join("\n\n");
        const cola = previo.slice(Math.max(0, previo.length - Math.round(opciones.caracteresObjetivo * opciones.solape)));
        const corte = cola.indexOf(" ");
        actual = [corte > 0 ? `…${cola.slice(corte + 1)}` : cola];
        longitud = actual[0].length;
      }
      actual.push(p);
      longitud += p.length;
    }
    emitir();
  }
  return fragmentos;
}
