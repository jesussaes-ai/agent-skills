import { z } from "@/modulos/seguridad/zod";

const uuid = z.string().uuid();

export const esquemaConfigCarta = z.object({
  zodiaco: z.enum(["tropical", "sideral"]),
  ayanamsa: z.enum(["lahiri", "fagan-bradley", "raman", "krishnamurti"]),
  sistemaCasas: z.enum(["placidus", "koch", "regiomontano", "campano", "porfirio", "iguales", "signos-enteros"]),
  respaldoPolar: z.enum(["porfirio", "iguales", "signos-enteros"]),
  nodo: z.enum(["medio", "verdadero"]),
  margenExactaMin: z.number().min(0).max(10),
  margenAproximadaMin: z.number().int().min(1).max(180),
  aspectos: z
    .array(
      z.object({
        clave: z.enum(["conjuncion", "oposicion", "trigono", "cuadratura", "sextil", "semisextil", "quincuncio", "semicuadratura", "sesquicuadratura"]),
        activo: z.boolean(),
        orbe: z.number().min(0).max(12),
      }),
    )
    .max(9),
});

const json = z.string().max(4000).transform((s, ctx) => {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    ctx.addIssue({ code: "custom", message: "JSON no válido." });
    return z.NEVER;
  }
});

export const esquemaGuardarCarta = z.discriminatedUnion("lugarTipo", [
  z.object({
    expedienteId: uuid,
    lugarTipo: z.literal("geonames"),
    geonameId: z.coerce.number().int().positive(),
    config: json.pipe(esquemaConfigCarta),
    ocurrencia: z.enum(["primera", "segunda", ""]).optional(),
  }),
  z.object({
    expedienteId: uuid,
    lugarTipo: z.literal("manual"),
    nombreLugar: z.string().trim().max(120),
    latitud: z.coerce.number().min(-90).max(90),
    longitud: z.coerce.number().min(-180).max(180),
    zonaLugar: z.string().trim().min(1).max(60),
    config: json.pipe(esquemaConfigCarta),
    ocurrencia: z.enum(["primera", "segunda", ""]).optional(),
  }),
]);
