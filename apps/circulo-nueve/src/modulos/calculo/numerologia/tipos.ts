export type ReglaEnye = "como-n" | "rechazar";
export type ReglaY = "consonante" | "vocal";
export type MetodoCaminoDeVida = "por-componentes" | "suma-de-digitos";
export type MetodoNombre = "total" | "por-palabra";

export interface ConfigNumerologia {
  /** Si es true, la reducción se detiene al llegar a un número de `maestros`. */
  numerosMaestros: boolean;
  maestros: readonly number[];
  enye: ReglaEnye;
  y: ReglaY;
  metodoCaminoDeVida: MetodoCaminoDeVida;
  metodoNombre: MetodoNombre;
}

export type ClaveIndicador = "caminoDeVida" | "expresion" | "alma" | "personalidad";

export interface Paso {
  descripcion: string;
  operacion: string;
}

export interface Indicador {
  clave: ClaveIndicador;
  nombre: string;
  descripcion: string;
  valor: number;
  esMaestro: boolean;
  pasos: Paso[];
}

export interface CambioNormalizacion {
  original: string;
  resultado: string;
  regla: string;
}

export interface EntradaNumerologia {
  /** Nombre completo de nacimiento, tal como lo escribe la persona. */
  nombre?: string;
  /** Fecha de nacimiento en formato AAAA-MM-DD. */
  fecha?: string;
}

export interface ResultadoNumerologia {
  ok: true;
  motor: string;
  motorVersion: string;
  tradicion: string;
  reglasVersion: string;
  reglas: ConfigNumerologia;
  entradas: {
    nombreOriginal?: string;
    nombreNormalizado?: string;
    palabras?: string[];
    fecha?: string;
  };
  cambios: CambioNormalizacion[];
  advertencias: string[];
  indicadores: Indicador[];
}

export interface ErrorNumerologia {
  ok: false;
  errores: string[];
}
