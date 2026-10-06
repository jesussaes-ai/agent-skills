import { z } from "zod";

export const ROLES_ASIGNABLES = ["consultor", "cliente", "admin"] as const;
export const ESTADOS_CUENTA = ["activo", "suspendido", "revocado"] as const;

const correo = z.string().trim().toLowerCase().email("Escribe un correo válido.").max(254);
const nombre = z.string().trim().min(1, "Escribe un nombre.").max(120, "El nombre es demasiado largo.");

export const contrasena = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(72, "La contraseña no puede superar 72 caracteres.")
  .refine((v) => /[A-Za-zÀ-ÿ]/.test(v) && /\d/.test(v), "La contraseña debe combinar letras y números.");

export const esquemaAlta = z
  .object({
    clave: z.string().min(1, "Escribe la clave de alta.").max(512),
    correo,
    nombre,
    contrasena,
    confirmacion: z.string(),
  })
  .refine((d) => d.contrasena === d.confirmacion, { path: ["confirmacion"], message: "Las contraseñas no coinciden." });

export const esquemaEntrar = z.object({ correo, contrasena: z.string().min(1, "Escribe tu contraseña.").max(72) });

export const esquemaRecuperar = z.object({ correo });

export const esquemaNuevaContrasena = z
  .object({ contrasena, confirmacion: z.string() })
  .refine((d) => d.contrasena === d.confirmacion, { path: ["confirmacion"], message: "Las contraseñas no coinciden." });

export const esquemaCodigoMfa = z.object({
  codigo: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos."),
  factorId: z.string().uuid().optional(),
});

export const esquemaInvitar = z.object({ correo, nombre, rol: z.enum(ROLES_ASIGNABLES) });

export const esquemaEstado = z.object({ usuarioId: z.string().uuid(), estado: z.enum(ESTADOS_CUENTA) });

export const esquemaRol = z.object({
  usuarioId: z.string().uuid(),
  rol: z.enum(ROLES_ASIGNABLES),
  operacion: z.enum(["asignar", "retirar"]),
});

export type EstadoFormulario = { ok?: boolean; mensaje?: string; errores?: Record<string, string> };

export function erroresDe(error: z.ZodError): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = String(issue.path[0] ?? "formulario");
    errores[campo] ??= issue.message;
  }
  return errores;
}

export function datosDe(form: FormData): Record<string, string> {
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
}
