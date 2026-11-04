import { z } from "@/modulos/seguridad/zod";

/** Datos confirmados de una consulta. El lugar se manda por id de GeoNames o a mano; el servidor lo resuelve. */
export const esquemaConsulta = z.object({
  nombre: z.string({ error: "Escribe el nombre completo de nacimiento." }).trim().min(2, "Escribe el nombre completo de nacimiento.").max(120),
  nombrePreferido: z.string().trim().max(60).optional(),
  fecha: z.string({ error: "Escribe la fecha de nacimiento." }).regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato AAAA-MM-DD."),
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "La hora debe tener el formato HH:MM.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  precisionHora: z.enum(["exacta", "aproximada", "desconocida"], { error: "Indica si la hora es exacta, aproximada o desconocida." }),
  lugar: z
    .discriminatedUnion(
      "tipo",
      [
      z.object({ tipo: z.literal("geonames"), geonameId: z.number().int().positive() }),
      z.object({
        tipo: z.literal("manual"),
        nombre: z.string().trim().max(120),
        latitud: z.number().min(-90).max(90),
        longitud: z.number().min(-180).max(180),
        zona: z.string().trim().min(1).max(60),
      }),
      ],
      { error: "El lugar de nacimiento no es válido." },
    )
    .optional(),
  /** Nombre en letras hebreas aprobado por la persona (solo letras hebreas, espacios y signos de geresh). */
  hebreo: z
    .string()
    .trim()
    .max(120)
    .regex(/^[א-ת׳״'\s-]*$/, "Usa solo letras hebreas.")
    .optional(),
  /** Zona horaria del equipo de la persona, para fechar la carta en su día local. */
  zonaUsuario: z.string().trim().max(60).optional(),
});

export type DatosConsulta = z.infer<typeof esquemaConsulta>;
