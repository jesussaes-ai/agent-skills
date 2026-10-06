import datos from "./secciones.json";

export type EstadoSeccion = "disponible" | "demo" | "pendiente";

export interface SeccionAyuda {
  id: string;
  titulo: string;
  resumen: string;
  deQueTrata: string;
  datosQueUsa: string[];
  comoSeUsa: string[];
  estado: EstadoSeccion;
  palabrasClave: string[];
}

export const VERSION_AYUDA: string = datos.version;
export const SECCIONES_AYUDA = datos.secciones as SeccionAyuda[];

export const ETIQUETA_ESTADO: Record<EstadoSeccion, string> = {
  disponible: "Disponible",
  demo: "Demostración",
  pendiente: "Pendiente",
};

export function obtenerSeccionAyuda(id: string): SeccionAyuda {
  const seccion = SECCIONES_AYUDA.find((s) => s.id === id);
  if (!seccion) throw new Error(`No existe la sección de ayuda «${id}».`);
  return seccion;
}

export function enlaceAyuda(id: string): string {
  return `/ayuda#${id}`;
}
