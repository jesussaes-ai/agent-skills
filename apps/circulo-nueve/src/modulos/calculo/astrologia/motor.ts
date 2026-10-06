import { anchoRango, formatoSegunPrecision, normalizar, rangoDe, signoDe, signosEnRango } from "./angulos";
import { calcularAspectos, type PuntoParaAspecto } from "./aspectos";
import { ayanamsaMedia } from "./ayanamsa";
import { calcularCasas, casaDe, limitePolar } from "./casas";
import {
  CUERPOS,
  EXACTITUD_MOTOR_GRADOS,
  MOTOR,
  MOTOR_VERSION,
  NOMBRES_AYANAMSA,
  NOMBRES_SISTEMA_CASAS,
  PUNTOS_ANGULARES,
  REGLAS_VERSION,
  crearConfig,
} from "./config";
import { motorAstronomyEngine, type MotorEfemerides } from "./efemerides";
import { candidatosUtc, construirConversion, esZonaValida, leerFecha, leerHora, textoDesfase } from "./tiempo";
import type {
  ConfigAstrologia,
  CuspideCasa,
  EntradaCarta,
  ErrorCarta,
  Paso,
  PosicionCalculada,
  ResultadoCarta,
  ResultadoCasas,
} from "./tipos";

export const ANIO_MINIMO = 1800;
export const ANIO_MAXIMO = 2100;
const DIA_MS = 86_400_000;
const MINUTO_MS = 60_000;

function muestrasDeTiempo(centro: number, margenMin: number, n: number): number[] {
  if (margenMin <= 0) return [centro];
  return Array.from({ length: n }, (_, i) => centro + (-1 + (2 * i) / (n - 1)) * margenMin * MINUTO_MS);
}

function validar(entrada: EntradaCarta): string[] {
  const errores: string[] = [];
  const fecha = leerFecha(entrada.fecha ?? "");
  if (!fecha) errores.push("La fecha debe tener el formato AAAA-MM-DD y existir en el calendario.");
  else if (fecha.anio < ANIO_MINIMO || fecha.anio > ANIO_MAXIMO)
    errores.push(`Solo se calculan fechas entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}.`);
  if (entrada.precisionHora !== "desconocida" && !leerHora(entrada.hora ?? ""))
    errores.push("Indica la hora local como HH:MM (24 h) o marca la hora como desconocida.");
  const l = entrada.lugar;
  if (l && (!(Math.abs(l.latitud) <= 90) || !(Math.abs(l.longitud) <= 180)))
    errores.push("Las coordenadas del lugar no son válidas (latitud ±90°, longitud ±180°).");
  const zona = entrada.zonaHoraria || l?.zonaHoraria;
  if (!zona) errores.push("Falta la zona horaria: elige el lugar de nacimiento o indica la zona IANA (p. ej. America/Mexico_City). No se adivina.");
  else if (!esZonaValida(zona)) errores.push(`La zona horaria «${zona}» no existe en la base IANA de este entorno.`);
  return errores;
}

export function calcularCartaNatal(
  entrada: EntradaCarta,
  parcial: Partial<ConfigAstrologia> = {},
  motor: MotorEfemerides = motorAstronomyEngine,
): ResultadoCarta | ErrorCarta {
  const errores = validar(entrada);
  if (errores.length) return { ok: false, errores };

  const config = crearConfig(parcial);
  const advertencias: string[] = [];
  const pasos: Paso[] = [];
  const sinHora = entrada.precisionHora === "desconocida";
  const fecha = leerFecha(entrada.fecha)!;
  const hora = sinHora ? { hora: 12, minuto: 0, segundo: 0 } : leerHora(entrada.hora!)!;
  const zona = (entrada.zonaHoraria || entrada.lugar?.zonaHoraria)!;
  const fuenteZona = entrada.zonaHoraria
    ? "Indicada por la persona"
    : entrada.lugar?.fuente.tipo === "geonames"
      ? "GeoNames (zona IANA asociada al lugar)"
      : "Asociada al lugar";

  // 1. Hora local → UT con la historia de la tzdb.
  const candidatos = candidatosUtc(zona, { ...fecha, ...hora });
  if (candidatos.estado === "inexistente") {
    return {
      ok: false,
      errores: [
        `La hora ${entrada.hora} no existió en ${zona} el ${entrada.fecha}: ese día el reloj se adelantó (inicio del horario de verano u otro cambio oficial). Verifica la hora en el acta o indica la zona horaria manualmente.`,
      ],
    };
  }
  let indice = 0;
  if (candidatos.estado === "repetida") {
    if (!entrada.ocurrencia) {
      return {
        ok: false,
        errores: [
          `La hora ${entrada.hora} se repitió en ${zona} el ${entrada.fecha} (el reloj se atrasó). Elige cuál de las dos ocurrencias corresponde.`,
        ],
        opcionesHoraRepetida: candidatos.utcMs.map((u, i) => ({
          ocurrencia: i === 0 ? ("primera" as const) : ("segunda" as const),
          utc: new Date(u).toISOString(),
          desfaseTexto: textoDesfase(candidatos.desfasesSeg[i]),
        })),
      };
    }
    indice = entrada.ocurrencia === "primera" ? 0 : 1;
  }
  const tiempo = construirConversion(zona, fuenteZona, candidatos, indice);
  const utcMs = candidatos.utcMs[indice];
  const margenMin = sinHora ? 720 : entrada.precisionHora === "aproximada" ? config.margenAproximadaMin : config.margenExactaMin;

  pasos.push(
    { descripcion: "Hora local", valor: `${entrada.fecha} ${sinHora ? "12:00 (referencia: hora desconocida)" : entrada.hora}` },
    { descripcion: "Zona horaria", valor: `${zona} · ${fuenteZona}` },
    { descripcion: "Desfase aplicado", valor: `${tiempo.desfaseTexto} (${tiempo.versionTzdb})` },
    { descripcion: "Tiempo universal (UT)", valor: tiempo.utc },
    { descripcion: "Día juliano (UT)", valor: (utcMs / DIA_MS + 2440587.5).toFixed(6) },
    { descripcion: "Margen de hora considerado", valor: sinHora ? "día local completo (±12 h)" : `±${margenMin} min` },
  );
  if (fecha.anio < 1970)
    advertencias.push(
      "Fecha anterior a 1970: la historia de zonas horarias de la tzdb es menos fiable en algunas regiones. Si conoces el horario oficial que regía, compruébalo.",
    );
  if (tiempo.esHoraMediaLocal)
    advertencias.push(`Se aplicó hora media local (${tiempo.desfaseTexto}) según la tzdb, porque aún no regía una hora estándar en ese lugar.`);
  if (candidatos.estado === "repetida")
    advertencias.push(`La hora local se repitió ese día; se usó la ${entrada.ocurrencia} ocurrencia (${tiempo.desfaseTexto}).`);

  // 2. Muestras dentro de los márgenes de hora (y de lugar para las casas).
  const tiempos = muestrasDeTiempo(utcMs, margenMin, sinHora ? 25 : 9);
  const centroT = Math.floor(tiempos.length / 2);
  const sideral = config.zodiaco === "sideral";
  const ayanamsaEn = (t: number) => (sideral ? ayanamsaMedia(config.ayanamsa, motor.siglosTT(t)) + motor.nutacionLongitud(t) : 0);
  const ayanamsaCentro = sideral ? ayanamsaEn(utcMs) : undefined;
  if (sideral) {
    pasos.push({
      descripcion: "Ayanamsa",
      valor: `${NOMBRES_AYANAMSA[config.ayanamsa]}: ${ayanamsaCentro!.toFixed(4)}° (media + nutación), restada a cada longitud`,
    });
  }

  const lugar = entrada.lugar;
  const conCasas = !sinHora && !!lugar && Math.abs(lugar.latitud) < 89.9;
  const coords = conCasas
    ? (() => {
        const d = lugar.incertidumbreGrados;
        const base = { lat: lugar.latitud, lon: lugar.longitud };
        if (d <= 0) return [base];
        return [base, { lat: base.lat + d, lon: base.lon }, { lat: base.lat - d, lon: base.lon }, { lat: base.lat, lon: base.lon + d }, { lat: base.lat, lon: base.lon - d }];
      })()
    : [];
  // Combinaciones (tiempo, coordenada); para cuerpos solo cambia el tiempo.
  const combinaciones = conCasas ? tiempos.flatMap((_, ti) => coords.map((_, ci) => ({ ti, ci }))) : tiempos.map((_, ti) => ({ ti, ci: 0 }));

  // 3. Cuerpos.
  const longitudesCuerpo = new Map<string, number[]>();
  const posiciones: PosicionCalculada[] = [];
  const puntosAspecto: PuntoParaAspecto[] = [];
  for (const c of CUERPOS) {
    const lons = tiempos.map((t) => normalizar(motor.longitud(c.clave, t, config.nodo) - ayanamsaEn(t)));
    longitudesCuerpo.set(c.clave, lons);
    const lon = lons[centroT];
    const velocidadEn = (t: number) => {
      const d = normalizar(motor.longitud(c.clave, t + DIA_MS / 2, config.nodo) - motor.longitud(c.clave, t - DIA_MS / 2, config.nodo));
      return d > 180 ? d - 360 : d;
    };
    const velocidad = velocidadEn(utcMs);
    const extremos = [tiempos[0], tiempos[tiempos.length - 1]].map(velocidadEn);
    const rango = rangoDe(lon, lons, EXACTITUD_MOTOR_GRADOS);
    const formato = formatoSegunPrecision(lon, rango);
    posiciones.push({
      clave: c.clave,
      nombre: c.clave === "nodo" ? `Nodo norte ${config.nodo}` : c.nombre,
      simbolo: c.simbolo,
      longitud: lon,
      signo: signoDe(lon),
      ...formato,
      rango,
      signosPosibles: signosEnRango(rango),
      velocidad,
      retrogrado: c.clave === "nodo" ? undefined : velocidad < 0,
      retrogradoIncierto: c.clave === "nodo" ? undefined : extremos.some((v) => v < 0 !== velocidad < 0),
    });
    puntosAspecto.push({ clave: c.clave, longitud: lon, muestras: combinaciones.map((k) => lons[k.ti]), velocidad });
  }

  // 4. Casas, Ascendente y Medio Cielo.
  let casas: ResultadoCasas | null = null;
  if (sinHora) {
    advertencias.push(
      "Hora desconocida: no se calculan casas, Ascendente ni Medio Cielo. Las posiciones se calculan a las 12:00 locales y se muestran con el rango de todo el día; la Luna avanza entre 12° y 15° en un día.",
    );
  } else if (!lugar) {
    advertencias.push("Sin lugar de nacimiento: no se calculan casas, Ascendente ni Medio Cielo.");
  } else if (!conCasas) {
    advertencias.push("En los polos geográficos las casas no están definidas; se omiten.");
  } else {
    const centroC = combinaciones.findIndex((k) => k.ti === centroT && k.ci === 0);
    const calculos = combinaciones.map((k) => {
      const t = tiempos[k.ti];
      const r = calcularCasas(
        { armc: motor.armc(t, coords[k.ci].lon), latitud: coords[k.ci].lat, oblicuidad: motor.oblicuidad(t) },
        config.sistemaCasas,
        config.respaldoPolar,
      );
      const ay = ayanamsaEn(t);
      if (!sideral) return r;
      const asc = normalizar(r.asc - ay);
      const mc = normalizar(r.mc - ay);
      const cuspides =
        r.sistemaUsado === "signos-enteros"
          ? Array.from({ length: 12 }, (_, i) => normalizar(Math.floor(asc / 30) * 30 + 30 * i))
          : r.sistemaUsado === "iguales"
            ? Array.from({ length: 12 }, (_, i) => normalizar(asc + 30 * i))
            : r.cuspides.map((x) => normalizar(x - ay));
      return { ...r, asc, mc, cuspides };
    });
    const centro = calculos[centroC];
    const oblicuidad = motor.oblicuidad(utcMs);
    pasos.push(
      { descripcion: "ARMC (tiempo sidéreo local)", valor: `${motor.armc(utcMs, lugar.longitud).toFixed(4)}°` },
      { descripcion: "Oblicuidad verdadera", valor: `${oblicuidad.toFixed(4)}°` },
      { descripcion: "Sistema de casas", valor: NOMBRES_SISTEMA_CASAS[centro.sistemaUsado] },
    );
    if (centro.respaldo) {
      advertencias.push(
        `${NOMBRES_SISTEMA_CASAS[config.sistemaCasas]} no está definido a ${Math.abs(lugar.latitud).toFixed(2)}° de latitud (límite ±${limitePolar(oblicuidad).toFixed(2)}°): se usó ${NOMBRES_SISTEMA_CASAS[centro.sistemaUsado]}.`,
      );
    } else if (calculos.some((c) => c.respaldo)) {
      advertencias.push(
        `El lugar está muy cerca del límite polar: dentro del margen de coordenadas ${NOMBRES_SISTEMA_CASAS[config.sistemaCasas]} deja de estar definido. Las casas son poco fiables.`,
      );
    }
    if (Math.abs(lugar.latitud) > limitePolar(oblicuidad))
      advertencias.push("Dentro del círculo polar el Ascendente puede saltar bruscamente; se toma siempre el punto que asciende por el este.");

    const cuspides: CuspideCasa[] = centro.cuspides.map((lon, i) => {
      const rango = rangoDe(lon, calculos.map((c) => c.cuspides[i]), EXACTITUD_MOTOR_GRADOS);
      return { casa: i + 1, longitud: lon, signo: signoDe(lon), rango, ...formatoSegunPrecision(lon, rango) };
    });
    casas = { sistemaSolicitado: config.sistemaCasas, sistemaUsado: centro.sistemaUsado, cuspides };

    for (const p of PUNTOS_ANGULARES) {
      const valores = calculos.map((c) => c[p.clave]);
      const lon = centro[p.clave];
      const rango = rangoDe(lon, valores, EXACTITUD_MOTOR_GRADOS);
      posiciones.push({
        clave: p.clave,
        nombre: p.nombre,
        simbolo: p.simbolo,
        longitud: lon,
        signo: signoDe(lon),
        ...formatoSegunPrecision(lon, rango),
        rango,
        signosPosibles: signosEnRango(rango),
      });
      puntosAspecto.push({ clave: p.clave, longitud: lon, muestras: valores });
    }
    for (const pos of posiciones) {
      if (pos.clave === "asc" || pos.clave === "mc") continue;
      const lons = longitudesCuerpo.get(pos.clave)!;
      pos.casa = casaDe(pos.longitud, centro.cuspides);
      pos.casasPosibles = [...new Set(combinaciones.map((k, i) => casaDe(lons[k.ti], calculos[i].cuspides)))].sort((a, b) => a - b);
    }
    if (lugar.incertidumbreGrados > 0)
      advertencias.push(
        `Las coordenadas del lugar tienen una incertidumbre de ±${lugar.incertidumbreGrados}°; se incluye en los rangos del Ascendente, el Medio Cielo y las casas.`,
      );
  }

  if (entrada.precisionHora === "aproximada")
    advertencias.push(
      `Hora aproximada (±${margenMin} min): el Ascendente avanza en promedio 1° cada 4 minutos y la Luna unos 0,5° por hora. Los valores se muestran con la precisión que permite ese margen.`,
    );
  for (const p of posiciones) {
    if (p.signosPosibles.length > 1) advertencias.push(`${p.nombre} puede estar en ${p.signosPosibles.join(" o ")} dentro de los márgenes de los datos.`);
    if (p.casasPosibles && p.casasPosibles.length > 1)
      advertencias.push(`${p.nombre} puede caer en las casas ${p.casasPosibles.join(", ")} dentro de los márgenes de los datos.`);
    if (p.retrogradoIncierto) advertencias.push(`${p.nombre} está estacionario: su movimiento directo o retrógrado cambia dentro del margen de hora.`);
  }

  const aspectos = calcularAspectos(puntosAspecto, config.aspectos);
  const anchoMax = Math.max(...posiciones.map((p) => anchoRango(p.rango)));

  return {
    ok: true,
    motor: MOTOR,
    motorVersion: MOTOR_VERSION,
    efemerides: motor.nombre,
    reglasVersion: REGLAS_VERSION,
    config,
    entradas: {
      fecha: entrada.fecha,
      hora: sinHora ? undefined : entrada.hora,
      precisionHora: entrada.precisionHora,
      margenMinutos: margenMin,
      lugar,
    },
    tiempo,
    ayanamsaGrados: ayanamsaCentro,
    posiciones,
    casas,
    aspectos,
    pasos: [...pasos, { descripcion: "Mayor intervalo de incertidumbre", valor: `${anchoMax.toFixed(2)}°` }],
    advertencias,
    interpretaciones: {
      estado: "pendiente",
      motivo: "Las interpretaciones se basarán en los libros que aporte el propietario, con citas. Aquí solo hay posiciones calculadas.",
    },
  };
}
