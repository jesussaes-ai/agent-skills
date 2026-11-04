/**
 * Números adicionales a partir del nombre y la fecha de nacimiento.
 *
 * Convenciones:
 * - Madurez = reducir(camino de vida + expresión), usando los valores del motor
 *   base tal cual (si son maestros, se suman como 11/22/33).
 * - Día de nacimiento = reducir(día) con la configuración (29 → 11 si los maestros están activos).
 * - Actitud = reducir(día + mes) sumados SIN reducir antes (15 + 7 = 22).
 * - Tabla de inclusión (plano de expresión): cuántas letras del nombre
 *   normalizado valen 1, 2, … 9 en la tabla pitagórica.
 * - Números kármicos ausentes: los del 1 al 9 con 0 letras en la tabla de inclusión.
 */
import { CONFIG_POR_DEFECTO } from "../config";
import { validarFecha } from "../fecha";
import { calcularNumerologia } from "../motor";
import { reducir } from "../reducir";
import { valorLetra } from "../tabla";
import type { ConfigNumerologia, ErrorNumerologia, Paso } from "../tipos";
import { crearIndicador, metadatos } from "./comun";
import type { ConteoInclusion, ResultadoNumerosAdicionales } from "./tipos";

export function numerosAdicionales(
  nombre: string,
  fecha: string,
  config: ConfigNumerologia = CONFIG_POR_DEFECTO,
): ResultadoNumerosAdicionales | ErrorNumerologia {
  const errores: string[] = [];
  if (!nombre?.trim()) errores.push("Escribe el nombre de nacimiento.");
  if (!fecha?.trim()) errores.push("Escribe la fecha de nacimiento.");
  if (errores.length) return { ok: false, errores };

  const base = calcularNumerologia({ nombre, fecha }, config);
  if (!base.ok) return base;
  const v = validarFecha(fecha);
  if (!v.ok) return { ok: false, errores: [v.error] };
  const f = v.fecha;
  const valor = (clave: string) => base.indicadores.find((i) => i.clave === clave)?.valor;
  const cv = valor("caminoDeVida");
  const ex = valor("expresion");
  if (cv === undefined || ex === undefined) {
    return { ok: false, errores: ["No se pudieron calcular el camino de vida y la expresión."] };
  }

  // Madurez
  const sumaMad = cv + ex;
  const rMad = reducir(sumaMad, config);
  const madurez = crearIndicador(
    "madurez",
    "Número de madurez",
    "Camino de vida + expresión, sumados y reducidos.",
    rMad.valor,
    [
      { descripcion: "Camino de vida", operacion: String(cv) },
      { descripcion: "Expresión", operacion: String(ex) },
      { descripcion: "Suma", operacion: `${cv} + ${ex} = ${sumaMad}` },
      ...rMad.pasos,
    ],
    config,
  );

  // Día de nacimiento
  const rDia = reducir(f.dia, config, "Día: reducción");
  const diaDeNacimiento = crearIndicador(
    "diaDeNacimiento",
    "Número del día de nacimiento",
    "El día del mes en que nació, reducido.",
    rDia.valor,
    [{ descripcion: "Día de nacimiento", operacion: String(f.dia) }, ...rDia.pasos],
    config,
  );

  // Actitud
  const sumaAct = f.dia + f.mes;
  const rAct = reducir(sumaAct, config);
  const actitud = crearIndicador(
    "actitud",
    "Número de actitud",
    "Día + mes de nacimiento (sin reducir antes), sumados y reducidos.",
    rAct.valor,
    [{ descripcion: "Día + mes", operacion: `${f.dia} + ${f.mes} = ${sumaAct}` }, ...rAct.pasos],
    config,
  );

  // Tabla de inclusión
  const letras = (base.entradas.palabras ?? []).flatMap((p) => [...p]);
  const conteos: ConteoInclusion[] = Array.from({ length: 9 }, (_, i) => ({ numero: i + 1, cantidad: 0, letras: [] }));
  for (const l of letras) {
    const c = conteos[valorLetra(l) - 1];
    c.cantidad += 1;
    c.letras.push(l);
  }
  const pasosTabla: Paso[] = [
    { descripcion: "Letras con su valor", operacion: letras.map((l) => `${l}(${valorLetra(l)})`).join(" ") },
    ...conteos.map((c) => ({
      descripcion: `Cantidad de ${c.numero}`,
      operacion: c.cantidad ? `${c.letras.join(", ")} → ${c.cantidad}` : "0",
    })),
    { descripcion: "Total de letras", operacion: `${conteos.map((c) => c.cantidad).join(" + ")} = ${letras.length}` },
  ];

  const ausentes = conteos.filter((c) => c.cantidad === 0).map((c) => c.numero);
  const pasosKarma: Paso[] = [
    {
      descripcion: "Números del 1 al 9 sin ninguna letra en el nombre",
      operacion: ausentes.length ? ausentes.join(", ") : "Ninguno (aparecen todos)",
    },
  ];

  return {
    ok: true,
    ...metadatos(config),
    entradas: { nombreOriginal: nombre.trim(), nombreNormalizado: base.entradas.nombreNormalizado ?? "", fecha: fecha.trim() },
    cambios: base.cambios,
    advertencias: base.advertencias,
    madurez,
    diaDeNacimiento,
    actitud,
    tablaDeInclusion: { conteos, totalLetras: letras.length, pasos: pasosTabla },
    karmicosAusentes: { numeros: ausentes, pasos: pasosKarma },
  };
}
