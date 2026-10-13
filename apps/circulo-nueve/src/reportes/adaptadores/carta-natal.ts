import type { ClasePrecision, ResultadoCarta } from "@/modulos/calculo/astrologia";
import { NOMBRES_AYANAMSA, NOMBRES_SISTEMA_CASAS } from "@/modulos/calculo/astrologia";
import type { Calculo, DatoAutorizado, DatosReporte, RuedaReporte, TablaReporte } from "../tipos";

/** Las fuentes incrustadas no traen «≈» ni glifos astrológicos: se sustituyen por texto. */
export function textoPdf(s: string): string {
  return s.replaceAll("≈", "aprox. ");
}

const PRECISION: Record<ClasePrecision, string> = { minuto: "al minuto", grado: "aproximada", rango: "rango" };
const PRECISION_HORA = { exacta: "exacta", aproximada: "aproximada", desconocida: "desconocida" } as const;

const ABREVIATURA: Record<string, string> = {
  sol: "So",
  luna: "Lu",
  mercurio: "Me",
  venus: "Ve",
  marte: "Ma",
  jupiter: "Ju",
  saturno: "Sa",
  urano: "Ur",
  neptuno: "Ne",
  pluton: "Pl",
  nodo: "No",
};

function coordenadas(lat: number, lon: number): string {
  const f = (v: number) => Math.abs(v).toFixed(4).replace(".", ",");
  return `${f(lat)}° ${lat >= 0 ? "N" : "S"}, ${f(lon)}° ${lon >= 0 ? "E" : "O"}`;
}

export function tradicionDeCarta(r: ResultadoCarta): string {
  const zodiaco = r.config.zodiaco === "sideral" ? `zodiaco sideral (${NOMBRES_AYANAMSA[r.config.ayanamsa]})` : "zodiaco tropical";
  const casas = r.casas ? `casas ${NOMBRES_SISTEMA_CASAS[r.casas.sistemaUsado]}` : "sin casas";
  return `Astrología occidental · ${zodiaco} · ${casas}`;
}

export function datosAutorizadosDeCarta(r: ResultadoCarta): DatoAutorizado[] {
  const e = r.entradas;
  const datos: DatoAutorizado[] = [
    { etiqueta: "Fecha de nacimiento", valor: e.fecha },
    {
      etiqueta: "Hora local de nacimiento",
      valor: e.hora ?? "Desconocida",
      nota:
        e.precisionHora === "desconocida"
          ? "Sin hora no se calculan casas, Ascendente ni Medio Cielo."
          : `Precisión ${PRECISION_HORA[e.precisionHora]}: se consideró un margen de ±${e.margenMinutos} min.`,
    },
  ];
  if (e.lugar) {
    const f = e.lugar.fuente;
    datos.push({
      etiqueta: "Lugar de nacimiento",
      valor: e.lugar.nombre,
      nota: `${coordenadas(e.lugar.latitud, e.lugar.longitud)} (±${String(e.lugar.incertidumbreGrados).replace(".", ",")}°) · ${
        f.tipo === "geonames" ? `GeoNames id ${f.geonameId}. ${f.atribucion}` : f.descripcion
      }`,
    });
  }
  datos.push(
    {
      etiqueta: "Zona horaria",
      valor: `${r.tiempo.zonaHoraria} (${r.tiempo.desfaseTexto})`,
      nota: `${r.tiempo.fuenteZona}. ${r.tiempo.versionTzdb}.`,
    },
    { etiqueta: "Tiempo universal usado", valor: r.tiempo.utc.replace("T", " ").replace("Z", " UT") },
  );
  return datos;
}

export function calculosDeCarta(r: ResultadoCarta): Calculo[] {
  return [
    {
      titulo: "De la hora local a la posición en el cielo",
      valor: "UT",
      subtitulo: `Motor ${r.motor} ${r.motorVersion} · efemérides ${r.efemerides}`,
      pasos: r.pasos.map((p) => ({ descripcion: p.descripcion, operacion: textoPdf(p.valor) })),
    },
  ];
}

export function tablasDeCarta(r: ResultadoCarta): TablaReporte[] {
  const nombre = (clave: string) => r.posiciones.find((p) => p.clave === clave)?.nombre ?? clave;
  const posiciones: TablaReporte = {
    titulo: "Posiciones calculadas",
    nota: "Cada valor se muestra con la precisión que permiten la hora y el lugar: al minuto, aproximado (con ±) o como rango.",
    columnas: r.casas ? ["Punto", "Posición", "Precisión", "Casa", "Movimiento"] : ["Punto", "Posición", "Precisión", "Movimiento"],
    anchos: r.casas ? [2.2, 3.6, 1.5, 1, 1.5] : [2.2, 3.6, 1.5, 1.5],
    filas: r.posiciones.map((p) => {
      const casa = p.casasPosibles && p.casasPosibles.length > 1 ? p.casasPosibles.join(" o ") : p.casa ? String(p.casa) : "—";
      const mov = p.retrogrado === undefined ? "—" : p.retrogradoIncierto ? "estacionario" : p.retrogrado ? "retrógrado" : "directo";
      const fila = [p.nombre, textoPdf(p.texto), PRECISION[p.precision]];
      return r.casas ? [...fila, casa, mov] : [...fila, mov];
    }),
  };
  const tablas = [posiciones];
  if (r.casas) {
    const c = r.casas.cuspides;
    tablas.push({
      titulo: `Cúspides de las casas · ${NOMBRES_SISTEMA_CASAS[r.casas.sistemaUsado]}`,
      nota:
        r.casas.sistemaUsado !== r.casas.sistemaSolicitado
          ? `Se usó ${NOMBRES_SISTEMA_CASAS[r.casas.sistemaUsado]} porque ${NOMBRES_SISTEMA_CASAS[r.casas.sistemaSolicitado]} no está definido en esta latitud.`
          : undefined,
      columnas: ["Casa", "Cúspide", "Casa", "Cúspide"],
      anchos: [0.8, 3, 0.8, 3],
      filas: Array.from({ length: 6 }, (_, i) => [String(i + 1), textoPdf(c[i].texto), String(i + 7), textoPdf(c[i + 6].texto)]),
    });
  }
  tablas.push({
    titulo: `Aspectos (${r.aspectos.length})`,
    nota: "Orbe redondeado al grado. «Incierto»: dentro de los márgenes de los datos podría quedar fuera del orbe configurado.",
    columnas: ["Puntos", "Aspecto", "Orbe", "Fase"],
    anchos: [3, 2.4, 1.6, 1.4],
    filas: r.aspectos.map((a) => [
      `${nombre(a.a)} – ${nombre(a.b)}`,
      `${a.nombre} (${a.angulo}°)${a.incierto ? " · incierto" : ""}`,
      `${a.orbe < 1 ? "<1" : Math.round(a.orbe)}° de ±${a.orbeMaximo}°`,
      a.fase ?? "—",
    ]),
  });
  return tablas;
}

export function ruedaDeCarta(r: ResultadoCarta): RuedaReporte {
  const asc = r.posiciones.find((p) => p.clave === "asc");
  return {
    ascendente: asc?.longitud,
    cuspides: r.casas?.cuspides.map((c) => c.longitud),
    puntos: r.posiciones
      .filter((p) => ABREVIATURA[p.clave])
      .map((p) => ({ abreviatura: ABREVIATURA[p.clave], longitud: p.longitud, rango: p.precision === "rango" ? p.rango : undefined })),
    pie: `${asc ? "El Ascendente queda a la izquierda." : "Sin casas: 0° Aries a la izquierda."} So Sol, Lu Luna, Me Mercurio, Ve Venus, Ma Marte, Ju Júpiter, Sa Saturno, Ur Urano, Ne Neptuno, Pl Plutón, No Nodo norte. Los arcos dorados marcan posiciones conocidas solo como rango.`,
  };
}

export function limitesDeCarta(r: ResultadoCarta): string[] {
  return [
    `Efemérides ${r.efemerides}; comprobadas contra Swiss Ephemeris 2.10.03 con una diferencia máxima medida de 18″ entre 1900 y 2050.`,
    `Hora convertida con la base IANA de zonas horarias (${r.tiempo.versionTzdb}); desfase aplicado ${r.tiempo.desfaseTexto}.`,
    `Reglas ${r.reglasVersion}, motor ${r.motor} ${r.motorVersion}. Otras escuelas usan otros zodiacos, sistemas de casas y orbes.`,
    ...r.advertencias.map(textoPdf),
    "La astrología es un sistema simbólico de reflexión personal; no es un hecho científico, diagnóstico ni predicción.",
  ];
}

export type CamposCartaReporte = Pick<
  DatosReporte,
  "tipo" | "tradicion" | "versionReglas" | "datosAutorizados" | "calculos" | "tablas" | "rueda" | "limites"
>;

export function reporteDeCartaNatal(r: ResultadoCarta): CamposCartaReporte {
  return {
    tipo: "carta-natal",
    tradicion: tradicionDeCarta(r),
    versionReglas: r.reglasVersion,
    datosAutorizados: datosAutorizadosDeCarta(r),
    calculos: calculosDeCarta(r),
    tablas: tablasDeCarta(r),
    rueda: ruedaDeCarta(r),
    limites: limitesDeCarta(r),
  };
}
