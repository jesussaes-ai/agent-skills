import { z } from "zod";

export const PERMISOS_EXPEDIENTE = ["listar", "abrir_descargar", "cargar", "modificar", "borrar", "compartir"] as const;
export type PermisoExpediente = (typeof PERMISOS_EXPEDIENTE)[number];

export const NOMBRE_PERMISO: Record<PermisoExpediente, string> = {
  listar: "Ver y listar",
  abrir_descargar: "Abrir y descargar",
  cargar: "Cargar",
  modificar: "Modificar",
  borrar: "Borrar",
  compartir: "Compartir",
};

export const VERSION_TEXTO_CONSENTIMIENTO = "consentimientos-v1";

/** Consentimientos que se pueden otorgar hoy. Los externos siguen desactivados sin proveedor. */
export const CONSENTIMIENTOS = [
  { tipo: "usar_conversacion", texto: "Usar lo que la persona comparte en la conversación para personalizar la sesión." },
  { tipo: "guardar_perfil", texto: "Guardar el perfil de nacimiento en este expediente." },
  { tipo: "guardar_historial", texto: "Guardar las lecturas y reportes en el historial del expediente." },
] as const;

export const CONSENTIMIENTOS_NO_DISPONIBLES = [
  { tipo: "envio_externo", texto: "Enviar datos a un servicio de IA externo", motivo: "No hay proveedor configurado." },
  { tipo: "entrenamiento", texto: "Usar los datos para entrenar modelos", motivo: "Círculo Nueve no entrena modelos." },
] as const;

const uuid = z.string().uuid();
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const esquemaNuevoExpediente = z.object({
  etiqueta: z.string().trim().min(1, "Escribe un nombre para el expediente.").max(120),
  esDemo: z.enum(["on"]).optional(),
});

export const esquemaEditarExpediente = z.object({
  expedienteId: uuid,
  etiqueta: z.string().trim().min(1, "Escribe un nombre para el expediente.").max(120),
});

export const esquemaClienteVinculado = z.object({
  expedienteId: uuid,
  clienteId: z.union([uuid, z.literal("")]).transform((v) => v || null),
});

export const esquemaPerfil = z
  .object({
    expedienteId: uuid,
    nombreNacimiento: textoOpcional(120),
    nombrePreferido: textoOpcional(80),
    fecha: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."), z.literal("")]).transform((v) => v || null),
    hora: z.union([z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida."), z.literal("")]).transform((v) => v || null),
    precisionHora: z.enum(["exacta", "aproximada", "desconocida"]),
    lugar: textoOpcional(120),
    zonaHoraria: textoOpcional(60),
  })
  .refine((d) => d.precisionHora !== "desconocida" || !d.hora, {
    path: ["hora"],
    message: "Si la hora es desconocida, deja el campo vacío.",
  })
  .refine((d) => d.precisionHora === "desconocida" || d.hora, {
    path: ["hora"],
    message: "Escribe la hora o marca la precisión como desconocida.",
  });

export const esquemaLectura = z.object({
  expedienteId: uuid,
  nombre: z.string().trim().max(120),
  fecha: z.string().trim().max(10),
  numerosMaestros: z.enum(["on"]).optional(),
  y: z.enum(["consonante", "vocal"]),
  enye: z.enum(["como-n", "rechazar"]),
  metodoCaminoDeVida: z.enum(["por-componentes", "suma-de-digitos"]),
  metodoNombre: z.enum(["total", "por-palabra"]),
});

export const esquemaIdLectura = z.object({ expedienteId: uuid, lecturaId: uuid });
export const esquemaIdDocumento = z.object({ expedienteId: uuid, documentoId: uuid });
export const esquemaIdExpediente = z.object({ expedienteId: uuid, confirmacion: z.string().optional() });

export const esquemaPermisoExpediente = z.object({
  expedienteId: uuid,
  usuarioId: uuid,
  permisos: z.array(z.enum(PERMISOS_EXPEDIENTE)).min(1, "Elige al menos un permiso."),
  dias: z.union([z.coerce.number().int().min(1).max(3650), z.literal("")]).transform((v) => (v === "" ? null : v)),
});

export const esquemaPermisoArchivo = z.object({
  expedienteId: uuid,
  documentoId: uuid,
  usuarioId: uuid,
  dias: z.union([z.coerce.number().int().min(1).max(3650), z.literal("")]).transform((v) => (v === "" ? null : v)),
});

export const esquemaRetirarPermiso = z.object({ expedienteId: uuid, usuarioId: uuid, documentoId: z.string().uuid().optional() });

export const esquemaAjustes = z.object({
  retencionDias: z.coerce.number().int().min(1, "Mínimo 1 día.").max(3650, "Máximo 3650 días."),
  vigenciaSegundos: z.coerce.number().int().min(10, "Mínimo 10 segundos.").max(600, "Máximo 600 segundos."),
  enlaceVigenciaMaxDias: z.coerce.number().int().min(1, "Mínimo 1 día.").max(30, "Máximo 30 días."),
  retencionEnlacesDias: z.coerce.number().int().min(1, "Mínimo 1 día.").max(3650, "Máximo 3650 días."),
  retencionAuditoriaDias: z.coerce.number().int().min(365, "Mínimo 365 días.").max(3650, "Máximo 3650 días."),
});

export const esquemaAviso = z.object({
  responsable: textoOpcional(500),
  finalidades: textoOpcional(2000),
  datosTratados: textoOpcional(2000),
  conservacion: textoOpcional(1000),
  derechos: textoOpcional(2000),
  contacto: textoOpcional(500),
});

/** FormData → objeto; las claves repetidas (casillas) se devuelven como lista. */
export function formularioAObjeto(form: FormData, listas: string[] = []): Record<string, unknown> {
  const salida: Record<string, unknown> = Object.fromEntries(listas.map((l) => [l, [] as string[]]));
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string") continue;
    if (listas.includes(k)) (salida[k] as string[]).push(v);
    else salida[k] = v;
  }
  return salida;
}
