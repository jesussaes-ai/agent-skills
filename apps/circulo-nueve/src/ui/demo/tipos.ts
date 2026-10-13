import type { ConfigNumerologia } from "@/modulos/calculo/numerologia";

export type PrecisionHora = "exacta" | "aproximada" | "desconocida";

export interface Perfil {
  nombreNacimiento: string;
  nombrePreferido: string;
  fecha: string;
  hora: string;
  precisionHora: PrecisionHora;
  lugar: string;
  zonaHoraria: string;
  esDemo: boolean;
}

export interface Consentimientos {
  avisoLeido: boolean;
  usarEnSesion: boolean;
}

export const PERFIL_VACIO: Perfil = {
  nombreNacimiento: "",
  nombrePreferido: "",
  fecha: "",
  hora: "",
  precisionHora: "desconocida",
  lugar: "",
  zonaHoraria: "",
  esDemo: false,
};

/** Persona ficticia para la demostración. No corresponde a nadie real. */
export const PERFIL_FICTICIO: Perfil = {
  nombreNacimiento: "Ana María Núñez",
  nombrePreferido: "Ana",
  fecha: "1990-07-15",
  hora: "08:30",
  precisionHora: "aproximada",
  lugar: "Ciudad ficticia, México",
  zonaHoraria: "America/Mexico_City",
  esDemo: true,
};

export type ReglasDemo = Pick<ConfigNumerologia, "numerosMaestros" | "enye" | "y" | "metodoCaminoDeVida" | "metodoNombre">;
