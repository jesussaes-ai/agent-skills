/**
 * Ciclo personal (año, mes y día personal) — método pitagórico estándar.
 *
 * Convención (configurable con `opciones.inicioAnio`):
 * - "calendario" (por defecto): el «año en curso» es el año calendario de la fecha
 *   de consulta; el año personal cambia el 1 de enero.
 * - "cumpleanos": el año personal cambia el día del cumpleaños; si la fecha de
 *   consulta es anterior al cumpleaños de ese año, se usa el año anterior.
 *   Quien nació un 29 de febrero, en años no bisiestos cumple el 1 de marzo.
 *   El mes y el día personal siguen usando el mes y el día del calendario.
 *
 * Fórmulas (igual que el camino de vida «por componentes»: cada componente se
 * reduce por separado y respeta los números maestros de la configuración):
 *   año personal = reducir( reducir(día nac.) + reducir(mes nac.) + reducir(año en curso) )
 *   mes personal = reducir( año personal + reducir(mes en curso) )
 *   día personal = reducir( mes personal + reducir(día en curso) )
 * Si el año o el mes personal son maestros (11, 22, 33) se suman tal cual.
 * La fecha de consulta no puede ser anterior a la de nacimiento.
 */
import { CONFIG_POR_DEFECTO } from "../config";
import { validarFecha } from "../fecha";
import { reducir } from "../reducir";
import type { ConfigNumerologia, ErrorNumerologia, Paso } from "../tipos";
import { componente, crearIndicador, esBisiesto, metadatos } from "./comun";
import type { OpcionesCicloPersonal, ResultadoCicloPersonal } from "./tipos";

const comparar = (a: [number, number, number], b: [number, number, number]) =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function cicloPersonal(
  fechaNacimiento: string,
  fechaConsulta: string,
  config: ConfigNumerologia = CONFIG_POR_DEFECTO,
  opciones: OpcionesCicloPersonal = {},
): ResultadoCicloPersonal | ErrorNumerologia {
  const inicioAnio = opciones.inicioAnio ?? "calendario";
  const errores: string[] = [];
  const vn = validarFecha(fechaNacimiento ?? "");
  const vc = validarFecha(fechaConsulta ?? "");
  if (!vn.ok) errores.push(`Fecha de nacimiento: ${vn.error}`);
  if (!vc.ok) errores.push(`Fecha de consulta: ${vc.error}`);
  if (!vn.ok || !vc.ok) return { ok: false, errores };
  const n = vn.fecha;
  const c = vc.fecha;
  if (comparar([c.anio, c.mes, c.dia], [n.anio, n.mes, n.dia]) < 0) {
    return { ok: false, errores: ["La fecha de consulta es anterior a la fecha de nacimiento."] };
  }

  const advertencias: string[] = [];
  const pasosAnio: Paso[] = [];
  let anioUsado = c.anio;
  if (inicioAnio === "cumpleanos") {
    const cumple: [number, number] =
      n.mes === 2 && n.dia === 29 && !esBisiesto(c.anio) ? [3, 1] : [n.mes, n.dia];
    if (n.mes === 2 && n.dia === 29 && !esBisiesto(c.anio)) {
      advertencias.push(`${c.anio} no es bisiesto: el cumpleaños del 29 de febrero se toma el 1 de marzo.`);
    }
    const antes = comparar([0, c.mes, c.dia], [0, cumple[0], cumple[1]]) < 0;
    if (antes) anioUsado = c.anio - 1;
    pasosAnio.push({
      descripcion: "Año en curso (desde el cumpleaños)",
      operacion: antes
        ? `${c.dia}/${c.mes}/${c.anio} es antes del cumpleaños (${cumple[1]}/${cumple[0]}): se usa ${anioUsado}`
        : `${c.dia}/${c.mes}/${c.anio} es el cumpleaños o después (${cumple[1]}/${cumple[0]}): se usa ${anioUsado}`,
    });
  } else {
    pasosAnio.push({ descripcion: "Año en curso (año calendario)", operacion: `Se usa ${anioUsado}` });
  }

  const d = componente("Día de nacimiento", n.dia, config, pasosAnio);
  const m = componente("Mes de nacimiento", n.mes, config, pasosAnio);
  const a = componente("Año en curso", anioUsado, config, pasosAnio);
  const sumaAnio = d + m + a;
  pasosAnio.push({ descripcion: "Suma de día + mes + año en curso reducidos", operacion: `${d} + ${m} + ${a} = ${sumaAnio}` });
  const rAnio = reducir(sumaAnio, config);
  const anioPersonal = crearIndicador(
    "anioPersonal",
    "Año personal",
    "Día y mes de nacimiento más el año en curso, cada uno reducido; se suman y se reduce.",
    rAnio.valor,
    [...pasosAnio, ...rAnio.pasos],
    config,
  );

  const pasosMes: Paso[] = [{ descripcion: "Año personal", operacion: String(anioPersonal.valor) }];
  const mc = componente("Mes en curso", c.mes, config, pasosMes);
  const sumaMes = anioPersonal.valor + mc;
  pasosMes.push({ descripcion: "Suma de año personal + mes en curso", operacion: `${anioPersonal.valor} + ${mc} = ${sumaMes}` });
  const rMes = reducir(sumaMes, config);
  const mesPersonal = crearIndicador(
    "mesPersonal",
    "Mes personal",
    "Año personal más el mes en curso reducido; se suma y se reduce.",
    rMes.valor,
    [...pasosMes, ...rMes.pasos],
    config,
  );

  const pasosDia: Paso[] = [{ descripcion: "Mes personal", operacion: String(mesPersonal.valor) }];
  const dc = componente("Día en curso", c.dia, config, pasosDia);
  const sumaDia = mesPersonal.valor + dc;
  pasosDia.push({ descripcion: "Suma de mes personal + día en curso", operacion: `${mesPersonal.valor} + ${dc} = ${sumaDia}` });
  const rDia = reducir(sumaDia, config);
  const diaPersonal = crearIndicador(
    "diaPersonal",
    "Día personal",
    "Mes personal más el día en curso reducido; se suma y se reduce.",
    rDia.valor,
    [...pasosDia, ...rDia.pasos],
    config,
  );

  return {
    ok: true,
    ...metadatos(config),
    opciones: { inicioAnio },
    entradas: { fechaNacimiento: fechaNacimiento.trim(), fechaConsulta: fechaConsulta.trim(), anioUsado },
    advertencias,
    anioPersonal,
    mesPersonal,
    diaPersonal,
  };
}
