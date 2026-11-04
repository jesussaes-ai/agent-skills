/**
 * Pináculos, desafíos y ciclos de vida.
 *
 * Convenciones:
 * - Componentes: día, mes y año de nacimiento reducidos a UN dígito (1–9),
 *   sin conservar maestros (29 → 11 → 2), para pináculos y desafíos.
 * - Camino de vida: el del motor base (respeta la configuración); para las
 *   edades se reduce a un dígito (11 → 2, 22 → 4, 33 → 6).
 * - Edades: fin del 1.er pináculo = 36 − camino de vida (un dígito).
 *   P1: 0 → A; P2: A → A+9; P3: A+9 → A+18; P4: A+18 en adelante.
 *   `edadFin` es la edad en la que empieza el periodo siguiente.
 * - Pináculos (la suma se reduce con la configuración: puede dar 11/22/33):
 *   P1 = mes + día; P2 = día + año; P3 = P1 + P2; P4 = mes + año.
 * - Desafíos (resta absoluta, valores 0–8, sin reducción):
 *   D1 = |mes − día|; D2 = |día − año|; D3 = |D1 − D2|; D4 = |mes − año|.
 *   Mismas edades que los pináculos.
 * - Ciclos de vida: C1 = mes, C2 = día, C3 = año, cada uno reducido con la
 *   configuración (puede conservar maestros, p. ej. día 29 → 11).
 *   Edades por defecto ("pinaculos"): C1 0 → A; C2 A → A+27; C3 A+27 en adelante.
 *   Alternativa "fijas-28": 0 → 28; 28 → 56; 56 en adelante.
 */
import { CONFIG_POR_DEFECTO } from "../config";
import { validarFecha, type FechaValida } from "../fecha";
import { calcularNumerologia } from "../motor";
import { reducir } from "../reducir";
import type { ConfigNumerologia, ErrorNumerologia, Paso } from "../tipos";
import { componente, crearIndicador, metadatos, reducirAUnDigito } from "./comun";
import type {
  IndicadorConPeriodo,
  OpcionesCiclosDeVida,
  ResultadoCiclosDeVida,
  ResultadoPinaculosYDesafios,
} from "./tipos";

function periodo(numero: number, edadInicio: number, edadFin: number | null, anioNacimiento: number) {
  return {
    numero,
    edadInicio,
    edadFin,
    anioInicio: anioNacimiento + edadInicio,
    anioFin: edadFin === null ? null : anioNacimiento + edadFin,
  };
}

const textoEdades = (inicio: number, fin: number | null) =>
  fin === null ? `De los ${inicio} años en adelante` : `De los ${inicio} a los ${fin} años`;

function caminoDeVidaUnDigito(fecha: string, config: ConfigNumerologia) {
  const r = calcularNumerologia({ fecha }, config);
  if (!r.ok) return r;
  const cv = r.indicadores.find((i) => i.clave === "caminoDeVida");
  if (!cv) return { ok: false as const, errores: ["No se pudo calcular el camino de vida."] };
  const pasos: Paso[] = [...cv.pasos];
  let unDigito = cv.valor;
  if (cv.valor > 9) {
    const u = reducirAUnDigito(cv.valor, config, "Camino de vida a un dígito (para las edades)");
    pasos.push(...u.pasos);
    unDigito = u.valor;
  }
  return { ok: true as const, valor: cv.valor, unDigito, pasos };
}

function validar(fechaNacimiento: string): { ok: true; f: FechaValida } | ErrorNumerologia {
  const v = validarFecha(fechaNacimiento ?? "");
  return v.ok ? { ok: true, f: v.fecha } : { ok: false, errores: [`Fecha de nacimiento: ${v.error}`] };
}

export function pinaculosYDesafios(
  fechaNacimiento: string,
  config: ConfigNumerologia = CONFIG_POR_DEFECTO,
): ResultadoPinaculosYDesafios | ErrorNumerologia {
  const v = validar(fechaNacimiento);
  if (!v.ok) return v;
  const f = v.f;
  const cv = caminoDeVidaUnDigito(fechaNacimiento.trim(), config);
  if (!cv.ok) return cv;

  const pasosComp: Paso[] = [];
  const dia = componente("Día", f.dia, config, pasosComp, true);
  const mes = componente("Mes", f.mes, config, pasosComp, true);
  const anio = componente("Año", f.anio, config, pasosComp, true);

  const A = 36 - cv.unDigito;
  const pasoA: Paso = { descripcion: "Fin del primer periodo", operacion: `36 − ${cv.unDigito} = ${A}` };
  const limites: [number, number | null][] = [
    [0, A],
    [A, A + 9],
    [A + 9, A + 18],
    [A + 18, null],
  ];

  const pin = (numero: number, etiqueta: string, x: number, y: number): IndicadorConPeriodo => {
    const suma = x + y;
    const r = reducir(suma, config);
    const [ini, fin] = limites[numero - 1];
    const pasos: Paso[] = [
      { descripcion: `Pináculo ${numero}: ${etiqueta}`, operacion: `${x} + ${y} = ${suma}` },
      ...r.pasos,
      ...(numero === 1 || numero === 2 ? [pasoA] : []),
      { descripcion: "Edades", operacion: textoEdades(ini, fin) },
    ];
    return {
      ...crearIndicador("pinaculo", `Pináculo ${numero}`, `Se calcula como ${etiqueta} y se reduce.`, r.valor, pasos, config),
      ...periodo(numero, ini, fin, f.anio),
    };
  };
  const p1 = pin(1, "mes + día", mes, dia);
  const p2 = pin(2, "día + año", dia, anio);
  const p3 = pin(3, "pináculo 1 + pináculo 2", p1.valor, p2.valor);
  const p4 = pin(4, "mes + año", mes, anio);

  const des = (numero: number, etiqueta: string, x: number, y: number): IndicadorConPeriodo => {
    const valor = Math.abs(x - y);
    const [ini, fin] = limites[numero - 1];
    const pasos: Paso[] = [
      { descripcion: `Desafío ${numero}: ${etiqueta}`, operacion: `|${x} − ${y}| = ${valor}` },
      { descripcion: "Edades", operacion: textoEdades(ini, fin) },
    ];
    return {
      clave: "desafio",
      nombre: `Desafío ${numero}`,
      descripcion: `Resta absoluta ${etiqueta}, sin reducción (valores 0–8).`,
      valor,
      esMaestro: false,
      pasos,
      ...periodo(numero, ini, fin, f.anio),
    };
  };
  const d1 = des(1, "|mes − día|", mes, dia);
  const d2 = des(2, "|día − año|", dia, anio);
  const d3 = des(3, "|desafío 1 − desafío 2|", d1.valor, d2.valor);
  const d4 = des(4, "|mes − año|", mes, anio);

  return {
    ok: true,
    ...metadatos(config),
    entradas: { fechaNacimiento: fechaNacimiento.trim() },
    caminoDeVida: { valor: cv.valor, unDigito: cv.unDigito, pasos: cv.pasos },
    componentes: { dia, mes, anio, pasos: pasosComp },
    pinaculos: [p1, p2, p3, p4],
    desafios: [d1, d2, d3, d4],
  };
}

export function ciclosDeVida(
  fechaNacimiento: string,
  config: ConfigNumerologia = CONFIG_POR_DEFECTO,
  opciones: OpcionesCiclosDeVida = {},
): ResultadoCiclosDeVida | ErrorNumerologia {
  const edades = opciones.edades ?? "pinaculos";
  const v = validar(fechaNacimiento);
  if (!v.ok) return v;
  const f = v.f;

  let limites: [number, number | null][];
  let pasoLimite: Paso;
  if (edades === "fijas-28") {
    limites = [
      [0, 28],
      [28, 56],
      [56, null],
    ];
    pasoLimite = { descripcion: "Edades fijas", operacion: "0 → 28 → 56 → en adelante" };
  } else {
    const cv = caminoDeVidaUnDigito(fechaNacimiento.trim(), config);
    if (!cv.ok) return cv;
    const A = 36 - cv.unDigito;
    limites = [
      [0, A],
      [A, A + 27],
      [A + 27, null],
    ];
    pasoLimite = { descripcion: "Fin del primer ciclo (36 − camino de vida a un dígito)", operacion: `36 − ${cv.unDigito} = ${A}` };
  }

  const datos: [string, number][] = [
    ["mes de nacimiento", f.mes],
    ["día de nacimiento", f.dia],
    ["año de nacimiento", f.anio],
  ];
  const ciclos = datos.map(([etiqueta, n], i): IndicadorConPeriodo => {
    const pasos: Paso[] = [];
    const valor = componente(`Ciclo ${i + 1}: ${etiqueta}`, n, config, pasos);
    const [ini, fin] = limites[i];
    if (i < 2) pasos.push(pasoLimite);
    pasos.push({ descripcion: "Edades", operacion: textoEdades(ini, fin) });
    return {
      ...crearIndicador("cicloDeVida", `Ciclo de vida ${i + 1}`, `Se calcula reduciendo el ${etiqueta}.`, valor, pasos, config),
      ...periodo(i + 1, ini, fin, f.anio),
    };
  });

  return {
    ok: true,
    ...metadatos(config),
    opciones: { edades },
    entradas: { fechaNacimiento: fechaNacimiento.trim() },
    ciclos,
  };
}
