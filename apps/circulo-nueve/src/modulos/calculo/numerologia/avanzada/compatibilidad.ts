/**
 * Compatibilidad numerológica: SOLO compara datos calculados.
 *
 * Para camino de vida, expresión, alma y personalidad de dos personas se dan
 * los dos números, la diferencia absoluta y una etiqueta descriptiva:
 *   diferencia 0                                   → «misma vibración»
 *   complementariosMin ≤ diferencia ≤ complementariosMax (1–2 por defecto) → «complementarios»
 *   cualquier otra diferencia                      → «distintos»
 * Convención configurable: con `reducirMaestrosAlComparar` (true por defecto)
 * los maestros se reducen a un dígito antes de restar (11 → 2, 22 → 4, 33 → 6).
 * No hay porcentajes ni juicios de valor.
 */
import { CONFIG_POR_DEFECTO } from "../config";
import { calcularNumerologia } from "../motor";
import type { ConfigNumerologia, ErrorNumerologia, Paso } from "../tipos";
import { metadatos, reducirAUnDigito } from "./comun";
import type {
  ClaveComparada,
  ConvencionCompatibilidad,
  EtiquetaCompatibilidad,
  ParComparado,
  PersonaCompatibilidad,
  ResultadoCompatibilidad,
} from "./tipos";

export const CONVENCION_COMPATIBILIDAD_POR_DEFECTO: ConvencionCompatibilidad = Object.freeze({
  reducirMaestrosAlComparar: true,
  complementariosMin: 1,
  complementariosMax: 2,
});

const TEXTO_ETIQUETA: Record<EtiquetaCompatibilidad, string> = {
  "misma-vibracion": "misma vibración",
  complementarios: "complementarios",
  distintos: "distintos",
};

const COMPARADOS: [ClaveComparada, string][] = [
  ["caminoDeVida", "Camino de vida"],
  ["expresion", "Expresión (destino)"],
  ["alma", "Alma (impulso del alma)"],
  ["personalidad", "Personalidad"],
];

export function etiquetarDiferencia(diferencia: number, convencion: ConvencionCompatibilidad): EtiquetaCompatibilidad {
  if (diferencia === 0) return "misma-vibracion";
  if (diferencia >= convencion.complementariosMin && diferencia <= convencion.complementariosMax) return "complementarios";
  return "distintos";
}

export function compatibilidadNumerologica(
  a: PersonaCompatibilidad,
  b: PersonaCompatibilidad,
  config: ConfigNumerologia = CONFIG_POR_DEFECTO,
  convencionParcial: Partial<ConvencionCompatibilidad> = {},
): ResultadoCompatibilidad | ErrorNumerologia {
  const convencion: ConvencionCompatibilidad = { ...CONVENCION_COMPATIBILIDAD_POR_DEFECTO, ...convencionParcial };
  const ra = calcularNumerologia(a ?? {}, config);
  const rb = calcularNumerologia(b ?? {}, config);
  const errores = [
    ...(ra.ok ? [] : ra.errores.map((e) => `Persona A: ${e}`)),
    ...(rb.ok ? [] : rb.errores.map((e) => `Persona B: ${e}`)),
  ];
  if (!ra.ok || !rb.ok) return { ok: false, errores };

  const advertencias = [
    ...ra.advertencias.map((e) => `Persona A: ${e}`),
    ...rb.advertencias.map((e) => `Persona B: ${e}`),
  ];

  const aComparar = (v: number, quien: string, pasos: Paso[]) => {
    if (!convencion.reducirMaestrosAlComparar || v <= 9) return v;
    const r = reducirAUnDigito(v, config, `Persona ${quien}: maestro reducido para comparar`);
    pasos.push(...r.pasos);
    return r.valor;
  };

  const pares = COMPARADOS.map(([clave, nombre]): ParComparado => {
    const va = ra.indicadores.find((i) => i.clave === clave)?.valor ?? null;
    const vb = rb.indicadores.find((i) => i.clave === clave)?.valor ?? null;
    if (va === null || vb === null) {
      advertencias.push(`${nombre}: falta en ${va === null && vb === null ? "ambas personas" : va === null ? "la persona A" : "la persona B"}; no se compara.`);
      return { clave, nombre, a: va, b: vb, comparadoA: null, comparadoB: null, diferencia: null, etiqueta: null, etiquetaTexto: null, pasos: [] };
    }
    const pasos: Paso[] = [{ descripcion: `${nombre}: valores`, operacion: `A = ${va}; B = ${vb}` }];
    const ca = aComparar(va, "A", pasos);
    const cb = aComparar(vb, "B", pasos);
    const diferencia = Math.abs(ca - cb);
    const etiqueta = etiquetarDiferencia(diferencia, convencion);
    pasos.push(
      { descripcion: "Diferencia", operacion: `|${ca} − ${cb}| = ${diferencia}` },
      {
        descripcion: "Etiqueta (convención)",
        operacion: `0 → misma vibración; ${convencion.complementariosMin}–${convencion.complementariosMax} → complementarios; otra → distintos: ${TEXTO_ETIQUETA[etiqueta]}`,
      },
    );
    return { clave, nombre, a: va, b: vb, comparadoA: ca, comparadoB: cb, diferencia, etiqueta, etiquetaTexto: TEXTO_ETIQUETA[etiqueta], pasos };
  });

  return { ok: true, ...metadatos(config), convencion, advertencias, pares };
}
