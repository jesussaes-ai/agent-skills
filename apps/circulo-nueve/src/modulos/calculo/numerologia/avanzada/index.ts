/**
 * Numerología avanzada (pitagórica): ciclo personal, pináculos y desafíos,
 * ciclos de vida, números adicionales y compatibilidad.
 * Funciones puras, sin E/S; cada número trae sus pasos visibles.
 * Las convenciones están documentadas en cada archivo y son configurables.
 */
export * from "./tipos";
export { MOTOR_AVANZADA_VERSION, esBisiesto } from "./comun";
export { cicloPersonal } from "./ciclo-personal";
export { pinaculosYDesafios, ciclosDeVida } from "./pinaculos";
export { numerosAdicionales } from "./adicionales";
export {
  compatibilidadNumerologica,
  etiquetarDiferencia,
  CONVENCION_COMPATIBILIDAD_POR_DEFECTO,
} from "./compatibilidad";
