import { z } from "@/modulos/seguridad/zod";

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const NIVELES_ACCESO = [
  ["consultores", "Equipo: asistentes y administración"],
  ["publico", "Todas las cuentas activas"],
  ["admin", "Solo administración"],
] as const;

export const GRUPOS = [
  ["aportada", "Aportada por la persona propietaria"],
  ["complementaria", "Complementaria"],
] as const;

export const esquemaMetadatos = z.object({
  titulo: z.string().trim().min(1, "Escribe el título.").max(300),
  autor: opcional(200),
  referencia: z.string().trim().min(1, "Escribe la referencia (editorial, archivo, URL…).").max(500),
  edicion: opcional(120),
  idioma: z.string().trim().min(2).max(10).default("es"),
  tradicion: opcional(120),
  grupo: z.enum(["aportada", "complementaria"]),
  licencia: z.string().trim().min(1, "Indica la licencia o el permiso de uso.").max(300),
  notasDerechos: opcional(1000),
  nivelAcceso: z.enum(["consultores", "publico", "admin"]),
  esDemo: z.enum(["on"]).optional(),
  derechos: z.literal("on", { message: "Confirma que tienes derecho a usar esta fuente." }),
});

export const esquemaWeb = esquemaMetadatos.extend({
  url: z.string().trim().url("Escribe una dirección web completa (https://…).").max(2000),
});

export const esquemaEditarFuente = esquemaMetadatos.omit({ derechos: true }).extend({ fuenteId: z.string().uuid() });

export const esquemaPregunta = z.object({
  pregunta: z.string().trim().min(3, "Escribe una pregunta.").max(1000),
  incluirComplementarias: z.enum(["on"]).optional(),
  enviarALlm: z.enum(["on"]).optional(),
});
