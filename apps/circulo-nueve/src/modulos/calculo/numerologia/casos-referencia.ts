import type { ClaveIndicador, ConfigNumerologia } from "./tipos";

/**
 * Casos de referencia con personas ficticias, verificados a mano con la tabla
 * pitagórica (ver docs/numerologia-reglas.md). Son datos de demostración.
 */
export interface CasoReferencia {
  titulo: string;
  nombre?: string;
  fecha?: string;
  config?: Partial<ConfigNumerologia>;
  esperado: Partial<Record<ClaveIndicador, number>>;
  verificacion: string;
}

export const CASOS_REFERENCIA: CasoReferencia[] = [
  {
    titulo: "Nombre con acentos y ñ (método total)",
    nombre: "Ana María Núñez",
    fecha: "1990-07-15",
    esperado: { expresion: 3, alma: 3, personalidad: 9, caminoDeVida: 5 },
    verificacion:
      "ANA MARIA NUNEZ: 1+5+1+4+1+9+9+1+5+3+5+5+8 = 57 → 12 → 3. Vocales A,A,A,I,A,U,E = 21 → 3. Consonantes N,M,R,N,N,Z = 36 → 9. Fecha: 15→6, 7, 1990→19→10→1; 6+7+1 = 14 → 5.",
  },
  {
    titulo: "Mismo nombre, método por palabra",
    nombre: "Ana María Núñez",
    config: { metodoNombre: "por-palabra" },
    esperado: { expresion: 3 },
    verificacion: "ANA = 7; MARIA = 24 → 6; NUNEZ = 26 → 8; 7+6+8 = 21 → 3.",
  },
  {
    titulo: "Número maestro 22 en el nombre",
    nombre: "Gina",
    esperado: { expresion: 22, alma: 1, personalidad: 3 },
    verificacion: "G7 + I9 + N5 + A1 = 22 (maestro). Vocales I,A = 10 → 1. Consonantes G,N = 12 → 3.",
  },
  {
    titulo: "Número maestro 22 desactivado",
    nombre: "Gina",
    config: { numerosMaestros: false },
    esperado: { expresion: 4 },
    verificacion: "22 → 2 + 2 = 4.",
  },
  {
    titulo: "Camino de vida maestro 11 por componentes",
    fecha: "1980-01-01",
    esperado: { caminoDeVida: 11 },
    verificacion: "Día 1, mes 1, año 1980 → 18 → 9; 1+1+9 = 11 (maestro).",
  },
  {
    titulo: "Misma fecha sumando todos los dígitos",
    fecha: "1980-01-01",
    config: { metodoCaminoDeVida: "suma-de-digitos" },
    esperado: { caminoDeVida: 2 },
    verificacion: "1+9+8+0+0+1+0+1 = 20 → 2. El método cambia el resultado: por eso es configurable.",
  },
  {
    titulo: "Y como consonante",
    nombre: "Yolanda",
    esperado: { expresion: 9, alma: 8, personalidad: 1 },
    verificacion: "Y7 O6 L3 A1 N5 D4 A1 = 27 → 9. Vocales O,A,A = 8. Consonantes Y,L,N,D = 19 → 10 → 1.",
  },
  {
    titulo: "Y como vocal",
    nombre: "Yolanda",
    config: { y: "vocal" },
    esperado: { expresion: 9, alma: 6, personalidad: 3 },
    verificacion: "Vocales Y,O,A,A = 15 → 6. Consonantes L,N,D = 12 → 3.",
  },
];
