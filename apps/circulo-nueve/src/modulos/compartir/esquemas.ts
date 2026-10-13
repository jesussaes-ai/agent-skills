import { z } from "@/modulos/seguridad/zod";

const uuid = z.string().uuid();

export const esquemaCrearEnlace = z.object({
  expedienteId: uuid,
  documentoId: z.union([uuid, z.literal("")]).transform((v) => v || null),
  vigenciaHoras: z.coerce.number().int().min(1, "Elige una vigencia.").max(720, "Máximo 30 días."),
  maxAccesos: z
    .union([z.coerce.number().int().min(1, "Mínimo 1 descarga.").max(1000, "Máximo 1000 descargas."), z.literal("")])
    .transform((v) => (v === "" ? null : v)),
  nota: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres.")
    .transform((v) => v || null),
});

export const esquemaRevocarEnlace = z.object({ expedienteId: uuid, enlaceId: uuid });
