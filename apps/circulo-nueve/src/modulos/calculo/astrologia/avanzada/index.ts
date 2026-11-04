/**
 * Astrología avanzada: tránsitos, calendario de tránsitos exactos, sinastría,
 * revolución solar, progresiones secundarias y arco solar.
 * Funciones puras y deterministas que reutilizan el motor de la carta natal
 * (efemérides, zona horaria, casas y aspectos). Solo datos calculados; las
 * interpretaciones quedan pendientes.
 */
export * from "./tipos";
export {
  MODULO_AVANZADO,
  MODULO_AVANZADO_VERSION,
  ORBES_PROGRESION_POR_DEFECTO,
  ORBES_SINASTRIA_POR_DEFECTO,
  ORBES_TRANSITO_POR_DEFECTO,
  REGLAS_AVANZADAS_VERSION,
} from "./comun";
export {
  ASPECTOS_MAYORES,
  PASO_MUESTREO_MS,
  PLANETAS_LENTOS,
  PLANETAS_RAPIDOS,
  RANGO_MAXIMO_DIAS,
  calcularTransitos,
  calendarioTransitos,
} from "./transitos";
export { sinastria } from "./sinastria";
export { revolucionSolar } from "./revolucion";
export { ANIO_TROPICO_DIAS, arcoSolar, progresionesSecundarias } from "./progresiones";
