import { CONFIG_POR_DEFECTO, MOTOR, MOTOR_VERSION, REGLAS_VERSION, TRADICION } from "./config";
import { validarFecha, type FechaValida } from "./fecha";
import { normalizarNombre } from "./normalizar";
import { esMaestro, reducir } from "./reducir";
import { VOCALES_BASE, valorLetra } from "./tabla";
import type {
  ClaveIndicador,
  ConfigNumerologia,
  EntradaNumerologia,
  ErrorNumerologia,
  Indicador,
  Paso,
  ResultadoNumerologia,
} from "./tipos";

const DESCRIPCIONES: Record<ClaveIndicador, { nombre: string; descripcion: string }> = {
  caminoDeVida: { nombre: "Camino de vida", descripcion: "Se calcula con la fecha de nacimiento." },
  expresion: { nombre: "Expresión (destino)", descripcion: "Se calcula con todas las letras del nombre de nacimiento." },
  alma: { nombre: "Alma (impulso del alma)", descripcion: "Se calcula con las vocales del nombre de nacimiento." },
  personalidad: { nombre: "Personalidad", descripcion: "Se calcula con las consonantes del nombre de nacimiento." },
};

function esVocal(letra: string, config: ConfigNumerologia): boolean {
  return VOCALES_BASE.has(letra) || (letra === "Y" && config.y === "vocal");
}

function indicador(clave: ClaveIndicador, valor: number, pasos: Paso[], config: ConfigNumerologia): Indicador {
  return { clave, ...DESCRIPCIONES[clave], valor, esMaestro: esMaestro(valor, config), pasos };
}

function indicadorDeNombre(
  clave: Exclude<ClaveIndicador, "caminoDeVida">,
  palabras: string[],
  filtro: (letra: string) => boolean,
  config: ConfigNumerologia,
): Indicador | null {
  const porPalabra = palabras
    .map((p) => [...p].filter(filtro))
    .filter((letras) => letras.length > 0);
  if (!porPalabra.length) return null;

  const pasos: Paso[] = [];
  const detalle = (letras: string[]) => letras.map((l) => `${l}(${valorLetra(l)})`).join(" ");
  const suma = (letras: string[]) => letras.reduce((acc, l) => acc + valorLetra(l), 0);

  if (config.metodoNombre === "total") {
    const letras = porPalabra.flat();
    const total = suma(letras);
    pasos.push({ descripcion: "Letras con su valor", operacion: detalle(letras) });
    pasos.push({ descripcion: "Suma", operacion: `${letras.map(valorLetra).join(" + ")} = ${total}` });
    const r = reducir(total, config);
    return indicador(clave, r.valor, [...pasos, ...r.pasos], config);
  }

  const subtotales = porPalabra.map((letras, i) => {
    const total = suma(letras);
    pasos.push({ descripcion: `Palabra ${i + 1}: letras`, operacion: detalle(letras) });
    pasos.push({ descripcion: `Palabra ${i + 1}: suma`, operacion: `${letras.map(valorLetra).join(" + ")} = ${total}` });
    const r = reducir(total, config, `Palabra ${i + 1}: reducción`);
    pasos.push(...r.pasos);
    return r.valor;
  });
  const total = subtotales.reduce((a, b) => a + b, 0);
  pasos.push({ descripcion: "Suma de palabras", operacion: `${subtotales.join(" + ")} = ${total}` });
  const r = reducir(total, config);
  return indicador(clave, r.valor, [...pasos, ...r.pasos], config);
}

function caminoDeVida(f: FechaValida, config: ConfigNumerologia): Indicador {
  const pasos: Paso[] = [];
  if (config.metodoCaminoDeVida === "suma-de-digitos") {
    const digitos = [...`${String(f.anio).padStart(4, "0")}${String(f.mes).padStart(2, "0")}${String(f.dia).padStart(2, "0")}`];
    const total = digitos.reduce((acc, d) => acc + Number(d), 0);
    pasos.push({ descripcion: "Suma de todos los dígitos", operacion: `${digitos.join(" + ")} = ${total}` });
    const r = reducir(total, config);
    return indicador("caminoDeVida", r.valor, [...pasos, ...r.pasos], config);
  }

  const componentes = (
    [
      ["Día", f.dia],
      ["Mes", f.mes],
      ["Año", f.anio],
    ] as const
  ).map(([etiqueta, n]) => {
    const r = reducir(n, config, `${etiqueta}: reducción`);
    pasos.push({ descripcion: etiqueta, operacion: String(n) }, ...r.pasos);
    return r.valor;
  });
  const total = componentes.reduce((a, b) => a + b, 0);
  pasos.push({ descripcion: "Suma de día + mes + año reducidos", operacion: `${componentes.join(" + ")} = ${total}` });
  const r = reducir(total, config);
  return indicador("caminoDeVida", r.valor, [...pasos, ...r.pasos], config);
}

export function calcularNumerologia(
  entrada: EntradaNumerologia,
  config: ConfigNumerologia = CONFIG_POR_DEFECTO,
): ResultadoNumerologia | ErrorNumerologia {
  const nombre = entrada.nombre?.trim() ?? "";
  const fechaTexto = entrada.fecha?.trim() ?? "";
  if (!nombre && !fechaTexto) {
    return { ok: false, errores: ["Escribe al menos el nombre de nacimiento o la fecha de nacimiento."] };
  }

  const errores: string[] = [];
  const advertencias: string[] = [];
  const indicadores: Indicador[] = [];
  let resultadoNombre: ReturnType<typeof normalizarNombre> | undefined;
  let fecha: FechaValida | undefined;

  if (nombre) {
    resultadoNombre = normalizarNombre(nombre, config);
    if (!resultadoNombre.ok) errores.push(...resultadoNombre.errores);
  } else {
    advertencias.push("Sin nombre de nacimiento: no se calculan expresión, alma ni personalidad.");
  }

  if (fechaTexto) {
    const v = validarFecha(fechaTexto);
    if (v.ok) fecha = v.fecha;
    else errores.push(v.error);
  } else {
    advertencias.push("Sin fecha de nacimiento: no se calcula el camino de vida.");
  }

  if (errores.length) return { ok: false, errores };

  if (fecha) indicadores.push(caminoDeVida(fecha, config));

  const palabras = resultadoNombre?.ok ? resultadoNombre.palabras : undefined;
  if (palabras) {
    const expresion = indicadorDeNombre("expresion", palabras, () => true, config);
    if (expresion) indicadores.push(expresion);
    const alma = indicadorDeNombre("alma", palabras, (l) => esVocal(l, config), config);
    if (alma) indicadores.push(alma);
    else advertencias.push("El nombre no tiene vocales según las reglas configuradas: no se calcula el alma.");
    const personalidad = indicadorDeNombre("personalidad", palabras, (l) => !esVocal(l, config), config);
    if (personalidad) indicadores.push(personalidad);
    else advertencias.push("El nombre no tiene consonantes según las reglas configuradas: no se calcula la personalidad.");
    if (palabras.some((p) => p.includes("Y"))) {
      advertencias.push(
        `La letra Y se contó como ${config.y} (regla configurable; las tradiciones difieren).`,
      );
    }
  }

  return {
    ok: true,
    motor: MOTOR,
    motorVersion: MOTOR_VERSION,
    tradicion: TRADICION,
    reglasVersion: REGLAS_VERSION,
    reglas: config,
    entradas: {
      nombreOriginal: nombre || undefined,
      nombreNormalizado: palabras?.join(" "),
      palabras,
      fecha: fechaTexto || undefined,
    },
    cambios: resultadoNombre?.ok ? resultadoNombre.cambios : [],
    advertencias,
    indicadores,
  };
}